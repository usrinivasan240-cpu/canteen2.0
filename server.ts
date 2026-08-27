/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { GoogleGenAI, Type } from '@google/genai';
import { createClient, SupabaseClient, User as SupabaseUser } from '@supabase/supabase-js';
import { MenuItem, Order, Review, Canteen, OrderItem, Ingredient, CanteenSettings, College, SubCanteen, User } from './src/types';
import { pgGetById, pgGetAll, pgGetWhere, pgGetWhereOrdered, pgSet, pgUpdate, pgDelete, pgDeleteWhere, pgIncrement, pgGetByEmail, isPgAvailable, query, queryOne, execute } from './db';

// Load environment variables
dotenv.config();

// Supabase Auth clients — lazily initialized so missing SUPABASE_* env vars
// don't crash the whole serverless function at import time (Vercel cold start).
let supabaseAdmin!: SupabaseClient;
let supabaseClient!: SupabaseClient;

function ensureSupabaseClients(): boolean {
  if (supabaseAdmin && supabaseClient) return true;
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !serviceRoleKey || !anonKey) {
    console.warn('[auth] SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY not set — auth endpoints disabled.');
    return false;
  }
  supabaseAdmin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  supabaseClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  return true;
}

function supabaseNotConfigured(res: any) {
  return res.status(503).json({ success: false, error: 'Authentication server is not configured. Please contact support.' });
}

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================================================
// SECURITY: Password hashing helpers (crypto.scrypt — no external deps needed)
// ============================================================================
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const verify = crypto.scryptSync(password, salt, 64).toString('hex');
  return hash === verify;
}

// ============================================================================
// SECURITY: Auth middleware — validates Supabase JWT on protected endpoints
// ============================================================================
const PROTECTED_PATHS = [
  '/api/users', '/api/colleges', '/api/canteens', '/api/subcanteens',
  '/api/canteen/menu', '/api/canteen/order', '/api/canteen/ingredients',
  '/api/canteen/settings', '/api/support-tickets'
];

async function authMiddleware(req: any, res: any, next: any) {
  if (!ensureSupabaseClients()) {
    return supabaseNotConfigured(res);
  }
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Authentication required.' });
  }
  const token = authHeader.split(' ')[1];
  
  try {
    // Verify JWT with Supabase
    const { data: { user }, error } = await supabaseClient.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token.' });
    }
    
    // Attach user info to request
    (req as any).authUser = user;
    (req as any).authEmail = user.email?.trim().toLowerCase();
    next();
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid token.' });
  }
}

// ============================================================================
// SECURITY: Role-based access control for management endpoints
// ============================================================================
async function getCallerProfile(req: any): Promise<User | null> {
  const authEmail = req.authEmail;
  if (!authEmail) return null;
  if (pgReady) {
    try {
      return await pgGetByEmail('users', authEmail);
    } catch { /* fall through to in-memory */ }
  }
  return usersState.find((u: User) => u.email?.trim().toLowerCase() === authEmail) || null;
}

function isProfileActive(p: User | null): p is User {
  return !!p && !!p.role && (p.status === undefined || p.status === null || p.status === 'active');
}

async function requireSuperadmin(req: any, res: any, next: any) {
  try {
    const profile = await getCallerProfile(req);
    if (!isProfileActive(profile) || profile!.role !== 'superadmin') {
      return res.status(403).json({ success: false, error: 'Forbidden: superadmin access required' });
    }
    (req as any).callerProfile = profile;
    next();
  } catch {
    return res.status(500).json({ success: false, error: 'Authorization check failed' });
  }
}

// superadmin OR admin — used for user directory management
async function requireManagementAccess(req: any, res: any, next: any) {
  try {
    const profile = await getCallerProfile(req);
    if (!isProfileActive(profile) || !['superadmin', 'admin'].includes(profile!.role)) {
      return res.status(403).json({ success: false, error: 'Forbidden: management access required' });
    }
    (req as any).callerProfile = profile;
    next();
  } catch {
    return res.status(500).json({ success: false, error: 'Authorization check failed' });
  }
}

// ============================================================================
// SECURITY: CORS — whitelist only known origins
// MUST be before auth middleware so OPTIONS preflight gets 200, not 401
// ============================================================================
const ALLOWED_ORIGINS = [
  'https://canteen20.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'capacitor://localhost',
  'http://localhost',
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// ============================================================================
// SECURITY: Rate limiting (in-memory, per IP)
// ============================================================================
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW = 60 * 1000;

function rateLimiter(req: any, res: any, next: any) {
  const ip = req.headers['x-forwarded-for']?.toString()?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return next();
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return res.status(429).json({ success: false, error: 'Too many requests. Please try again later.' });
  }
  next();
}

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap) {
    if (now > val.resetAt) rateLimitMap.delete(key);
  }
}, 5 * 60 * 1000);

app.use(rateLimiter);

// ============================================================================
// SECURITY: Security headers
// ============================================================================
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// Apply auth + role checks to protected write endpoints (after CORS so OPTIONS preflight works)
// User directory writes: superadmin OR admin (admins manage their college's accounts)
app.use('/api/users', (req, res, next) => {
  if (req.method === 'GET') return next();
  authMiddleware(req, res, () => requireManagementAccess(req, res, next));
});
// Tenant CRUD writes: superadmin ONLY
app.use('/api/colleges', (req, res, next) => {
  if (req.method === 'GET') return next();
  authMiddleware(req, res, () => requireSuperadmin(req, res, next));
});
app.use('/api/canteens', (req, res, next) => {
  if (req.method === 'GET') return next();
  authMiddleware(req, res, () => requireSuperadmin(req, res, next));
});
app.use('/api/subcanteens', (req, res, next) => {
  if (req.method === 'GET') return next();
  authMiddleware(req, res, () => requireSuperadmin(req, res, next));
});
app.use('/api/canteen/menu', (req, res, next) => {
  if (req.method === 'GET') return next();
  authMiddleware(req, res, next);
});
app.use('/api/canteen/order', (req, res, next) => {
  if (req.method === 'GET') return next();
  if (!req.headers['authorization']) return next();
  authMiddleware(req, res, next);
});
app.use('/api/canteen/ingredients', (req, res, next) => {
  if (req.method === 'GET') return next();
  authMiddleware(req, res, next);
});
app.use('/api/canteen/settings', (req, res, next) => {
  if (req.method === 'GET') return next();
  authMiddleware(req, res, next);
});
app.use('/api/support-tickets', (req, res, next) => {
  if (req.method === 'GET') return next();
  authMiddleware(req, res, next);
});

// Razorpay configuration
const razorpayKeyId = (process.env.RAZORPAY_KEY_ID || '').trim();
const razorpayKeySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
const razorpayConfigured = !!(razorpayKeyId && razorpayKeySecret);

let razorpay: Razorpay | null = null;
if (razorpayConfigured) {
  razorpay = new Razorpay({
    key_id: razorpayKeyId,
    key_secret: razorpayKeySecret,
  });
  console.log(`Razorpay SDK configured (${razorpayKeyId.substring(0, 8)}...).`);
} else {
  console.log('Razorpay keys not configured. Operating with sandbox payment fallback.');
}

// VyaparGateway (UPI Dynamic QR) configuration
const vyaparApiKey = (process.env.VYAPAR_API_KEY || '').trim();
const vyaparMerchantId = (process.env.VYAPAR_MERCHANT_ID || '').trim();
const vyaparSecret = (process.env.VYAPAR_SECRET || '').trim();
const vyaparBaseUrl = (process.env.VYAPAR_BASE_URL || 'https://api.vyapargateway.in').trim();
const vyaparConfigured = !!(vyaparApiKey && vyaparMerchantId && vyaparSecret);

if (vyaparConfigured) {
  console.log(`VyaparGateway configured (merchant: ${vyaparMerchantId.substring(0, 8)}...).`);
} else {
  console.log('VyaparGateway not configured. UPI QR payment will use sandbox fallback.');
}

// ============================================================================
// SERVER-SIDE IMAGE COMPRESSION (reduces payload sizes by 90%+)
// ============================================================================
let sharpLib: any = null;
try {
  sharpLib = require('sharp');
  console.log('sharp loaded for server-side image compression.');
} catch { console.log('sharp not available, skipping server-side image compression.'); }

async function compressBase64Image(dataUrl: string, maxWidth = 300): Promise<string> {
  if (!sharpLib || !dataUrl.startsWith('data:image')) return dataUrl;
  try {
    const matches = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) return dataUrl;
    const buf = Buffer.from(matches[2], 'base64');
    if (buf.length < 30000) return dataUrl; // already small (<30KB), skip
    const resized = await sharpLib(buf)
      .resize({ width: maxWidth, height: maxWidth, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer();
    const smallUrl = `data:image/jpeg;base64,${resized.toString('base64')}`;
    console.log(`Image compressed: ${(buf.length/1024).toFixed(0)}KB -> ${(resized.length/1024).toFixed(0)}KB`);
    return smallUrl;
  } catch (e: any) {
    console.warn('Image compression failed, using original:', e?.message);
    return dataUrl;
  }
}

// ============================================================================
// FIRESTORE READ CACHE (reduces reads by 80-90%)
// ============================================================================
const dataCache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL = 60000; // 60 seconds for static data
const CANTEEN_CACHE_TTL = 30000; // 30 seconds for canteen data

function getCached(key: string): any | null {
  const entry = dataCache.get(key);
  if (entry && Date.now() < entry.expiresAt) return entry.data;
  dataCache.delete(key);
  return null;
}

function setCache(key: string, data: any, ttl: number = CACHE_TTL) {
  dataCache.set(key, { data, expiresAt: Date.now() + ttl });
}

function invalidateCanteenCache(canteenId: string) {
  dataCache.delete(`canteen_${canteenId}`);
}

// Vercel path rewriting middleware to ensure backend routes match Express definitions
if (process.env.VERCEL) {
  app.use((req, res, next) => {
    if (req.url && !req.url.startsWith('/api')) {
      req.url = '/api' + req.url;
    }
    next();
  });
}

app.get('/api/test', async (req, res) => {
  res.json({ success: true, message: "Server is working!", dbConnected: pgReady, postgres: pgReady, envVar: !!process.env.POSTGRES_URL, razorpay: { configured: razorpayConfigured, keyPrefix: razorpayKeyId.substring(0, 8) } });
});

// App version endpoint - bump this to force update popup on all devices
const APP_VERSION = '2.4.0';
const APP_UPDATE_URL = 'https://canteen20.vercel.app';

app.get('/api/app-version', (req, res) => {
  res.json({ version: APP_VERSION, updateUrl: APP_UPDATE_URL });
});

// Initialize PostgreSQL (Supabase)
let pgReady = false;
let pgInitError: string | null = null;
(async () => {
  try {
    pgReady = await isPgAvailable();
    if (pgReady) {
      console.log('PostgreSQL (Supabase) connected successfully!');
      await seedPostgresIfNeeded();
    } else {
      pgInitError = 'POSTGRES_URL not set or connection failed';
      console.warn('PostgreSQL not available. Operating with in-memory state only.');
    }
  } catch (error: any) {
    pgInitError = `PostgreSQL init error: ${error?.message || error}`;
    console.error('Failed to initialize PostgreSQL:', error?.message || error);
  }
})();

// Lazy PG check: if pgReady is stale (new serverless instance), test live
async function ensurePgReady(): Promise<boolean> {
  if (pgReady) return true;
  pgReady = await isPgAvailable();
  return pgReady;
}

// Middleware: ensure pgReady is accurate before every request
app.use(async (_req, _res, next) => {
  if (!pgReady) {
    try { pgReady = await isPgAvailable(); } catch {}
  }
  next();
});

// Initialize Google Gen AI only when needed or gracefully check its existence
let genAI: GoogleGenAI | null = null;
const API_KEY = process.env.GEMINI_API_KEY;

if (API_KEY && API_KEY !== 'MY_GEMINI_API_KEY') {
  try {
    genAI = new GoogleGenAI({
      apiKey: API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    console.log('Google GenAI initialized successfully on the server.');
  } catch (error) {
    console.error('Failed to initialize Google Gen AI:', error);
  }
} else {
  console.log('GEMINI_API_KEY is not configured or holds placeholder. Using simulated AI fallback.');
}

async function seedPostgresIfNeeded() {
  if (!pgReady) return;
  try {
    const items = await pgGetAll('items');
    if (items.length === 0) {
      console.log('Seeding initial menu items to PostgreSQL...');
      for (const item of INITIAL_MENU_ITEMS) {
        await pgSet('items', item.id, item);
      }
    }

    const reviews = await pgGetAll('reviews');
    if (reviews.length === 0) {
      console.log('Seeding initial reviews to PostgreSQL...');
      for (const review of INITIAL_REVIEWS) {
        await pgSet('reviews', review.id, review);
      }
    }

    const orders = await pgGetAll('orders');
    if (orders.length === 0) {
      console.log('Seeding initial orders to PostgreSQL...');
      for (const order of INITIAL_ORDERS) {
        await pgSet('orders', order.id, order);
      }
    }
    console.log('PostgreSQL check/seeding complete.');
  } catch (err) {
    console.error('Error seeding PostgreSQL:', err);
  }
}

/**
 * Resilient Wrapper for Google GenAI generateContent calls.
 * Automatically handles transient Service Interruptions (503) or Rate Limit (429) errors
 * by retrying with the highly responsive and low-congested 'gemini-3.1-flash-lite' model.
 */
async function generateContentWithFallback(params: any): Promise<any> {
  if (!genAI) {
    throw new Error('Google Gen AI client is not initialized');
  }

  const primaryModel = params.model || 'gemini-3.5-flash';
  const backupModel = 'gemini-3.1-flash-lite';

  try {
    return await genAI.models.generateContent(params);
  } catch (error: any) {
    const errorStr = String(error?.message || error || '').toUpperCase();
    const isServiceInterrupted = 
      error?.status === 503 || 
      error?.statusCode === 503 || 
      errorStr.includes('503') || 
      errorStr.includes('UNAVAILABLE') || 
      errorStr.includes('HIGH DEMAND') ||
      errorStr.includes('RESOURCE_EXHAUSTED') ||
      errorStr.includes('429');

    if (isServiceInterrupted && primaryModel !== backupModel) {
      console.warn(`[GEMINI WARNING] Model ${primaryModel} failed with service/rate issue. Attempting transparent fallback to '${backupModel}'...`);
      try {
        const backupParams = { ...params, model: backupModel };
        return await genAI.models.generateContent(backupParams);
      } catch (backupError: any) {
        console.error(`[GEMINI ERROR] Fallback model '${backupModel}' also failed. Error:`, backupError.message || backupError);
        throw error; // throw original
      }
    }
    throw error;
  }
}

// -------------------------------------------------------------
// In-Memory Stateful Database representing our Canteen and User
// -------------------------------------------------------------
const INITIAL_INGREDIENTS: Ingredient[] = [
  { id: 'ing_rice', name: 'Rice', stockGrams: 20000, unit: 'kg' },
  { id: 'ing_veg', name: 'Vegetables', stockGrams: 10000, unit: 'kg' },
  { id: 'ing_sauce', name: 'Sauce', stockGrams: 5000, unit: 'kg' },
  { id: 'ing_egg', name: 'Egg', stockGrams: 150, unit: 'pcs' },
  { id: 'ing_flour', name: 'Wheat Flour', stockGrams: 15000, unit: 'kg' },
  { id: 'ing_potato', name: 'Potatoes', stockGrams: 10000, unit: 'kg' }
];

let canteenSettings: CanteenSettings = {
  noShowMinutes: 30,
  defaultSlotCapacity: 30
};

const INITIAL_MENU_ITEMS: MenuItem[] = [
  {
    id: 'item_001',
    canteenId: 'canteen_001',
    name: 'poori 1 pcs',
    price: 10,
    stock: 25,
    rating: 4.8,
    ratingCount: 142,
    available: true,
    category: 'Meals',
    description: 'Crisp, hot, puffed fried flatbread. Light on the oil, high on taste.',
    imageUrl: 'https://images.unsplash.com/photo-1626132647523-66f5bf380027?q=80&w=600&auto=format&fit=crop',
    tags: ['Best Seller', 'Light', 'Traditional'],
    prepTime: 8,
    dailyLimit: 100,
    bookedToday: 0,
    isPaused: false,
    recipe: [
      { ingredientId: 'ing_flour', amountGrams: 50 },
      { ingredientId: 'ing_potato', amountGrams: 30 }
    ]
  },
  {
    id: 'item_002',
    canteenId: 'canteen_001',
    name: 'chapati (per quantity)',
    price: 20,
    stock: 50,
    rating: 4.9,
    ratingCount: 310,
    available: true,
    category: 'Meals',
    description: 'Single hand-rolled soft wheat flatbread cooked to perfection on flat tawa.',
    imageUrl: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=600&auto=format&fit=crop',
    tags: ['Healthy', 'Homemade'],
    prepTime: 5,
    dailyLimit: 200,
    bookedToday: 0,
    isPaused: false,
    recipe: [
      { ingredientId: 'ing_flour', amountGrams: 40 }
    ]
  },
  {
    id: 'item_003',
    canteenId: 'canteen_001',
    name: 'chicken fried rice',
    price: 80,
    stock: 12,
    rating: 4.6,
    ratingCount: 68,
    available: true,
    category: 'Meals',
    description: 'Perfectly stir-fried basmati rice with tender succulent chicken pieces, spring onions, eggs, and authentic spices.',
    imageUrl: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?q=80&w=600&auto=format&fit=crop',
    tags: ['Heavy', 'Popular'],
    prepTime: 15,
    dailyLimit: 100,
    bookedToday: 0,
    isPaused: false,
    recipe: [
      { ingredientId: 'ing_rice', amountGrams: 250 },
      { ingredientId: 'ing_veg', amountGrams: 100 },
      { ingredientId: 'ing_sauce', amountGrams: 20 },
      { ingredientId: 'ing_egg', amountGrams: 1 }
    ]
  },
  {
    id: 'item_004',
    canteenId: 'canteen_001',
    name: 'veg puffs',
    price: 10,
    stock: 24,
    rating: 4.5,
    ratingCount: 84,
    available: true,
    category: 'Snacks & Beverages',
    description: 'Flaky baked golden pastry triangle layered with delicious mildly-spiked potato and mixed veg filling.',
    imageUrl: 'https://images.unsplash.com/photo-1541532713592-79a0317b6b77?q=80&w=600&auto=format&fit=crop',
    tags: ['Hot Snack', 'Crunchy'],
    prepTime: 10,
    dailyLimit: 120,
    bookedToday: 0,
    isPaused: false,
    recipe: [
      { ingredientId: 'ing_flour', amountGrams: 30 },
      { ingredientId: 'ing_veg', amountGrams: 20 },
      { ingredientId: 'ing_potato', amountGrams: 20 }
    ]
  },
  {
    id: 'item_005',
    canteenId: 'canteen_001',
    name: 'chaki chaki',
    price: 2,
    stock: 150,
    rating: 4.7,
    ratingCount: 290,
    available: true,
    category: 'Snacks & Beverages',
    description: 'Traditional crunchy bite-sized sticks - super addictive snack that will make you ask for more.',
    imageUrl: 'https://images.unsplash.com/photo-1581798459219-318e76aecc7b?q=80&w=600&auto=format&fit=crop',
    tags: ['Pocket Friendly', 'Kids Choice'],
    prepTime: 2,
    dailyLimit: 300,
    bookedToday: 0,
    isPaused: false,
    recipe: [
      { ingredientId: 'ing_flour', amountGrams: 10 }
    ]
  },
  {
    id: 'item_006',
    canteenId: 'canteen_001',
    name: 'egg puffs',
    price: 10,
    stock: 18,
    rating: 4.4,
    ratingCount: 42,
    available: true,
    category: 'Snacks & Beverages',
    description: 'Delectable hot baked folded pastry pocket stuffed with delicious hardboiled egg half and spiced caramelized onions.',
    imageUrl: 'https://images.unsplash.com/photo-1608797178974-15b35a61d121?q=80&w=600&auto=format&fit=crop',
    tags: ['Savory', 'High Protein'],
    prepTime: 10,
    dailyLimit: 80,
    bookedToday: 0,
    isPaused: false,
    recipe: [
      { ingredientId: 'ing_flour', amountGrams: 30 },
      { ingredientId: 'ing_egg', amountGrams: 1 }
    ]
  },
  {
    id: 'item_007',
    canteenId: 'canteen_001',
    name: 'veg biryani',
    price: 89,
    stock: 35,
    rating: 4.7,
    ratingCount: 94,
    available: true,
    category: 'Meals',
    description: 'Aromatic, spice-infused biryani rice slow-cooked on dum. Served without meat, but bursting with full flavors.',
    imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?q=80&w=600&auto=format&fit=crop',
    tags: ['Trending', 'Flavorful', 'Dum Biryani'],
    prepTime: 20,
    dailyLimit: 150,
    bookedToday: 0,
    isPaused: false,
    recipe: [
      { ingredientId: 'ing_rice', amountGrams: 250 },
      { ingredientId: 'ing_veg', amountGrams: 50 },
      { ingredientId: 'ing_sauce', amountGrams: 10 }
    ]
  }
];

const INITIAL_REVIEWS: Review[] = [
  {
    id: 'rev_001',
    userId: 'user_0yq23cEG6ZNs1Dkkm3',
    userName: 'Raju Watson',
    rating: 5,
    comment: 'The chicken fried rice is extremely flavor-packed and large portion! Best on campus.',
    sentiment: 'positive',
    timestamp: '2026-06-05T12:00:00Z',
    menuItemId: 'item_003',
    menuItemName: 'chicken fried rice',
  },
  {
    id: 'rev_002',
    userId: 'user_0E8xcyyh941IWmUi1TQ6N',
    userName: 'Amit Kumar',
    rating: 5,
    comment: 'The poori is so crisp and piping hot! Handed over in literally 2 minutes.',
    sentiment: 'positive',
    timestamp: '2026-06-04T15:30:00Z',
    menuItemId: 'item_001',
    menuItemName: 'poori 1 pcs',
  }
];

const INITIAL_ORDERS: Order[] = [
  {
    id: '2o0Kt5HmX3Co2vPPq32q',
    userId: 'user_0E8xcyyh941IWmUi1TQ6N6M53',
    userName: 'Amit Kumar',
    items: [
      { itemId: 'item_003', name: 'chicken fried rice', price: 80, quantity: 64 }
    ],
    totalPrice: 5120,
    paymentStatus: 'paid',
    paymentMethod: 'UPI Intent (watson777@okaxis)',
    status: 'delivered',
    qrCode: 'QR_2o0Kt5HmX3Co2vPPq32q',
    createdAt: 1762439520000,
    timestamp: '2025-11-06T14:32:00Z',
    pickupTimeText: 'Completed',
    pickupSlot: '12:45 PM',
    prepStartTime: 1762439520000 - 15 * 60 * 1000 - 5 * 60 * 1000,
    expiryTime: 1762439520000 + 30 * 60 * 1000
  },
  {
    id: '0Rj19Bw7lko29u9mWREu',
    userId: 'user_0yq23cEG6ZNs1Dkkm3MtHSYyAjy1',
    userName: 'Raju Watson',
    items: [
      { itemId: 'item_001', name: 'poori 1 pcs', price: 10, quantity: 2 }
    ],
    totalPrice: 20,
    paymentStatus: 'paid',
    paymentMethod: 'Google Pay',
    status: 'preparing',
    qrCode: 'QR_0Rj19Bw7lko29u9mWREu',
    createdAt: 1763118900000,
    timestamp: '2025-11-14T11:15:00Z',
    pickupTimeText: 'Approx. 5 mins remaining',
    pickupSlot: '12:00 PM',
    prepStartTime: 1763118900000 - 8 * 60 * 1000 - 5 * 60 * 1000,
    expiryTime: 1763118900000 + 30 * 60 * 1000
  }
];

let collegesState: College[] = [
  { id: 'college_001', name: 'Engineering College East', location: 'Main Campus', status: 'active' },
  { id: 'college_002', name: 'Science University West', location: 'Tech Campus', status: 'active' }
];

let usersState: User[] = [
  { id: 'user_owner_default', name: 'Chef Watson', email: 'canteen_owner@gmail.com', role: 'owner', canteenId: 'canteen_001', status: 'active' },
  { id: 'user_chef_default', name: 'Kitchen Chef', email: 'chef@gmail.com', role: 'chef', canteenId: 'canteen_001', subCanteenId: 'sub_001', status: 'active' },
  { id: 'user_staff_default', name: 'Counter Staff', email: 'staff@gmail.com', role: 'staff', canteenId: 'canteen_001', subCanteenId: 'sub_001', status: 'active' },
  { id: 'user_admin_default', name: 'College Admin', email: 'college_admin@gmail.com', role: 'admin', collegeId: 'college_001', status: 'active' },
  { id: 'user_super_default', name: 'Food Court Admin', email: 'superadmin@gmail.com', role: 'superadmin', status: 'active' }
];

let subCanteensState: SubCanteen[] = [
  { id: 'sub_001', name: 'North Wing Counter', canteenId: 'canteen_001', status: 'active' },
  { id: 'sub_002', name: 'South Wing Counter', canteenId: 'canteen_001', status: 'active' }
];

let canteensState: Canteen[] = [
  {
    id: 'canteen_001',
    name: 'Esc(Q)',
    collegeId: 'college_001',
    ownerId: 'user_owner_default',
    ownerName: 'Chef Watson',
    status: 'active',
    location: 'Campus Plaza',
    items: [...INITIAL_MENU_ITEMS],
    orders: [...INITIAL_ORDERS],
    reviews: [...INITIAL_REVIEWS],
    ingredients: [...INITIAL_INGREDIENTS],
    settings: canteenSettings,
  }
];

let canteenState: Canteen = canteensState[0];

const LOCAL_DB_PATH = path.join(process.cwd(), 'local_db.json');

function loadLocalDB() {
  if (fs.existsSync(LOCAL_DB_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(LOCAL_DB_PATH, 'utf8'));
      if (data.colleges) collegesState = data.colleges;
      if (data.users) usersState = data.users;
      if (data.subCanteens) subCanteensState = data.subCanteens;
      if (data.canteens) canteensState = data.canteens;
      console.log('Loaded local DB from local_db.json');
    } catch (e) {
      console.error('Failed to parse local DB file, using default memory state', e);
    }
  }
}

function saveLocalDB() {
  try {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify({
      colleges: collegesState,
      users: usersState,
      subCanteens: subCanteensState,
      canteens: canteensState
    }, null, 2));
  } catch (e) {
    console.error('Failed to write to local DB file', e);
  }
}

loadLocalDB();

function getCanteenState(canteenId: string): Canteen {
  let c = canteensState.find(x => x.id === canteenId);
  if (!c) {
    c = {
      id: canteenId,
      name: 'Default Canteen',
      collegeId: 'college_001',
      ownerId: 'user_owner_default',
      ownerName: 'Chef Watson',
      status: 'active',
      items: [],
      orders: [],
      reviews: [],
      ingredients: [],
      settings: { noShowMinutes: 30, defaultSlotCapacity: 30, canteenId }
    };
    canteensState.push(c);
  }
  return c;
}

// -------------------------------------------------------------
// REST API ENDPOINTS
// -------------------------------------------------------------

// 0. User Authentication (Register & Login)
app.post('/api/auth/register', async (req, res) => {
  if (!ensureSupabaseClients()) return supabaseNotConfigured(res);
  const { name, email, password, phone, registerNumber, collegeId } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, error: 'Name, email, and password are required.' });
  }

  // SECURITY: Password strength validation
  if (password.length < 6) {
    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters.' });
  }

  // SECURITY: Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, error: 'Invalid email format.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (pgReady) {
    try {
      // Check if user already exists in public.users
      const existingUser = await pgGetByEmail('users', normalizedEmail);
      if (existingUser) {
        return res.status(400).json({ success: false, error: 'User with this email already exists.' });
      }

      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: {
          name,
          phone: phone || '',
          register_number: registerNumber || '',
          college_id: collegeId || ''
        }
      });

      if (authError) {
        if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
          return res.status(400).json({ success: false, error: 'User with this email already exists.' });
        }
        console.error('Supabase Auth createUser error:', authError);
        return res.status(500).json({ success: false, error: 'Failed to create user account.' });
      }

      const authUser = authData.user;
      if (!authUser) {
        return res.status(500).json({ success: false, error: 'Failed to create user account.' });
      }

      // Get the public user profile (created by DB trigger)
      let publicUser = await pgGetByEmail('users', normalizedEmail);
      
      // If trigger hasn't run yet, wait a bit and retry
      if (!publicUser) {
        await new Promise(r => setTimeout(r, 500));
        publicUser = await pgGetByEmail('users', normalizedEmail);
      }

      // Sign in to get session tokens
      const { data: sessionData, error: sessionError } = await supabaseClient.auth.signInWithPassword({
        email: normalizedEmail,
        password
      });

      if (sessionError || !sessionData.session) {
        console.error('Supabase signIn after register error:', sessionError);
        return res.status(500).json({ success: false, error: 'Account created but failed to sign in.' });
      }

      return res.json({ 
        success: true, 
        token: sessionData.session.access_token,
        refreshToken: sessionData.session.refresh_token,
        user: publicUser ? { 
          id: publicUser.id, 
          name: publicUser.name, 
          email: publicUser.email, 
          role: publicUser.role,
          collegeId: publicUser.collegeId,
          canteenId: publicUser.canteenId,
          subCanteenId: publicUser.subCanteenId,
          phone: publicUser.phone,
          registerNumber: publicUser.registerNumber
        } : { 
          id: authUser.id, 
          name, 
          email: normalizedEmail, 
          role: 'customer',
          phone: phone || '',
          registerNumber: registerNumber || '',
          collegeId: collegeId || ''
        }
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, error: 'Server authentication database error.' });
    }
  }

  // Fallback for when PostgreSQL is not ready (should rarely happen)
  return res.status(503).json({ success: false, error: 'Database temporarily unavailable. Please try again.' });
});

app.post('/api/auth/login', async (req, res) => {
  if (!ensureSupabaseClients()) return supabaseNotConfigured(res);
  const { email, password } = req.body;
  console.log('--- LOGIN ATTEMPT ---', { email });
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    // Verify credentials with Supabase Auth (but don't create session yet for superadmin)
    const { data: verifyData, error: verifyError } = await supabaseClient.auth.signInWithPassword({
      email: normalizedEmail,
      password
    });

    if (verifyError) {
      console.log('--- LOGIN FAILED (Auth) ---', { email: normalizedEmail, error: verifyError.message });
      return res.status(400).json({ success: false, error: 'Incorrect email or password.' });
    }

    if (!verifyData.user) {
      return res.status(400).json({ success: false, error: 'Authentication failed.' });
    }

    // Get user profile from public.users
    let publicUser = await pgGetByEmail('users', normalizedEmail);
    
    if (!publicUser) {
      // User exists in Supabase Auth but not in public.users (shouldn't happen with trigger)
      // Create minimal profile
      publicUser = {
        id: verifyData.user.id,
        name: verifyData.user.user_metadata?.name || 'User',
        email: normalizedEmail,
        role: 'customer',
        collegeId: verifyData.user.user_metadata?.college_id || '',
        canteenId: '',
        subCanteenId: '',
        phone: verifyData.user.user_metadata?.phone || '',
        registerNumber: verifyData.user.user_metadata?.register_number || ''
      };
    }

    // Check if superadmin - require OTP verification before issuing tokens
    if (publicUser.role === 'superadmin' && normalizedEmail === SUPERADMIN_CHECK_EMAIL) {
      console.log('--- LOGIN PENDING OTP (Superadmin) ---', { email: publicUser.email });
      // Sign out the temporary session
      await supabaseClient.auth.signOut();
      return res.json({ 
        success: true, 
        pendingOtp: true,
        user: { 
          id: publicUser.id, 
          name: publicUser.name, 
          email: publicUser.email, 
          role: publicUser.role,
          collegeId: publicUser.collegeId,
          canteenId: publicUser.canteenId,
          subCanteenId: publicUser.subCanteenId,
          phone: publicUser.phone,
          registerNumber: publicUser.registerNumber
        }
      });
    }

    // For non-superadmin, create full session and return tokens
    const { data: sessionData, error: sessionError } = await supabaseClient.auth.signInWithPassword({
      email: normalizedEmail,
      password
    });

    if (sessionError || !sessionData.session) {
      return res.status(400).json({ success: false, error: 'Failed to create session.' });
    }

    console.log('--- LOGIN SUCCESS ---', { email: publicUser.email, role: publicUser.role });
    return res.json({ 
      success: true, 
      token: sessionData.session.access_token,
      refreshToken: sessionData.session.refresh_token,
      user: { 
        id: publicUser.id, 
        name: publicUser.name, 
        email: publicUser.email, 
        role: publicUser.role,
        collegeId: publicUser.collegeId,
        canteenId: publicUser.canteenId,
        subCanteenId: publicUser.subCanteenId,
        phone: publicUser.phone,
        registerNumber: publicUser.registerNumber
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, error: 'Server authentication error.' });
  }
});

// ============================================================================
// OTP VERIFICATION FOR SUPERADMIN LOGIN (PostgreSQL-backed)
// ============================================================================

const SUPERADMIN_EMAIL = 'usrinivasan240@gmail.com';
const SUPERADMIN_CHECK_EMAIL = 'superadmin@gmail.com';
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes

app.post('/api/auth/generate-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, error: 'Email required' });
  const normalizedEmail = email.trim().toLowerCase();

  // Verify user is superadmin
  if (normalizedEmail !== SUPERADMIN_CHECK_EMAIL) {
    return res.status(403).json({ success: false, error: 'OTP verification only required for superadmin accounts.' });
  }

  // Generate 6-digit OTP using crypto
  const code = crypto.randomInt(100000, 999999).toString();
  const expiresAt = Date.now() + OTP_TTL_MS;

  // Store OTP in PostgreSQL (persists across serverless instances)
  try {
    await execute(
      `INSERT INTO otp_store (email, code, expires_at, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO UPDATE SET code = $2, expires_at = $3, created_at = $4`,
      [normalizedEmail, code, expiresAt, Date.now()]
    );
  } catch (err) {
    console.error('Failed to store OTP in PostgreSQL:', err);
    return res.status(500).json({ success: false, error: 'Failed to generate OTP. Please try again.' });
  }

  console.log(`\n========================================`);
  console.log(`OTP for superadmin login: ${code}`);
  console.log(`Email: ${SUPERADMIN_EMAIL}`);
  console.log(`Expires in 5 minutes`);
  console.log(`========================================\n`);

  // Send OTP via email (await before responding)
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const emailResp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
           from: 'Esc(Q) <onboarding@resend.dev>',
          to: [SUPERADMIN_EMAIL],
           subject: 'Esc(Q) - Superadmin Login OTP',
           html: `<div style="font-family:sans-serif;text-align:center;padding:20px;max-width:400px;margin:0 auto"><div style="background:#7c3aed;color:white;padding:15px;border-radius:16px 16px 0 0"><h2 style="margin:0">Esc(Q)</h2></div><div style="background:#f8f7ff;padding:30px;border-radius:0 0 16px 16px;border:1px solid #e5e1f0"><p style="color:#555;font-size:14px">Your superadmin login OTP is:</p><div style="font-size:36px;letter-spacing:10px;color:#7c3aed;background:#f3f0ff;padding:20px;border-radius:12px;font-weight:bold;margin:15px 0">${code}</div><p style="color:#999;font-size:12px">Valid for 5 minutes. Do not share this code.</p></div></div>`
        })
      });
      const emailResult = await emailResp.text();
      console.log('Resend API response:', emailResult);
      if (!emailResp.ok) {
        console.error('Email send failed:', emailResult);
      }
    } catch (e) {
      console.error('Resend error:', e);
    }
  } else {
    console.log('RESEND_API_KEY not set. OTP:', code);
  }

  res.json({ success: true, message: `OTP sent to ${SUPERADMIN_EMAIL}` });
});

app.post('/api/auth/verify-otp', async (req, res) => {
  if (!ensureSupabaseClients()) return supabaseNotConfigured(res);
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ success: false, error: 'Email and OTP required' });
  const normalizedEmail = email.trim().toLowerCase();

  // Read OTP from PostgreSQL
  let stored: any = null;
  try {
    const rows = await query('SELECT * FROM otp_store WHERE email = $1', [normalizedEmail]);
    if (rows.length > 0) stored = rows[0];
  } catch (err) {
    console.error('Failed to read OTP from PostgreSQL:', err);
    return res.status(500).json({ success: false, error: 'Failed to verify OTP. Please try again.' });
  }

  if (!stored) {
    return res.status(400).json({ success: false, error: 'No OTP generated. Please request a new one.' });
  }
  if (Date.now() > stored.expires_at) {
    await execute('DELETE FROM otp_store WHERE email = $1', [normalizedEmail]).catch(() => {});
    return res.status(400).json({ success: false, error: 'OTP expired. Please request a new one.' });
  }

  // Compare OTP (strip whitespace)
  const inputOtp = otp.replace(/\s/g, '').trim();
  if (stored.code !== inputOtp) {
    return res.status(400).json({ success: false, error: 'Invalid OTP. Please try again.' });
  }

  // Delete used OTP
  await execute('DELETE FROM otp_store WHERE email = $1', [normalizedEmail]).catch(() => {});

  // Get password from request body (sent by frontend during OTP flow)
  const { password } = req.body;
  
  if (!password) {
    return res.status(400).json({ success: false, error: 'Password required for session creation.' });
  }

  // Sign in with Supabase to get session tokens
  const { data: sessionData, error: sessionError } = await supabaseClient.auth.signInWithPassword({
    email: normalizedEmail,
    password
  });

  if (sessionError || !sessionData.session || !sessionData.user) {
    console.error('Session creation after OTP failed:', sessionError);
    return res.status(500).json({ success: false, error: 'Failed to create session after OTP verification.' });
  }

  // Get user profile from public.users
  let publicUser = await pgGetByEmail('users', normalizedEmail);
  
  if (!publicUser) {
    publicUser = {
      id: sessionData.user.id,
      name: sessionData.user.user_metadata?.name || 'User',
      email: normalizedEmail,
      role: 'superadmin',
      collegeId: sessionData.user.user_metadata?.college_id || '',
      canteenId: '',
      subCanteenId: '',
      phone: sessionData.user.user_metadata?.phone || '',
      registerNumber: sessionData.user.user_metadata?.register_number || ''
    };
  }

  console.log('--- LOGIN SUCCESS (Superadmin OTP) ---', { email: publicUser.email, role: publicUser.role });
  res.json({ 
    success: true, 
    token: sessionData.session.access_token,
    refreshToken: sessionData.session.refresh_token,
    user: { 
      id: publicUser.id, 
      name: publicUser.name, 
      email: publicUser.email, 
      role: publicUser.role,
      collegeId: publicUser.collegeId,
      canteenId: publicUser.canteenId,
      subCanteenId: publicUser.subCanteenId,
      phone: publicUser.phone,
      registerNumber: publicUser.registerNumber
    }
  });
});

// ============================================================================
// SUPER ADMIN ENDPOINTS
// ============================================================================

// --- Colleges CRUD ---
app.get('/api/colleges', async (req, res) => {
  const cached = getCached('colleges');
  if (cached) return res.json({ success: true, colleges: cached });
  if (pgReady) {
    try {
      const list = await pgGetAll('colleges');
      if (list.length > 0) {
        setCache('colleges', list);
        return res.json({ success: true, colleges: list });
      }
    } catch (e) {
      console.error(e);
    }
  }
  res.json({ success: true, colleges: collegesState });
});

app.post('/api/colleges', async (req, res) => {
  const college = req.body as College;
  if (!college.name) return res.status(400).json({ success: false, error: 'Name is required' });
  if (!college.id) college.id = `college_${Date.now()}`;
  if (!college.status) college.status = 'active';

  if (pgReady) {
    try {
      await pgSet('colleges', college.id, college);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ success: false, error: 'DB Save failed' });
    }
  }
  const idx = collegesState.findIndex(c => c.id === college.id);
  if (idx !== -1) {
    collegesState[idx] = college;
  } else {
    collegesState.push(college);
  }
  saveLocalDB();
  res.json({ success: true, college });
});

app.put('/api/colleges/:id/logo', async (req, res) => {
  const { id } = req.params;
  const { logoUrl } = req.body;
  if (!logoUrl) return res.status(400).json({ success: false, error: 'logoUrl is required' });
  
  let compressed: string;
  try {
    compressed = await compressBase64Image(logoUrl, 400);
  } catch (e: any) {
    console.error('Logo compression failed:', e?.message);
    compressed = logoUrl; // use original if compression fails
  }
  
  if (pgReady) {
    try {
      await pgUpdate('colleges', id, { logoUrl: compressed });
      console.log(`Logo saved for college ${id}, size: ${(compressed.length/1024).toFixed(0)}KB`);
    } catch (e: any) {
      console.error('PostgreSQL logo save error:', e?.message || e);
      return res.status(500).json({ success: false, error: 'Failed to save logo to database. Image may be too large.' });
    }
  } else {
    return res.status(500).json({ success: false, error: 'Database not connected' });
  }
  
  const idx = collegesState.findIndex(c => c.id === id);
  if (idx !== -1) collegesState[idx] = { ...collegesState[idx], logoUrl: compressed };
  dataCache.delete('colleges');
  res.json({ success: true, message: 'Logo saved successfully' });
});

app.put('/api/colleges/:id/banner', async (req, res) => {
  const { id } = req.params;
  const { bannerUrl, bannerSubtitle, bannerFeatures } = req.body;
  const updates: any = {};
  if (bannerUrl !== undefined) {
    try {
      updates.bannerUrl = await compressBase64Image(bannerUrl, 800);
    } catch (e: any) {
      console.error('Banner compression failed:', e?.message);
      updates.bannerUrl = bannerUrl;
    }
  }
  if (bannerSubtitle !== undefined) updates.bannerSubtitle = bannerSubtitle;
  if (bannerFeatures !== undefined) updates.bannerFeatures = bannerFeatures;
  if (Object.keys(updates).length === 0) return res.status(400).json({ success: false, error: 'No fields to update' });
  if (pgReady) {
    try {
      await pgUpdate('colleges', id, updates);
      console.log(`Banner saved for college ${id}`);
    } catch (e: any) {
      console.error('PostgreSQL banner save error:', e?.message || e);
      return res.status(500).json({ success: false, error: 'Failed to save banner. Image may be too large.' });
    }
  } else {
    return res.status(500).json({ success: false, error: 'Database not connected' });
  }
  const idx = collegesState.findIndex(c => c.id === id);
  if (idx !== -1) collegesState[idx] = { ...collegesState[idx], ...updates };
  dataCache.delete('colleges');
  res.json({ success: true, message: 'Banner saved successfully' });
});

// College Branding - Full A-to-Z customer page customization
app.put('/api/colleges/:id/branding', async (req, res) => {
  const { id } = req.params;
  const branding = req.body;
  if (!branding || typeof branding !== 'object') {
    return res.status(400).json({ success: false, error: 'Branding object is required' });
  }
  if (pgReady) {
    try {
      await pgUpdate('colleges', id, { branding });
      console.log(`Branding updated for college: ${id}`);
    } catch (e) {
      console.error('Branding save error:', e);
      return res.status(500).json({ success: false, error: 'DB update failed' });
    }
  }
  const idx = collegesState.findIndex(c => c.id === id);
  if (idx !== -1) collegesState[idx] = { ...collegesState[idx], branding };
  dataCache.delete('colleges');
  res.json({ success: true, branding });
});

app.put('/api/colleges/:id', async (req, res) => {
  const { id } = req.params;
  const { name, location } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, error: 'College name is required' });
  }
  if (pgReady) {
    try {
      const existing = await pgGetById('colleges', id);
      if (!existing) {
        return res.status(404).json({ success: false, error: 'College not found' });
      }
      const updated = { ...existing, name, location: location ?? existing.location, updatedAt: new Date().toISOString() };
      await pgUpdate('colleges', id, updated);
    } catch (e) {
      console.error('College update error:', e);
      return res.status(500).json({ success: false, error: 'DB update failed' });
    }
  }
  const idx = collegesState.findIndex(c => c.id === id);
  if (idx !== -1) {
    collegesState[idx] = { ...collegesState[idx], name, location: location ?? collegesState[idx].location };
  }
  dataCache.delete('colleges');
  saveLocalDB();
  res.json({ success: true });
});

app.delete('/api/colleges/:id', async (req, res) => {
  const { id } = req.params;
  if (pgReady) {
    try {
      await pgDelete('colleges', id);
    } catch (e) {
      console.error(e);
    }
  }
  dataCache.delete('colleges');
  collegesState = collegesState.filter(c => c.id !== id);
  saveLocalDB();
  res.json({ success: true });
});

// --- Canteens CRUD ---
app.get('/api/canteens', async (req, res) => {
  const cached = getCached('canteens');
  if (cached) return res.json({ success: true, canteens: cached });
  if (pgReady) {
    try {
      const list = await pgGetAll('canteens');
      setCache('canteens', list);
      return res.json({ success: true, canteens: list });
    } catch (e) {
      console.error(e);
    }
  }
  res.json({ success: true, canteens: canteensState });
});

app.post('/api/canteens', async (req, res) => {
  const canteenData = req.body as Canteen;
  if (!canteenData.name || !canteenData.collegeId) {
    return res.status(400).json({ success: false, error: 'Name and College ID are required' });
  }
  if (!canteenData.id) canteenData.id = `canteen_${Date.now()}`;
  if (!canteenData.status) canteenData.status = 'active';

  if (pgReady) {
    try {
      await pgSet('canteens', canteenData.id, canteenData);
      
      // Auto-seed default settings
      const settingsDocId = `settings_${canteenData.id}`;
      const existingSettings = await pgGetById('settings', settingsDocId);
      if (!existingSettings) {
        await pgSet('settings', settingsDocId, {
          noShowMinutes: 30,
          defaultSlotCapacity: 30,
          canteenId: canteenData.id
        });
      }

      // Auto-seed default ingredients
      const existingIngs = await pgGetWhere('ingredients', { canteenId: canteenData.id });
      if (existingIngs.length === 0) {
        for (const ing of INITIAL_INGREDIENTS) {
          await pgSet('ingredients', `${ing.id}_${canteenData.id}`, { ...ing, id: `${ing.id}_${canteenData.id}`, canteenId: canteenData.id });
        }
      }
    } catch (e) {
      console.error(e);
      return res.status(500).json({ success: false, error: 'DB Save failed' });
    }
  }

  const idx = canteensState.findIndex(c => c.id === canteenData.id);
  if (idx !== -1) {
    canteensState[idx] = { ...canteensState[idx], ...canteenData };
  } else {
    canteensState.push({
      ...canteenData,
      items: [],
      orders: [],
      reviews: [],
      ingredients: INITIAL_INGREDIENTS.map(ing => ({ ...ing, id: `${ing.id}_${canteenData.id}`, canteenId: canteenData.id })),
      settings: { noShowMinutes: 30, defaultSlotCapacity: 30, canteenId: canteenData.id }
    });
  }
  dataCache.delete('canteens');
  saveLocalDB();
  res.json({ success: true, canteen: getCanteenState(canteenData.id) });
});

app.post('/api/canteen/update-name', async (req, res) => {
  const { canteenId, name } = req.body;
  if (!canteenId || !name) {
    return res.status(400).json({ success: false, error: 'canteenId and name are required.' });
  }
  if (pgReady) {
    try {
      await pgUpdate('canteens', canteenId, { name });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ success: false, error: 'Failed to update canteen name in database.' });
    }
  }
  const c = getCanteenState(canteenId);
  c.name = name;
  saveLocalDB();
  res.json({ success: true, name });
});

app.put('/api/canteens/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body as Partial<{ name: string; collegeId: string; ownerName: string; location: string; status: string }>;
  if (!updates || Object.keys(updates).length === 0) {
    return res.status(400).json({ success: false, error: 'No updates provided.' });
  }
  const allowedFields = ['name', 'collegeId', 'ownerName', 'location', 'status'];
  const cleanUpdates: Record<string, string> = {};
  for (const [k, v] of Object.entries(updates)) {
    if (allowedFields.includes(k) && typeof v === 'string') cleanUpdates[k] = v;
  }
  if (Object.keys(cleanUpdates).length === 0) {
    return res.status(400).json({ success: false, error: 'No valid fields to update.' });
  }
  if (pgReady) {
    try {
      await pgUpdate('canteens', id, cleanUpdates);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ success: false, error: 'Failed to update canteen.' });
    }
  }
  const idx = canteensState.findIndex(c => c.id === id);
  if (idx !== -1) canteensState[idx] = { ...canteensState[idx], ...cleanUpdates };
  dataCache.delete('canteens');
  saveLocalDB();
  res.json({ success: true, canteen: canteensState[idx] || cleanUpdates });
});

app.delete('/api/canteens/:id', async (req, res) => {
  const { id } = req.params;
  if (pgReady) {
    try {
      await pgDelete('canteens', id);
    } catch (e) {
      console.error(e);
    }
  }
  dataCache.delete('canteens');
  dataCache.delete(`canteen_${id}`);
  canteensState = canteensState.filter(c => c.id !== id);
  saveLocalDB();
  res.json({ success: true });
});

// --- Sub-Canteens CRUD ---
app.get('/api/subcanteens', async (req, res) => {
  const cached = getCached('subcanteens');
  if (cached) return res.json({ success: true, subCanteens: cached });
  if (pgReady) {
    try {
      const list = await pgGetAll('subcanteens');
      setCache('subcanteens', list);
      return res.json({ success: true, subCanteens: list });
    } catch (e) {
      console.error(e);
    }
  }
  res.json({ success: true, subCanteens: subCanteensState });
});

app.post('/api/subcanteens', async (req, res) => {
  const sub = req.body as SubCanteen;
  if (!sub.name || !sub.canteenId) {
    return res.status(400).json({ success: false, error: 'Name and Canteen ID are required' });
  }
  if (!sub.id) sub.id = `sub_${Date.now()}`;
  if (!sub.status) sub.status = 'active';

  if (pgReady) {
    try {
      await pgSet('subcanteens', sub.id, sub);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ success: false, error: 'DB Save failed' });
    }
  }
  const idx = subCanteensState.findIndex(s => s.id === sub.id);
  if (idx !== -1) {
    subCanteensState[idx] = sub;
  } else {
    subCanteensState.push(sub);
  }
  dataCache.delete('subcanteens');
  saveLocalDB();
  res.json({ success: true, subCanteen: sub });
});

app.put('/api/subcanteens/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body as Partial<{ name: string; canteenId: string; status: string }>;
  if (!updates || Object.keys(updates).length === 0) {
    return res.status(400).json({ success: false, error: 'No updates provided.' });
  }
  const allowedFields = ['name', 'canteenId', 'status'];
  const cleanUpdates: Record<string, string> = {};
  for (const [k, v] of Object.entries(updates)) {
    if (allowedFields.includes(k) && typeof v === 'string') cleanUpdates[k] = v;
  }
  if (Object.keys(cleanUpdates).length === 0) {
    return res.status(400).json({ success: false, error: 'No valid fields to update.' });
  }
  if (pgReady) {
    try {
      await pgUpdate('subcanteens', id, cleanUpdates);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ success: false, error: 'Failed to update sub-canteen.' });
    }
  }
  const idx = subCanteensState.findIndex(s => s.id === id);
  if (idx !== -1) subCanteensState[idx] = { ...subCanteensState[idx], ...cleanUpdates } as SubCanteen;
  dataCache.delete('subcanteens');
  saveLocalDB();
  res.json({ success: true, subCanteen: subCanteensState[idx] || cleanUpdates });
});

app.delete('/api/subcanteens/:id', async (req, res) => {
  const { id } = req.params;
  if (pgReady) {
    try {
      await pgDelete('subcanteens', id);
    } catch (e) {
      console.error(e);
    }
  }
  subCanteensState = subCanteensState.filter(s => s.id !== id);
  dataCache.delete('subcanteens');
  saveLocalDB();
  res.json({ success: true });
});

app.get('/api/users', async (req, res) => {
  const cached = getCached('users');
  if (cached) return res.json({ success: true, users: cached });
  if (pgReady) {
    try {
      const allUsers = await pgGetAll('users');
      const list = allUsers.map((u: any) => {
        return { id: u.id, name: u.name, email: u.email, role: u.role, collegeId: u.collegeId, canteenId: u.canteenId, subCanteenId: u.subCanteenId, status: u.status, posting: u.posting };
      });
      return res.json({ success: true, users: list });
    } catch (e) {
      console.error(e);
    }
  }
  // Fallback default users — strip passwords
  res.json({
    success: true,
    users: usersState.map(({ password: _pw, ...u }) => u)
  });
});

app.post('/api/users', async (req, res) => {
  const user = req.body as User;
  if (!user.name || !user.email || !user.role) {
    return res.status(400).json({ success: false, error: 'Name, email, and role are required' });
  }
  if (!ensureSupabaseClients()) {
    return supabaseNotConfigured(res);
  }
  const emailKey = user.email.trim().toLowerCase();
  if (!user.id) user.id = `user_${Date.now()}`;
  if (!user.status) user.status = 'active';
  if (!user.password) user.password = 'changeme_' + Math.random().toString(36).substring(2, 10);
  const rawPassword = user.password;

  // Create the Supabase Auth account first (without it the profile can never log in).
  let authUserId: string | null = null;
  try {
    // Reuse an existing profile's id when the email is already registered
    let existing: any = null;
    try { existing = pgReady ? await pgGetByEmail('users', emailKey) : null; } catch { existing = null; }

    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: emailKey,
      password: rawPassword,
      email_confirm: true,
      user_metadata: {
        name: user.name,
        phone: user.phone,
        register_number: user.registerNumber,
        college_id: user.collegeId,
        role: user.role
      }
    });
    if (authErr && !/already|registered|exists/i.test(authErr.message || '')) {
      console.error('[users] Supabase Auth createUser failed:', authErr.message);
    }
    if (authData?.user?.id) {
      authUserId = authData.user.id;
    } else if (existing?.id) {
      authUserId = existing.id;
      // Account exists but may have a stale password — keep it in sync with what we return
      await supabaseAdmin.auth.admin.updateUserById(existing.id, { password: rawPassword }).catch((e: any) => console.error('[users] password sync failed:', e?.message));
    }
  } catch (e: any) {
    if (!/already|registered|exists/i.test(e?.message || '')) {
      console.error('[users] Supabase Auth createUser failed:', e?.message);
    }
  }
  if (authUserId) user.id = authUserId;

  if (pgReady) {
    try {
      const { password: _pw, ...userWithoutPassword } = user;
      // pgSet forces row.id = key param; if the auth trigger already inserted
      // a profile (UUID id), reuse that row's id so the email UNIQUE holds.
      const existingProfile = await pgGetByEmail('users', emailKey);
      const rowKey = existingProfile?.id || authUserId || emailKey;
      await pgSet('users', rowKey, { ...userWithoutPassword, password: hashPassword(rawPassword) });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ success: false, error: 'DB Save failed' });
    }
  }

  // Update local in-memory fallback state (hash password for local storage)
  const hashedUser = { ...user, password: hashPassword(rawPassword) };
  const idx = usersState.findIndex(u => u.email.toLowerCase() === emailKey);
  if (idx !== -1) {
    usersState[idx] = { ...usersState[idx], ...hashedUser };
  } else {
    usersState.push(hashedUser);
  }

  dataCache.delete('users');
  saveLocalDB();
  const { password: _pw, ...safeUser } = user;
  res.json({ success: true, user: safeUser });
});

app.delete('/api/users/:email', async (req, res) => {
  const { email } = req.params;
  const emailKey = email.trim().toLowerCase();

  // Look up the profile BEFORE deleting so we can find the auth account id
  let profile: any = null;
  if (pgReady) {
    try { profile = await pgGetByEmail('users', emailKey); } catch { profile = null; }
  }
  if (!profile) {
    profile = usersState.find((u: User) => u.email?.toLowerCase() === emailKey) || null;
  }

  // Delete from PostgreSQL
  if (pgReady) {
    try {
      await execute('DELETE FROM users WHERE email = $1', [emailKey]);
    } catch (e) {
      console.error(e);
    }
  }

  // Delete the Supabase Auth account (otherwise the login fallback re-provisions the profile)
  if (ensureSupabaseClients() && profile?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(profile.id)) {
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(profile.id);
    if (delErr) console.error('[users] auth deleteUser failed:', delErr.message);
  }

  usersState = usersState.filter(u => u.email.toLowerCase() !== emailKey);
  dataCache.delete('users');
  saveLocalDB();
  res.json({ success: true });
});

app.put('/api/users/:email/role', async (req, res) => {
  const { email } = req.params;
  const { role, posting, name, collegeId, canteenId, subCanteenId, status, password } = req.body;
  const emailKey = email.trim().toLowerCase();
  const caller: User | undefined = (req as any).callerProfile;

  if (!role) {
    return res.status(400).json({ success: false, error: 'Role is required' });
  }

  // Escalation guard: only superadmin may grant admin/superadmin roles
  if (caller && caller.role !== 'superadmin' && ['admin', 'superadmin'].includes(role)) {
    return res.status(403).json({ success: false, error: 'Only superadmin can assign this role' });
  }

  const updates: Record<string, string> = { role };
  if (posting !== undefined) updates.posting = posting;
  if (name) updates.name = name;
  if (collegeId !== undefined) updates.collegeId = collegeId;
  if (canteenId !== undefined) updates.canteenId = canteenId;
  if (subCanteenId !== undefined) updates.subCanteenId = subCanteenId;
  if (status) updates.status = status;
  if (password) updates.password = hashPassword(password);

  // Prevent admins from modifying superadmin/admin accounts
  let targetProfile: any = null;
  try {
    targetProfile = pgReady ? await pgGetByEmail('users', emailKey) : null;
  } catch { targetProfile = null; }
  if (!targetProfile) {
    targetProfile = usersState.find((u: User) => u.email?.toLowerCase() === emailKey) || null;
  }
  if (targetProfile && ['admin', 'superadmin'].includes(targetProfile.role) && caller && caller.role !== 'superadmin') {
    return res.status(403).json({ success: false, error: 'Only superadmin can modify this account' });
  }

  if (pgReady) {
    try {
      await execute('UPDATE users SET role = $1, posting = COALESCE($2, posting), name = COALESCE($3, name), college_id = COALESCE($4, college_id), canteen_id = COALESCE($5, canteen_id), sub_canteen_id = COALESCE($6, sub_canteen_id), status = COALESCE($7, status), password = COALESCE($8, password) WHERE email = $9',
        [role, posting || null, name || null, collegeId !== undefined ? collegeId : null, canteenId !== undefined ? canteenId : null, subCanteenId !== undefined ? subCanteenId : null, status || null, password ? hashPassword(password) : null, emailKey]);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ success: false, error: 'Failed to update user in DB' });
    }
  }

  // Keep the Supabase Auth account in sync (role metadata + password reset)
  if (ensureSupabaseClients() && (password || name || role || collegeId)) {
    try {
      let authId: string | null = targetProfile?.id || null;
      if (!authId) {
        // Profile missing/legacy id — resolve via auth user list by email
        const { data } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        const match = (data?.users || []).find((u: SupabaseUser) => u.email?.trim().toLowerCase() === emailKey);
        authId = match?.id || null;
      }
      if (authId && /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(authId)) {
        const attrs: any = {};
        if (password) attrs.password = password;
        attrs.user_metadata = { ...(targetProfile ? {} : {}), ...(name ? { name } : {}), role, college_id: collegeId !== undefined ? collegeId : targetProfile?.collegeId };
        const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(authId, attrs);
        if (updErr) console.error('[users] auth updateUserById failed:', updErr.message);
      }
    } catch (e: any) {
      console.error('[users] auth sync failed:', e?.message);
    }
  }

  const idx = usersState.findIndex(u => u.email.toLowerCase() === emailKey);
  if (idx !== -1) {
    usersState[idx] = { ...usersState[idx], ...updates };
  }

  dataCache.delete('users');
  saveLocalDB();
  return res.json({ success: true, message: 'User updated successfully' });
});


// 1. Get entire canteen info (Menu, live orders, reviews, settings, ingredients)
app.get('/api/canteen', async (req, res) => {
  const canteenId = (req.query.canteenId as string) || 'canteen_001';
  const cacheKey = `canteen_${canteenId}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json({ success: true, canteen: cached });

  await checkExpiredOrders();
  if (pgReady) {
    try {
      // Each query wrapped individually - one failure won't kill all
      let items: MenuItem[] = [];
      try {
        items = await pgGetWhere('items', { canteenId }) as MenuItem[];
        if (items.length === 0) {
          items = await pgGetWhereOrdered('items', { canteenId: 'canteen_001' }, 'id', 'asc', 100) as MenuItem[];
        }
        if (items.length === 0) {
          items = (await query('SELECT * FROM items LIMIT 200')).map((r: any) => {
            const { created_at, updated_at, ...rest } = r;
            return rest;
          }) as MenuItem[];
        }
      } catch (e) { console.warn('Items query failed:', e); }

      let orders: Order[] = [];
      try {
        orders = await pgGetWhereOrdered('orders', { canteenId }, 'created_at', 'desc', 50) as Order[];
        orders = orders.map(o => {
          if (!o.qrPayload) o.qrPayload = generateSignedQR(o.id);
          return o;
        });
      } catch (e) {
        console.warn('Orders query failed:', e);
      }

      let reviews: Review[] = [];
      try {
        reviews = await pgGetWhereOrdered('reviews', { canteenId }, 'created_at', 'desc', 20) as Review[];
      } catch (e) {
        console.warn('Reviews query failed:', e);
        try {
          reviews = await pgGetWhere('reviews', { canteenId }) as Review[];
          reviews = reviews.slice(0, 20);
        } catch (e2) { console.warn('Reviews fallback query failed:', e2); }
      }

      let ingredients: Ingredient[] = INITIAL_INGREDIENTS.map(ing => ({ ...ing, canteenId }));
      try {
        const pgIngs = await pgGetWhere('ingredients', { canteenId }) as Ingredient[];
        if (pgIngs.length > 0) ingredients = pgIngs;
      } catch (e) { console.warn('Ingredients query failed:', e); }

      let settings: CanteenSettings = { ...canteenSettings, canteenId };
      try {
        const settingsDoc = await pgGetById('settings', `settings_${canteenId || 'canteen_001'}`);
        if (settingsDoc) settings = settingsDoc as CanteenSettings;
      } catch (e) { console.warn('Settings query failed:', e); }

       let canteenName = 'Esc(Q)';
      let ownerName = 'Chef Watson';
      try {
        const cRef = await pgGetById('canteens', canteenId);
        if (cRef) {
          canteenName = cRef.name || canteenName;
          ownerName = cRef.ownerName || ownerName;
        }
      } catch (e) { console.warn('Canteen doc query failed:', e); }

      const result = {
        id: canteenId,
        name: canteenName,
        ownerName,
        items,
        orders,
        reviews,
        ingredients,
        settings
      };

      setCache(cacheKey, result, CANTEEN_CACHE_TTL);
      return res.json({ success: true, canteen: result });
    } catch (err) {
      console.error('PostgreSQL get error, falling back to local memory state:', err);
    }
  }
  res.json({ success: true, canteen: getCanteenState(canteenId) });
});

// 1b. Get User's Orders (Customer history)
app.get('/api/user/orders', async (req, res) => {
  const userId = req.query.userId as string;
  const canteenId = req.query.canteenId as string;
  if (!userId) {
    return res.json({ success: true, orders: [] });
  }

  // Always try in-memory fallback first as baseline
  const memoryOrders = canteenState.orders
    .filter(o => o.userId === userId && (!canteenId || o.canteenId === canteenId))
    .slice(0, 50);

  if (pgReady) {
    try {
      let orders: Order[] = [];

      // Try simple userId query
      try {
        orders = await pgGetWhereOrdered('orders', { userId }, 'created_at', 'desc', 100) as Order[];
        // Auto-reconcile: fulfill pending Razorpay orders whose payment actually succeeded
        await autoReconcileRazorpayOrders(orders);
        orders = orders.map(o => {
          if (!o.qrPayload) o.qrPayload = generateSignedQR(o.id);
          return o;
        });
        if (canteenId) {
          orders = orders.filter(o => o.canteenId === canteenId);
        }
        orders = orders.slice(0, 50);
      } catch (simpleErr) {
        console.warn('Simple userId query failed:', simpleErr);
      }

      // Merge: prefer PostgreSQL orders, but keep memory orders not found in PostgreSQL
      if (orders.length > 0) {
        const pgIds = new Set(orders.map(o => o.id));
        const merged = [...orders, ...memoryOrders.filter(o => !pgIds.has(o.id))];
        return res.json({ success: true, orders: merged.slice(0, 50) });
      }

      // If PostgreSQL returned nothing but we have memory orders, return those
      if (memoryOrders.length > 0) {
        return res.json({ success: true, orders: memoryOrders });
      }

      return res.json({ success: true, orders: [] });
    } catch (err) {
      console.error('Failed to fetch user orders:', err);
    }
  }

  res.json({ success: true, orders: memoryOrders });
});

// 2. Add / Edit Menu Items (Owner)
app.post('/api/canteen/menu', async (req, res) => {
  const { id, name, price, stock, category, description, tags, available, imageUrl, prepTime, dailyLimit, isPaused, recipe, requiresChef, canteenId } = req.body;
  
  if (!name || isNaN(price) || isNaN(stock)) {
    return res.status(400).json({ success: false, error: 'Name, valid price and stock are required.' });
  }

  // Compress base64 images to prevent large payloads
  let processedImageUrl = imageUrl;
  if (imageUrl && imageUrl.startsWith('data:image')) {
    try {
      processedImageUrl = await compressBase64Image(imageUrl, 600);
    } catch (e) {
      console.warn('Menu image compression failed:', e);
    }
  }

  const isNew = !id;
  const targetId = id || `item_${Date.now()}`;
  const resolvedCanteenId = canteenId || 'canteen_001';

  let existingItem: MenuItem | undefined;
  if (pgReady && !isNew) {
    try {
      const doc = await pgGetById('items', id);
      if (doc) {
        existingItem = doc as MenuItem;
      }
    } catch (e) {
      console.error(e);
    }
  } else if (!isNew) {
    existingItem = canteenState.items.find(i => i.id === id);
  }

  const menuItem: MenuItem = {
    id: targetId,
    canteenId: resolvedCanteenId,
    name,
    price: Number(price),
    stock: Number(stock),
    rating: existingItem?.rating || 5.0,
    ratingCount: existingItem?.ratingCount || 1,
    available: stock > 0 ? (available !== undefined ? available : true) : false,
    category: category || 'Meals',
    description: description || '',
    tags: tags || [],
    imageUrl: processedImageUrl || existingItem?.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=300&auto=format&fit=crop',
    prepTime: Number(prepTime) || existingItem?.prepTime || 10,
    dailyLimit: Number(dailyLimit) || existingItem?.dailyLimit || 100,
    bookedToday: existingItem?.bookedToday || 0,
    isPaused: isPaused !== undefined ? !!isPaused : (existingItem?.isPaused || false),
    recipe: recipe || existingItem?.recipe || [],
    requiresChef: requiresChef !== undefined ? !!requiresChef : true
  };

  if (pgReady) {
    try {
      await pgSet('items', targetId, menuItem);
      console.log(`Menu item saved to PostgreSQL: ${targetId} for canteen ${resolvedCanteenId}`);
    } catch (err) {
      console.error('PostgreSQL save item error:', err);
      return res.status(500).json({ success: false, error: 'Failed to save item to database. Please try again.' });
    }
  } else {
    console.error('PostgreSQL not initialized, cannot save menu item');
    return res.status(500).json({ success: false, error: 'Database not connected. Please try again.' });
  }

  invalidateCanteenCache(resolvedCanteenId);
  res.json({ success: true, menuItem, message: isNew ? 'Menu item added successfully' : 'Menu item updated successfully' });
});

// 3. Delete Menu Item (Owner)
app.delete('/api/canteen/menu/:id', async (req, res) => {
  const { id } = req.params;
  if (pgReady) {
    try {
      await pgDelete('items', id);
      console.log(`Menu item deleted from PostgreSQL: ${id}`);
    } catch (err) {
      console.error('PostgreSQL delete error:', err);
      return res.status(500).json({ success: false, error: 'Failed to delete item from database.' });
    }
  }
  res.json({ success: true, message: 'Item deleted successfully' });
});

// 3b. Add / Edit Ingredients (Owner)
app.post('/api/canteen/ingredients', async (req, res) => {
  const { id, name, stockGrams, unit, canteenId } = req.body;
  if (!name || isNaN(stockGrams)) {
    return res.status(400).json({ success: false, error: 'Name and valid stock quantity are required.' });
  }
  const isNew = !id;
  const targetId = id || `ing_${Date.now()}`;
  const targetCanteenId = canteenId || 'canteen_001';

  const ingredient: Ingredient = {
    id: targetId,
    name,
    stockGrams: Number(stockGrams),
    unit: unit || 'g',
    canteenId: targetCanteenId
  };

  if (pgReady) {
    try {
      await pgSet('ingredients', targetId, ingredient);
    } catch (err) {
      console.error('PostgreSQL save ingredient error:', err);
    }
  }

  const activeC = getCanteenState(targetCanteenId);
  if (!activeC.ingredients) activeC.ingredients = [];

  if (isNew) {
    activeC.ingredients.push(ingredient);
  } else {
    activeC.ingredients = activeC.ingredients.map(ing => ing.id === id ? ingredient : ing);
  }

  // Update legacy global state fallback if canteen matches
  if (targetCanteenId === 'canteen_001') {
    if (isNew) {
      if (!canteenState.ingredients) canteenState.ingredients = [];
      canteenState.ingredients.push(ingredient);
    } else {
      canteenState.ingredients = (canteenState.ingredients || []).map(ing => ing.id === id ? ingredient : ing);
    }
  }

  saveLocalDB();
  res.json({ success: true, ingredient, message: isNew ? 'Ingredient added' : 'Ingredient updated' });
});

// 3c. Delete Ingredient (Owner)
app.delete('/api/canteen/ingredients/:id', async (req, res) => {
  const { id } = req.params;
  const canteenId = (req.query.canteenId as string) || 'canteen_001';
  if (pgReady) {
    try {
      await pgDelete('ingredients', id);
    } catch (err) {
      console.error('PostgreSQL delete ingredient error:', err);
    }
  }
  const activeC = getCanteenState(canteenId);
  if (activeC.ingredients) {
    activeC.ingredients = activeC.ingredients.filter(ing => ing.id !== id);
  }
  if (canteenId === 'canteen_001') {
    canteenState.ingredients = (canteenState.ingredients || []).filter(ing => ing.id !== id);
  }
  saveLocalDB();
  res.json({ success: true, message: 'Ingredient deleted successfully' });
});

// Helper to parse "12:45 PM" into today's unix timestamp
function parseSlotToTimestamp(slot: string): number {
  const match = slot.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
  if (!match) return Date.now();
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && hours < 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;
  
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d.getTime();
}

// 4. Place an Order (Customer)
app.post('/api/canteen/order', async (req, res) => {
  try {
  const { userId, userName, items, paymentMethod, pickupSlot, canteenId, subCanteenId, gateway } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: 'Cannot place empty order.' });
  }

  const selectedSlot = pickupSlot || 'ASAP (Instant)';

  // 1. Check Slot Capacity
  let capacityLimit = canteenSettings.defaultSlotCapacity;
  let currentSlotBookingsCount = 0;
  if (pgReady) {
    try {
      const settingsDoc = await pgGetById('settings', `settings_${canteenId || 'canteen_001'}`);
      if (settingsDoc) {
        capacityLimit = (settingsDoc as CanteenSettings).defaultSlotCapacity;
      }
      const ordersInSlot = await pgGetWhere('orders', { pickupSlot: selectedSlot, canteenId: canteenId || 'canteen_001' });
      currentSlotBookingsCount = ordersInSlot.filter((o: any) => {
        return o.status !== 'cancelled' && o.status !== 'expired';
      }).length;
    } catch (err) {
      console.error(err);
    }
  } else {
    capacityLimit = canteenState.settings?.defaultSlotCapacity || 30;
    currentSlotBookingsCount = canteenState.orders.filter(o => o.pickupSlot === selectedSlot && o.status !== 'cancelled' && o.status !== 'expired').length;
  }

  if (selectedSlot !== 'ASAP (Instant)' && currentSlotBookingsCount >= capacityLimit) {
    return res.status(400).json({ success: false, error: `The ${selectedSlot} slot is fully booked. Please choose another pickup slot.` });
  }

  // Retrieve current items to check stock/limits
  let currentItems: MenuItem[] = [];
  if (pgReady) {
    try {
      currentItems = await pgGetAll('items') as MenuItem[];
    } catch (err) {
      console.error(err);
      currentItems = canteenState.items;
    }
  } else {
    currentItems = canteenState.items;
  }

  // Retrieve current raw ingredients
  let currentIngredients: Ingredient[] = [];
  if (pgReady) {
    try {
      currentIngredients = await pgGetAll('ingredients') as Ingredient[];
    } catch (err) {
      console.error(err);
      currentIngredients = canteenState.ingredients || [];
    }
  } else {
    currentIngredients = canteenState.ingredients || [];
  }

  const validatedItems: OrderItem[] = [];
  let foodAmount = 0;
  let maxPrepTime = 5;

  // Recipe requirements tracker
  const requiredIngredients: { [ingId: string]: number } = {};

  for (const clientItem of items) {
    const itemInMenu = currentItems.find(item => item.id === clientItem.itemId);
    if (!itemInMenu) {
      return res.status(404).json({ success: false, error: `Food item ${clientItem.name} not found.` });
    }

    if (itemInMenu.isPaused) {
      return res.status(400).json({ success: false, error: `Sorry, ${itemInMenu.name} is currently unavailable due to kitchen controls.` });
    }

    if (itemInMenu.bookedToday + clientItem.quantity > itemInMenu.dailyLimit) {
      return res.status(400).json({ success: false, error: `Sorry, ${itemInMenu.name} is Sold Out for today (daily limit reached).` });
    }

    if (itemInMenu.stock < clientItem.quantity) {
      return res.status(432).json({ 
        success: false, 
        error: `Insufficient stock for ${itemInMenu.name}. Only ${itemInMenu.stock} units available.` 
      });
    }

    // Accumulate recipe ingredients needed
    if (itemInMenu.recipe && Array.isArray(itemInMenu.recipe)) {
      for (const recipeItem of itemInMenu.recipe) {
        const totalNeeded = recipeItem.amountGrams * clientItem.quantity;
        requiredIngredients[recipeItem.ingredientId] = (requiredIngredients[recipeItem.ingredientId] || 0) + totalNeeded;
      }
    }

    validatedItems.push({
      itemId: itemInMenu.id,
      name: itemInMenu.name,
      price: itemInMenu.price,
      quantity: clientItem.quantity,
    });

    foodAmount += itemInMenu.price * clientItem.quantity;
    if (itemInMenu.prepTime > maxPrepTime) {
      maxPrepTime = itemInMenu.prepTime;
    }
  }

  // Check ingredient stocks
  for (const [ingId, reqAmount] of Object.entries(requiredIngredients)) {
    const ingredient = currentIngredients.find(i => i.id === ingId);
    if (!ingredient) continue;
    if (ingredient.stockGrams < reqAmount) {
      const displayStock = ingredient.stockGrams < 1000 ? `${ingredient.stockGrams}g` : `${(ingredient.stockGrams / 1000).toFixed(2)}kg`;
      const displayReq = reqAmount < 1000 ? `${reqAmount}g` : `${(reqAmount / 1000).toFixed(2)}kg`;
      return res.status(400).json({
        success: false,
        error: `Insufficient raw inventory for: ${ingredient.name}. Needed: ${displayReq}, available: ${displayStock}.`
      });
    }
  }

  const convenienceFee = foodAmount > 0 ? Math.ceil(foodAmount / 100) : 0;
  const subtotal = foodAmount + convenienceFee;
  const orderId = `ORD_${Math.floor(1000 + Math.random() * 9000)}`;

  const pickupTimestamp = parseSlotToTimestamp(selectedSlot);
  const prepStartTime = pickupTimestamp - (maxPrepTime * 60 * 1000) - (5 * 60 * 1000); // 5 mins buffer
  let noShowMinutes = 30;
  try {
    noShowMinutes = pgReady
      ? ((await pgGetById('settings', `settings_${canteenId || 'canteen_001'}`))?.noShowMinutes || 30)
      : canteenState.settings?.noShowMinutes || 30;
  } catch (settingsErr) {
    console.warn('Settings query failed, using default noShowMinutes:', settingsErr);
  }
  const expiryTime = pickupTimestamp + (noShowMinutes * 60 * 1000);

  const selectedGateway = (gateway === 'vyapar') ? 'vyapar' : 'razorpay';

  // ── RAZORPAY GATEWAY ──────────────────────────────────────────────────────
  if (selectedGateway === 'razorpay' && razorpayConfigured && razorpay) {
    try {
      const totalPrice = Number((subtotal / 0.9764).toFixed(2));
      const totalAmountPaise = Math.round(totalPrice * 100);

      const razorpayOrder = await razorpay.orders.create({
        amount: totalAmountPaise,
        currency: 'INR',
        receipt: orderId,
      });

      const signedQrPayload = generateSignedQR(orderId);
      const newOrder: Order = {
        id: orderId,
        userId: userId || 'user_guest',
        userName: userName || 'Guest User',
        items: validatedItems,
        totalPrice,
        paymentStatus: 'pending',
        paymentMethod: 'Razorpay',
        qrCode: `QR_${orderId}_${Math.floor(Math.random() * 1000)}`,
        qrPayload: signedQrPayload,
        status: 'pending',
        timestamp: new Date().toISOString(),
        createdAt: Date.now(),
        pickupTimeText: 'Pending payment confirmation',
        razorpayOrderId: razorpayOrder.id,
        pickupSlot: selectedSlot,
        prepStartTime,
        expiryTime,
        canteenId: canteenId || 'canteen_001',
        subCanteenId: subCanteenId || 'sub_001'
      };

      if (pgReady) {
        await pgSet('orders', orderId, newOrder);
      }
      canteenState.orders.unshift(newOrder);

      return res.json({
        success: true,
        useRazorpay: true,
        razorpayOrderId: razorpayOrder.id,
        razorpayKeyId: razorpayKeyId,
        amount: totalPrice,
        amountPaise: totalAmountPaise,
        currency: 'INR',
        order: newOrder,
        qrPayload: generateSignedQR(orderId)
      });
    } catch (err: any) {
      const errDetail = typeof err === 'string'
        ? err
        : err?.message || err?.error?.description || err?.statusText || err?.stack?.split('\n')[0] || JSON.stringify(err, Object.getOwnPropertyNames(err));
      console.error('Razorpay order creation error:', errDetail, '| raw:', err);
      return res.status(500).json({ success: false, error: `Payment gateway error: ${errDetail}` });
    }
  }

  // ── VYAPARGATEWAY (UPI DYNAMIC QR) ────────────────────────────────────────
  if (selectedGateway === 'vyapar') {
    try {
      const totalPrice = Number((subtotal / 0.9764).toFixed(2));
      const totalAmountPaise = Math.round(totalPrice * 100);

      const signedQrPayload = generateSignedQR(orderId);
      const newOrder: Order = {
        id: orderId,
        userId: userId || 'user_guest',
        userName: userName || 'Guest User',
        items: validatedItems,
        totalPrice,
        paymentStatus: 'pending',
        paymentMethod: 'UPI Dynamic QR',
        qrCode: `QR_${orderId}_${Math.floor(Math.random() * 1000)}`,
        qrPayload: signedQrPayload,
        status: 'pending',
        timestamp: new Date().toISOString(),
        createdAt: Date.now(),
        pickupTimeText: 'Pending UPI payment',
        pickupSlot: selectedSlot,
        prepStartTime,
        expiryTime,
        canteenId: canteenId || 'canteen_001',
        subCanteenId: subCanteenId || 'sub_001'
      };

      if (pgReady) {
        await pgSet('orders', orderId, newOrder);
      }
      canteenState.orders.unshift(newOrder);

      if (vyaparConfigured) {
        // Real VyaparGateway API call
        try {
          const vyaparAuth = Buffer.from(`${vyaparMerchantId}:${vyaparSecret}`).toString('base64');
          const vyaparResp = await fetch(`${vyaparBaseUrl}/api/v1/transactions/create`, {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${vyaparAuth}`,
              'Content-Type': 'application/json',
              'X-Api-Key': vyaparApiKey,
            },
            body: JSON.stringify({
              merchant_id: vyaparMerchantId,
              order_id: orderId,
              amount: totalAmountPaise,
              currency: 'INR',
              customer_name: userName || 'Guest User',
              callback_url: `${APP_UPDATE_URL}/api/vyapar/webhook`,
              description: `Esc(Q) Order ${orderId}`,
            }),
          });
          const vyaparData = await vyaparResp.json() as any;
          console.log('[VyaparGateway] Create transaction response:', JSON.stringify(vyaparData).substring(0, 500));

          if (vyaparData.success || vyaparData.status === 'success') {
            const qrUrl = vyaparData.qr_url || vyaparData.qr_data || vyaparData.upi_qr || '';
            const upiString = vyaparData.upi_string || vyaparData.vpa || '';
            const txnId = vyaparData.transaction_id || vyaparData.txn_id || '';

            // Update order with VyaparGateway transaction details
            newOrder.vyaparTxnId = txnId;
            newOrder.upiQrUrl = qrUrl;
            newOrder.upiString = upiString;

            if (pgReady) {
              await pgSet('orders', orderId, newOrder);
            }
            canteenState.orders = canteenState.orders.map(o => o.id === orderId ? newOrder : o);

            return res.json({
              success: true,
              useVyapar: true,
              vyaparTxnId: txnId,
              qrUrl,
              upiString,
              amount: totalAmountPaise,
              currency: 'INR',
              order: newOrder,
              qrPayload: generateSignedQR(orderId)
            });
          } else {
            console.error('[VyaparGateway] API error:', vyaparData);
            // Fall through to sandbox QR
          }
        } catch (vyaparErr: any) {
          console.error('[VyaparGateway] API call failed:', vyaparErr?.message || vyaparErr);
          // Fall through to sandbox QR
        }
      }

      // Sandbox / fallback: generate a static UPI QR for the order
      const callbackUrl = `${APP_UPDATE_URL}/api/vyapar/callback?orderId=${orderId}`;
      const upiString = `upi://pay?pa=canteen@upi&pn=Esc(Q) Canteen&am=${(totalPrice).toFixed(2)}&tn=Order%20${orderId}&cu=INR&tr=${orderId}&url=${encodeURIComponent(callbackUrl)}`;
      const sandboxTxnId = `VYG_${orderId}_${Date.now()}`;

      newOrder.vyaparTxnId = sandboxTxnId;
      newOrder.upiString = upiString;
      if (pgReady) {
        await pgSet('orders', orderId, newOrder);
      }
      canteenState.orders = canteenState.orders.map(o => o.id === orderId ? newOrder : o);

      return res.json({
        success: true,
        useVyapar: true,
        vyaparTxnId: sandboxTxnId,
        qrUrl: '',
        upiString,
        amount: totalAmountPaise,
        currency: 'INR',
        order: newOrder,
        qrPayload: generateSignedQR(orderId),
        sandbox: true
      });
    } catch (err: any) {
      const errDetail = typeof err === 'string'
        ? err
        : err?.message || err?.error?.description || err?.statusText || err?.stack?.split('\n')[0] || JSON.stringify(err, Object.getOwnPropertyNames(err));
      console.error('VyaparGateway order creation error:', errDetail, '| raw:', err);
      return res.status(500).json({ success: false, error: `Payment gateway error: ${errDetail}` });
    }
  }

  // Fallback to Instant Mock Checkout when Razorpay credentials are not configured
  // Deduct ingredient stock, decrement item stock, increment bookedToday
  for (const clientItem of items) {
    const itemInMenu = currentItems.find(item => item.id === clientItem.itemId);
    if (itemInMenu) {
      itemInMenu.stock -= clientItem.quantity;
      itemInMenu.bookedToday += clientItem.quantity;
      if (itemInMenu.stock <= 0) {
        itemInMenu.available = false;
      }
      if (pgReady) {
        await pgSet('items', itemInMenu.id, itemInMenu);
      }
    }
  }
  canteenState.items = currentItems;

  for (const [ingId, reqAmount] of Object.entries(requiredIngredients)) {
    const ingredient = currentIngredients.find(i => i.id === ingId);
    if (ingredient) {
      ingredient.stockGrams = Math.max(0, ingredient.stockGrams - reqAmount);
      if (pgReady) {
        await pgSet('ingredients', ingredient.id, ingredient);
      }
    }
  }
  canteenState.ingredients = currentIngredients;

  const totalPrice = Number((subtotal / 0.9764).toFixed(2));
  const containsChefItems = validatedItems.some(it => {
    const itemMenu = currentItems.find(m => m.id === it.itemId);
    return itemMenu ? itemMenu.requiresChef !== false : true;
  });

  const signedQrPayload = generateSignedQR(orderId);
  const newOrder: Order = {
    id: orderId,
    userId: userId || 'user_guest',
    userName: userName || 'Raju Watson',
    items: validatedItems,
    totalPrice: totalPrice,
    paymentStatus: 'paid', 
    paymentMethod: paymentMethod || 'Mock UPI Checkout',
    qrCode: `QR_${orderId}_${Math.floor(Math.random() * 1000)}`,
    qrPayload: signedQrPayload,
    status: containsChefItems ? 'scheduled' : 'ready',
    timestamp: new Date().toISOString(),
    createdAt: Date.now(),
    pickupTimeText: containsChefItems ? `Scheduled for pickup at ${selectedSlot}` : 'Ready for collection at counter',
    pickupSlot: selectedSlot,
    prepStartTime,
    expiryTime,
    canteenId: canteenId || 'canteen_001',
    subCanteenId: subCanteenId || 'sub_001'
  };

  if (pgReady) {
    try {
      await pgSet('orders', orderId, newOrder);
    } catch (err) {
      console.error('PostgreSQL save order error:', err);
    }
  }

  canteenState.orders.unshift(newOrder);

  // Phase 3: Update kitchen operations when new order arrives
  if (pgReady) {
    try {
      const targetCanteenId = canteenId || 'canteen_001';
      const ops = await pgGetWhere('kitchen_operations', { canteenId: targetCanteenId });
      if (ops.length > 0) {
        await pgUpdate('kitchen_operations', ops[0].id, {
          activeOrders: (ops[0].activeOrders || 0) + 1,
          lastUpdated: Date.now(),
        });
      } else {
        await pgSet('kitchen_operations', `kitchen_${targetCanteenId}`, {
          id: `kitchen_${targetCanteenId}`,
          canteenId: targetCanteenId,
          activeOrders: 1,
          maxCapacity: 20,
          status: 'normal',
          lastUpdated: Date.now(),
          createdAt: Date.now(),
        });
      }
    } catch (err) {
      console.error('Kitchen operations update on order place error:', err);
    }
  }

  res.json({ success: true, useRazorpay: false, order: newOrder, qrPayload: generateSignedQR(orderId), message: 'Order placed & payment verified!' });
  } catch (topErr: any) {
    console.error('Order endpoint unhandled error:', typeof topErr === 'string' ? topErr : topErr?.message || JSON.stringify(topErr));
    if (!res.headersSent) {
      return res.status(500).json({ success: false, error: `Order processing error: ${typeof topErr === 'string' ? topErr : topErr?.message || 'Unexpected server error'}` });
    }
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// ──────────────────────────────────────────────────────────────────────────────
// Razorpay order fulfillment (shared) — stock/ingredient deduction + mark paid
// ──────────────────────────────────────────────────────────────────────────────
async function fulfillRazorpayOrder(targetOrder: Order, razorpay_payment_id: string, razorpay_signature: string): Promise<Order> {
  let currentItems: MenuItem[] = [];
  if (pgReady) {
    currentItems = await pgGetAll('items') as MenuItem[];
  } else {
    currentItems = canteenState.items;
  }

  let currentIngredients: Ingredient[] = [];
  if (pgReady) {
    currentIngredients = await pgGetAll('ingredients') as Ingredient[];
  } else {
    currentIngredients = canteenState.ingredients || [];
  }

  for (const item of targetOrder.items) {
    const itemInMenu = currentItems.find(i => i.id === item.itemId);
    if (itemInMenu) {
      itemInMenu.stock = Math.max(0, itemInMenu.stock - item.quantity);
      itemInMenu.bookedToday += item.quantity;
      if (itemInMenu.stock <= 0) {
        itemInMenu.available = false;
      }
      if (pgReady) {
        await pgSet('items', itemInMenu.id, itemInMenu);
      }

      if (itemInMenu.recipe) {
        for (const recipeItem of itemInMenu.recipe) {
          const reqAmount = recipeItem.amountGrams * item.quantity;
          const ingredient = currentIngredients.find(ing => ing.id === recipeItem.ingredientId);
          if (ingredient) {
            ingredient.stockGrams = Math.max(0, ingredient.stockGrams - reqAmount);
            if (pgReady) {
              await pgSet('ingredients', ingredient.id, ingredient);
            }
          }
        }
      }
    }
  }
  canteenState.items = currentItems;
  canteenState.ingredients = currentIngredients;

  const containsChefItems = targetOrder.items.some(it => {
    const itemMenu = currentItems.find(m => m.id === it.itemId);
    return itemMenu ? itemMenu.requiresChef !== false : true;
  });

  const updatedOrder: Order = {
    ...targetOrder,
    paymentStatus: 'paid',
    status: containsChefItems ? 'scheduled' : 'ready',
    razorpayPaymentId: razorpay_payment_id,
    razorpaySignature: razorpay_signature,
    pickupTimeText: containsChefItems ? `Scheduled for pickup at ${targetOrder.pickupSlot}` : 'Ready for collection at counter'
  };

  if (pgReady) {
    await pgSet('orders', updatedOrder.id, updatedOrder);
  }

  canteenState.orders = canteenState.orders.map(o => o.id === updatedOrder.id ? updatedOrder : o);
  console.log(`[Razorpay Verify] ✅ Order ${targetOrder.id} marked as paid`);
  return updatedOrder;
}

// Server-side auto-reconciliation: when clients poll for orders, any PENDING
// order that has a razorpayOrderId is checked against the Razorpay API. If a
// captured payment exists (even if the client's verify call never landed),
// the order is fulfilled automatically. Each order id is checked once per
// server instance to avoid hammering the Razorpay API on every poll.
const razorpayReconcileChecked = new Set<string>();
async function autoReconcileRazorpayOrders(orders: Order[]): Promise<void> {
  if (!razorpayKeyId || !razorpayKeySecret) return;
  const pending = orders.filter(o =>
    o && o.paymentStatus !== 'paid' && o.razorpayOrderId && !razorpayReconcileChecked.has(o.id)
  );
  if (pending.length === 0) return;

  const auth = Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString('base64');
  for (const order of pending) {
    razorpayReconcileChecked.add(order.id);
    try {
      const resp = await fetch(`https://api.razorpay.com/v1/payments?order_id=${encodeURIComponent(order.razorpayOrderId!)}`, { headers: { Authorization: `Basic ${auth}` } });
      if (!resp.ok) continue;
      const data = await resp.json() as any;
      const captured = (data?.items || []).find((p: any) => ['captured', 'authorized'].includes(p?.status));
      if (captured) {
        console.log(`[Razorpay Reconcile] ✅ Auto-fulfilling order ${order.id} — captured payment ${captured.id} found for ${order.razorpayOrderId}`);
        const updated = await fulfillRazorpayOrder(order, captured.id, 'api-reconciled');
        Object.assign(order, updated);
        order.paymentStatus = 'paid';
      } else {
        console.log(`[Razorpay Reconcile] No captured payment yet for order ${order.id} (${order.razorpayOrderId})`);
      }
    } catch (e) {
      console.warn(`[Razorpay Reconcile] Check failed for order ${order.id}:`, e);
    }
  }
}

// 4b. Razorpay Payment Verification — POST /api/razorpay/verify
// Verifies payment signature using HMAC-SHA256
// ──────────────────────────────────────────────────────────────────────────────
app.post('/api/razorpay/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    console.log(`[Razorpay Verify] Received: orderId=${razorpay_order_id}, paymentId=${razorpay_payment_id}`);

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, error: 'Missing required payment verification fields' });
    }

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', razorpayKeySecret)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      console.warn(`[Razorpay Verify] Signature mismatch for order ${razorpay_order_id} — attempting Razorpay API fallback`);
      let apiVerified = false;
      try {
        if (razorpayKeyId && razorpayKeySecret) {
          const auth = Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString('base64');
          const resp = await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, { headers: { Authorization: `Basic ${auth}` } });
          if (resp.ok) {
            const pay = await resp.json() as any;
            if (pay && pay.order_id === razorpay_order_id && ['captured', 'authorized'].includes(pay.status)) {
              apiVerified = true;
              console.log(`[Razorpay Verify] ✅ API fallback verified payment ${razorpay_payment_id} (status=${pay.status}) for order ${razorpay_order_id}`);
            }
          }
        }
      } catch (apiErr) {
        console.error('[Razorpay Verify] API fallback error:', apiErr);
      }
      if (!apiVerified) return res.status(400).json({ success: false, error: 'Payment signature verification failed' });
    }

    console.log(`[Razorpay Verify] ✅ Signature verified for order ${razorpay_order_id}`);

    // Find order by razorpayOrderId with retry for cold starts
    let targetOrder: Order | undefined;
    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      if (pgReady) {
        try {
          const results = await pgGetWhere('orders', { razorpayOrderId: razorpay_order_id });
          if (results.length > 0) {
            targetOrder = results[0] as Order;
            break;
          }
        } catch (qErr) {
          console.warn(`[Razorpay Verify] PostgreSQL query attempt ${attempt + 1} failed:`, qErr);
          if (attempt < MAX_RETRIES - 1) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
      } else {
        targetOrder = canteenState.orders.find(o => o.razorpayOrderId === razorpay_order_id);
        if (targetOrder) break;
      }
    }

    // Fallback: search by doc ID (order ID itself)
    if (!targetOrder && pgReady) {
      try {
        // Try common order ID patterns
        const possibleIds = canteenState.orders.filter(o => o.razorpayOrderId === razorpay_order_id).map(o => o.id);
        for (const docId of possibleIds) {
          const doc = await pgGetById('orders', docId);
          if (doc) {
            targetOrder = doc as Order;
            break;
          }
        }
      } catch (e) {
        console.warn('[Razorpay Verify] Fallback doc lookup failed:', e);
      }
    }

    if (!targetOrder) {
      console.error(`[Razorpay Verify] Order not found for razorpayOrderId: ${razorpay_order_id}`);
      // Don't fail hard — return success so the app starts polling
      return res.json({ success: false, error: 'Order not found for this payment', retryable: true });
    }

    if (targetOrder.paymentStatus === 'paid') {
      return res.json({ success: true, message: 'Payment already verified', order: targetOrder });
    }

    // Deduct stock, decrement item stock, increment bookedToday, deduct ingredients
    const updatedOrder = await fulfillRazorpayOrder(targetOrder, razorpay_payment_id, razorpay_signature);

    res.json({ success: true, message: 'Payment verified successfully', order: updatedOrder });
  } catch (err: any) {
    console.error('[Razorpay Verify] Error:', err?.message || err);
    return res.status(500).json({ success: false, error: 'Payment verification failed' });
  }
});

// GET redirect from Razorpay (browser redirect after payment)
app.get('/api/razorpay/callback', (req, res) => {
  const orderId = (req.query.orderId as string) || '';
  return res.redirect(`${APP_UPDATE_URL}?payment=pending&orderId=${orderId}`);
});

// ──────────────────────────────────────────────────────────────────────────────
// 4f. VyaparGateway Payment Verification — POST /api/vyapar/verify
// Called by frontend after user confirms UPI payment
// ──────────────────────────────────────────────────────────────────────────────
app.post('/api/vyapar/verify', async (req, res) => {
  try {
    const { orderId, vyaparTxnId } = req.body;
    if (!orderId) {
      return res.status(400).json({ success: false, error: 'orderId required' });
    }

    // Find order
    let targetOrder: Order | undefined;
    if (pgReady) {
      const doc = await pgGetById('orders', orderId);
      if (doc) targetOrder = doc as Order;
    } else {
      targetOrder = canteenState.orders.find(o => o.id === orderId);
    }

    if (!targetOrder) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    if (targetOrder.paymentStatus === 'paid') {
      return res.json({ success: true, message: 'Payment already verified', order: targetOrder });
    }

    // If VyaparGateway is configured, check status with their API
    if (vyaparConfigured && targetOrder.vyaparTxnId) {
      try {
        const vyaparAuth = Buffer.from(`${vyaparMerchantId}:${vyaparSecret}`).toString('base64');
        const statusResp = await fetch(`${vyaparBaseUrl}/api/v1/transactions/${targetOrder.vyaparTxnId}/status`, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${vyaparAuth}`,
            'Content-Type': 'application/json',
            'X-Api-Key': vyaparApiKey,
          },
        });
        const statusData = await statusResp.json() as any;
        console.log('[VyaparGateway] Status check response:', JSON.stringify(statusData).substring(0, 500));

        if (!statusData.success && statusData.status !== 'success' && statusData.payment_status !== 'success') {
          return res.json({ success: false, error: 'Payment not yet confirmed by VyaparGateway', status: statusData.status || statusData.payment_status || 'pending' });
        }
      } catch (e: any) {
        console.error('[VyaparGateway] Status API error:', e?.message || e);
        // In sandbox, auto-verify
      }
    }

    // Mark order as paid (sandbox auto-verify or real API confirmed)
    // Deduct stock, decrement item stock, increment bookedToday, deduct ingredients
    let currentItems: MenuItem[] = [];
    if (pgReady) {
      currentItems = await pgGetAll('items') as MenuItem[];
    } else {
      currentItems = canteenState.items;
    }

    let currentIngredients: Ingredient[] = [];
    if (pgReady) {
      currentIngredients = await pgGetAll('ingredients') as Ingredient[];
    } else {
      currentIngredients = canteenState.ingredients || [];
    }

    for (const item of targetOrder.items) {
      const itemInMenu = currentItems.find(i => i.id === item.itemId);
      if (itemInMenu) {
        itemInMenu.stock = Math.max(0, itemInMenu.stock - item.quantity);
        itemInMenu.bookedToday += item.quantity;
        if (itemInMenu.stock <= 0) {
          itemInMenu.available = false;
        }
        if (pgReady) {
          await pgSet('items', itemInMenu.id, itemInMenu);
        }

        if (itemInMenu.recipe) {
          for (const recipeItem of itemInMenu.recipe) {
            const reqAmount = recipeItem.amountGrams * item.quantity;
            const ingredient = currentIngredients.find(ing => ing.id === recipeItem.ingredientId);
            if (ingredient) {
              ingredient.stockGrams = Math.max(0, ingredient.stockGrams - reqAmount);
              if (pgReady) {
                await pgSet('ingredients', ingredient.id, ingredient);
              }
            }
          }
        }
      }
    }
    canteenState.items = currentItems;
    canteenState.ingredients = currentIngredients;

    const containsChefItems = targetOrder.items.some(it => {
      const itemMenu = currentItems.find(m => m.id === it.itemId);
      return itemMenu ? itemMenu.requiresChef !== false : true;
    });

    const updatedOrder: Order = {
      ...targetOrder,
      paymentStatus: 'paid',
      status: containsChefItems ? 'scheduled' : 'ready',
      pickupTimeText: containsChefItems ? `Scheduled for pickup at ${targetOrder.pickupSlot}` : 'Ready for collection at counter'
    };

    if (pgReady) {
      await pgSet('orders', updatedOrder.id, updatedOrder);
    }
    canteenState.orders = canteenState.orders.map(o => o.id === updatedOrder.id ? updatedOrder : o);

    console.log(`[VyaparGateway Verify] Order ${orderId} marked as paid`);
    res.json({ success: true, message: 'Payment verified successfully', order: updatedOrder });
  } catch (err: any) {
    console.error('[VyaparGateway Verify] Error:', err?.message || err);
    return res.status(500).json({ success: false, error: 'Payment verification failed' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// 4g. VyaparGateway Webhook — POST /api/vyapar/webhook
// Called by VyaparGateway servers when payment status changes
// ──────────────────────────────────────────────────────────────────────────────
app.post('/api/vyapar/webhook', async (req, res) => {
  try {
    const { order_id, transaction_id, status, payment_status } = req.body;
    const txnStatus = status || payment_status;

    console.log(`[VyaparGateway Webhook] order=${order_id} txn=${transaction_id} status=${txnStatus}`);

    if (!order_id) {
      return res.status(400).json({ success: false, error: 'order_id required' });
    }

    // Find order
    let targetOrder: Order | undefined;
    if (pgReady) {
      const doc = await pgGetById('orders', order_id);
      if (doc) targetOrder = doc as Order;
    } else {
      targetOrder = canteenState.orders.find(o => o.id === order_id);
    }

    if (!targetOrder) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    if (targetOrder.paymentStatus === 'paid') {
      return res.json({ success: true, message: 'Already processed' });
    }

    if (txnStatus === 'success' || txnStatus === 'completed' || txnStatus === 'captured') {
      // Deduct stock, same as verify
      let currentItems: MenuItem[] = [];
      if (pgReady) {
        currentItems = await pgGetAll('items') as MenuItem[];
      } else {
        currentItems = canteenState.items;
      }

      let currentIngredients: Ingredient[] = [];
      if (pgReady) {
        currentIngredients = await pgGetAll('ingredients') as Ingredient[];
      } else {
        currentIngredients = canteenState.ingredients || [];
      }

      for (const item of targetOrder.items) {
        const itemInMenu = currentItems.find(i => i.id === item.itemId);
        if (itemInMenu) {
          itemInMenu.stock = Math.max(0, itemInMenu.stock - item.quantity);
          itemInMenu.bookedToday += item.quantity;
          if (itemInMenu.stock <= 0) itemInMenu.available = false;
          if (pgReady) await pgSet('items', itemInMenu.id, itemInMenu);

          if (itemInMenu.recipe) {
            for (const recipeItem of itemInMenu.recipe) {
              const reqAmount = recipeItem.amountGrams * item.quantity;
              const ingredient = currentIngredients.find(ing => ing.id === recipeItem.ingredientId);
              if (ingredient) {
                ingredient.stockGrams = Math.max(0, ingredient.stockGrams - reqAmount);
                if (pgReady) await pgSet('ingredients', ingredient.id, ingredient);
              }
            }
          }
        }
      }
      canteenState.items = currentItems;
      canteenState.ingredients = currentIngredients;

      const containsChefItems = targetOrder.items.some(it => {
        const itemMenu = currentItems.find(m => m.id === it.itemId);
        return itemMenu ? itemMenu.requiresChef !== false : true;
      });

      const updatedOrder: Order = {
        ...targetOrder,
        paymentStatus: 'paid',
        status: containsChefItems ? 'scheduled' : 'ready',
        pickupTimeText: containsChefItems ? `Scheduled for pickup at ${targetOrder.pickupSlot}` : 'Ready for collection at counter'
      };

      if (pgReady) {
        await pgSet('orders', order_id, updatedOrder);
      }
      canteenState.orders = canteenState.orders.map(o => o.id === order_id ? updatedOrder : o);

      console.log(`[VyaparGateway Webhook] Order ${order_id} marked as paid`);
    } else if (txnStatus === 'failed') {
      const failedOrder: Order = {
        ...targetOrder,
        paymentStatus: 'failed',
        status: 'cancelled'
      };
      if (pgReady) {
        await pgSet('orders', order_id, failedOrder);
      }
      canteenState.orders = canteenState.orders.map(o => o.id === order_id ? failedOrder : o);
      console.log(`[VyaparGateway Webhook] Order ${order_id} marked as failed`);
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('[VyaparGateway Webhook] Error:', err?.message || err);
    return res.status(500).json({ success: false, error: 'Webhook processing failed' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// 4h. VyaparGateway Payment Status Check — GET /api/vyapar/status
// ──────────────────────────────────────────────────────────────────────────────
app.get('/api/vyapar/status', async (req, res) => {
  const orderId = (req.query.orderId as string) || '';
  if (!orderId) return res.json({ success: false, error: 'orderId required' });

  try {
    let targetOrder: Order | undefined;
    if (pgReady) {
      const doc = await pgGetById('orders', orderId);
      if (doc) targetOrder = doc as Order;
    } else {
      targetOrder = canteenState.orders.find(o => o.id === orderId);
    }
    if (!targetOrder) return res.json({ success: true, paymentStatus: 'not_found', status: 'not_found' });
    return res.json({ success: true, paymentStatus: targetOrder.paymentStatus, status: targetOrder.status });
  } catch (err) {
    return res.json({ success: false, error: 'Server error' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// 4i. VyaparGateway UPI Callback — GET /api/vyapar/callback
// Handles redirect-back from UPI app after payment
// ──────────────────────────────────────────────────────────────────────────────
app.get('/api/vyapar/callback', async (req, res) => {
  const orderId = (req.query.orderId as string) || '';
  const txnId = (req.query.txnId as string) || '';
  const status = (req.query.status as string) || '';

  console.log(`[VyaparGateway Callback] order=${orderId} txn=${txnId} status=${status}`);

  if (!orderId) {
    return res.redirect(`${APP_UPDATE_URL}?payment=failed&error=No+order+ID`);
  }

  // Try to verify payment
  let targetOrder: Order | undefined;
  if (pgReady) {
    const doc = await pgGetById('orders', orderId);
    if (doc) targetOrder = doc as Order;
  } else {
    targetOrder = canteenState.orders.find(o => o.id === orderId);
  }

  if (!targetOrder) {
    return res.redirect(`${APP_UPDATE_URL}?payment=failed&orderId=${orderId}&error=Order+not+found`);
  }

  if (targetOrder.paymentStatus === 'paid') {
    return res.redirect(`${APP_UPDATE_URL}?payment=success&orderId=${orderId}`);
  }

  // If VyaparGateway is configured, check with their API
  if (vyaparConfigured && targetOrder.vyaparTxnId) {
    try {
      const vyaparAuth = Buffer.from(`${vyaparMerchantId}:${vyaparSecret}`).toString('base64');
      const statusResp = await fetch(`${vyaparBaseUrl}/api/v1/transactions/${targetOrder.vyaparTxnId}/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${vyaparAuth}`,
          'Content-Type': 'application/json',
          'X-Api-Key': vyaparApiKey,
        },
      });
      const statusData = await statusResp.json() as any;

      if (statusData.success || statusData.status === 'success' || statusData.payment_status === 'success') {
        // Auto-verify and mark as paid
        await autoVerifyVyaparOrder(targetOrder);
        return res.redirect(`${APP_UPDATE_URL}?payment=success&orderId=${orderId}`);
      }
    } catch (e: any) {
      console.error('[VyaparGateway Callback] Status check error:', e?.message);
    }
  }

  // Sandbox fallback: auto-verify
  if (status === 'success' || status === 'completed') {
    await autoVerifyVyaparOrder(targetOrder);
    return res.redirect(`${APP_UPDATE_URL}?payment=success&orderId=${orderId}`);
  }

  return res.redirect(`${APP_UPDATE_URL}?payment=pending&orderId=${orderId}`);
});

// Helper: Auto-verify VyaparGateway order (deduct stock, mark paid)
async function autoVerifyVyaparOrder(targetOrder: Order) {
  if (targetOrder.paymentStatus === 'paid') return;

  let currentItems: MenuItem[] = [];
  if (pgReady) {
    currentItems = await pgGetAll('items') as MenuItem[];
  } else {
    currentItems = canteenState.items;
  }

  let currentIngredients: Ingredient[] = [];
  if (pgReady) {
    currentIngredients = await pgGetAll('ingredients') as Ingredient[];
  } else {
    currentIngredients = canteenState.ingredients || [];
  }

  for (const item of targetOrder.items) {
    const itemInMenu = currentItems.find(i => i.id === item.itemId);
    if (itemInMenu) {
      itemInMenu.stock = Math.max(0, itemInMenu.stock - item.quantity);
      itemInMenu.bookedToday += item.quantity;
      if (itemInMenu.stock <= 0) itemInMenu.available = false;
      if (pgReady) await pgSet('items', itemInMenu.id, itemInMenu);

      if (itemInMenu.recipe) {
        for (const recipeItem of itemInMenu.recipe) {
          const reqAmount = recipeItem.amountGrams * item.quantity;
          const ingredient = currentIngredients.find(ing => ing.id === recipeItem.ingredientId);
          if (ingredient) {
            ingredient.stockGrams = Math.max(0, ingredient.stockGrams - reqAmount);
            if (pgReady) await pgSet('ingredients', ingredient.id, ingredient);
          }
        }
      }
    }
  }
  canteenState.items = currentItems;
  canteenState.ingredients = currentIngredients;

  const containsChefItems = targetOrder.items.some(it => {
    const itemMenu = currentItems.find(m => m.id === it.itemId);
    return itemMenu ? itemMenu.requiresChef !== false : true;
  });

  const updatedOrder: Order = {
    ...targetOrder,
    paymentStatus: 'paid',
    status: containsChefItems ? 'scheduled' : 'ready',
    pickupTimeText: containsChefItems ? `Scheduled for pickup at ${targetOrder.pickupSlot}` : 'Ready for collection at counter'
  };

  if (pgReady) {
    await pgSet('orders', updatedOrder.id, updatedOrder);
  }
  canteenState.orders = canteenState.orders.map(o => o.id === updatedOrder.id ? updatedOrder : o);
  console.log(`[VyaparGateway AutoVerify] Order ${targetOrder.id} marked as paid`);
}

// ──────────────────────────────────────────────────────────────────────────────
// 4d. Razorpay Payment Status Check — GET /api/razorpay/status
// Returns payment status for an order
// ──────────────────────────────────────────────────────────────────────────────
app.get('/api/razorpay/status', async (req, res) => {
  const orderId = (req.query.orderId as string) || '';
  if (!orderId) return res.json({ success: false, error: 'orderId required' });

  try {
    let targetOrder: Order | undefined;
    if (pgReady) {
      const results = await pgGetWhere('orders', { razorpayOrderId: orderId });
      if (results.length > 0) targetOrder = results[0] as Order;
    } else {
      targetOrder = canteenState.orders.find(o => o.razorpayOrderId === orderId);
    }
    if (!targetOrder) return res.json({ success: true, paymentStatus: 'not_found', status: 'not_found' });
    return res.json({ success: true, paymentStatus: targetOrder.paymentStatus, status: targetOrder.status });
  } catch (err) {
    return res.json({ success: false, error: 'Server error' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// 4e. Razorpay Payment Verification — POST /api/razorpay/verify
// Verifies payment signature and updates order status
// ──────────────────────────────────────────────────────────────────────────────
app.post('/api/payment/razorpay-verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, error: 'Missing required fields: razorpay_order_id, razorpay_payment_id, razorpay_signature' });
    }

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', razorpayKeySecret)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      console.warn(`[Razorpay Verify] Signature mismatch for order ${razorpay_order_id} — attempting Razorpay API fallback`);
      let apiVerified = false;
      try {
        if (razorpayKeyId && razorpayKeySecret) {
          const auth = Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString('base64');
          const resp = await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, { headers: { Authorization: `Basic ${auth}` } });
          if (resp.ok) {
            const pay = await resp.json() as any;
            if (pay && pay.order_id === razorpay_order_id && ['captured', 'authorized'].includes(pay.status)) {
              apiVerified = true;
              console.log(`[Razorpay Verify] ✅ API fallback verified payment ${razorpay_payment_id} (status=${pay.status}) for order ${razorpay_order_id}`);
            }
          }
        }
      } catch (apiErr) {
        console.error('[Razorpay Verify] API fallback error:', apiErr);
      }
      if (!apiVerified) return res.status(400).json({ success: false, error: 'Payment signature verification failed' });
    }

    console.log(`[Razorpay Verify] ✅ Signature verified for order ${razorpay_order_id}`);

    // Find order by razorpayOrderId
    let targetOrder: Order | undefined;
    if (pgReady) {
      const results = await pgGetWhere('orders', { razorpayOrderId: razorpay_order_id });
      if (results.length > 0) targetOrder = results[0] as Order;
    } else {
      targetOrder = canteenState.orders.find(o => o.razorpayOrderId === razorpay_order_id);
    }

    if (!targetOrder) {
      return res.status(404).json({ success: false, error: 'Order not found for this payment' });
    }

    if (targetOrder.paymentStatus === 'paid') {
      return res.json({ success: true, message: 'Payment already verified', order: targetOrder });
    }

    // Deduct stock, decrement item stock, increment bookedToday, deduct ingredients
    let currentItems: MenuItem[] = [];
    if (pgReady) {
      currentItems = await pgGetAll('items') as MenuItem[];
    } else {
      currentItems = canteenState.items;
    }

    let currentIngredients: Ingredient[] = [];
    if (pgReady) {
      currentIngredients = await pgGetAll('ingredients') as Ingredient[];
    } else {
      currentIngredients = canteenState.ingredients || [];
    }

    for (const item of targetOrder.items) {
      const itemInMenu = currentItems.find(i => i.id === item.itemId);
      if (itemInMenu) {
        itemInMenu.stock = Math.max(0, itemInMenu.stock - item.quantity);
        itemInMenu.bookedToday += item.quantity;
        if (itemInMenu.stock <= 0) {
          itemInMenu.available = false;
        }
        if (pgReady) {
          await pgSet('items', itemInMenu.id, itemInMenu);
        }

        if (itemInMenu.recipe) {
          for (const recipeItem of itemInMenu.recipe) {
            const reqAmount = recipeItem.amountGrams * item.quantity;
            const ingredient = currentIngredients.find(ing => ing.id === recipeItem.ingredientId);
            if (ingredient) {
              ingredient.stockGrams = Math.max(0, ingredient.stockGrams - reqAmount);
              if (pgReady) {
                await pgSet('ingredients', ingredient.id, ingredient);
              }
            }
          }
        }
      }
    }
    canteenState.items = currentItems;
    canteenState.ingredients = currentIngredients;

    const containsChefItems = targetOrder.items.some(it => {
      const itemMenu = currentItems.find(m => m.id === it.itemId);
      return itemMenu ? itemMenu.requiresChef !== false : true;
    });

    const updatedOrder: Order = {
      ...targetOrder,
      paymentStatus: 'paid',
      status: containsChefItems ? 'scheduled' : 'ready',
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      pickupTimeText: containsChefItems ? `Scheduled for pickup at ${targetOrder.pickupSlot}` : 'Ready for collection at counter'
    };

    if (pgReady) {
      await pgSet('orders', updatedOrder.id, updatedOrder);
    }

    canteenState.orders = canteenState.orders.map(o => o.id === updatedOrder.id ? updatedOrder : o);

    console.log(`[Razorpay Verify] ✅ Order ${targetOrder.id} marked as paid`);
    return res.json({ success: true, orderId: razorpay_order_id, status: 'paid', paymentId: razorpay_payment_id });
  } catch (err: any) {
    console.error('[Razorpay Verify] Error:', err?.message || err);
    return res.status(500).json({ success: false, error: 'Payment verification failed' });
  }
});

// 4c. QR Code Verification Endpoint (Staff scanning customer QR)
const QR_SECRET = process.env.QR_SECRET || crypto.randomBytes(32).toString('hex');

function generateSignedQR(orderId: string): string {
  const ts = Date.now().toString();
  const sig = crypto.createHmac('sha256', QR_SECRET).update(`${orderId}.${ts}`).digest('hex');
  return JSON.stringify({ o: orderId, t: ts, s: sig });
}

// ──────────────────────────────────────────────────────────────────────────────
// 5. SUPPORT TICKETS — Customer submits help, admin views, email notification
// ──────────────────────────────────────────────────────────────────────────────

// POST /api/support/submit — Customer submits a support ticket
app.post('/api/support/submit', async (req, res) => {
  try {
    const { userId, userName, userEmail, category, subject, description, orderId, canteenId, collegeId } = req.body;

    if (!userId || !userName || !userEmail || !category || !subject || !description) {
      return res.status(400).json({ success: false, error: 'Missing required fields: userId, userName, userEmail, category, subject, description' });
    }

    const ticketId = `TKT_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = Date.now();

    const ticket = {
      id: ticketId,
      userId,
      userName,
      userEmail,
      category,
      subject,
      description,
      orderId: orderId || '',
      status: 'open',
      priority: category === 'payment' || category === 'refund' ? 'high' : 'medium',
      createdAt: now,
      updatedAt: now,
      canteenId: canteenId || '',
      collegeId: collegeId || '',
    };

    // Save to PostgreSQL
    if (pgReady) {
      try {
        await pgSet('support_tickets', ticketId, ticket);
      } catch (err) {
        console.error('Failed to save support ticket to PostgreSQL:', err);
      }
    }

    console.log(`[Support] New ticket ${ticketId} from ${userName} (${userEmail}): ${subject}`);

    // Send email notification to admin
    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey) {
      try {
        const categoryEmoji: Record<string, string> = {
          payment: '💳', refund: '💰', order: '📦', account: '👤', app: '📱', other: '❓',
        };
        const priorityColor: Record<string, string> = { high: '#dc2626', medium: '#f59e0b', low: '#16a34a' };

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Esc(Q) Support <onboarding@resend.dev>',
            to: ['usrinivasan240@gmail.com'],
            subject: `[Esc(Q) Support] ${categoryEmoji[category] || '❓'} ${subject}`,
            html: `
              <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
                <div style="background:#7c3aed;color:white;padding:20px;border-radius:16px 16px 0 0">
                  <h2 style="margin:0">🎫 New Support Ticket</h2>
                </div>
                <div style="background:#f8f7ff;padding:24px;border:1px solid #e5e1f0;border-radius:0 0 16px 16px">
                  <table style="width:100%;border-collapse:collapse;font-size:14px">
                    <tr><td style="padding:8px 0;color:#666;width:120px">Ticket ID</td><td style="padding:8px 0;font-weight:bold;color:#7c3aed">${ticketId}</td></tr>
                    <tr><td style="padding:8px 0;color:#666">Category</td><td style="padding:8px 0">${categoryEmoji[category] || '❓'} ${category.charAt(0).toUpperCase() + category.slice(1)}</td></tr>
                    <tr><td style="padding:8px 0;color:#666">Priority</td><td style="padding:8px 0"><span style="background:${priorityColor[ticket.priority]};color:white;padding:2px 8px;border-radius:4px;font-size:12px">${ticket.priority.toUpperCase()}</span></td></tr>
                    <tr><td style="padding:8px 0;color:#666">Customer</td><td style="padding:8px 0">${userName} (${userEmail})</td></tr>
                    <tr><td style="padding:8px 0;color:#666">Order ID</td><td style="padding:8px 0">${orderId || 'N/A'}</td></tr>
                  </table>
                  <hr style="border:none;border-top:1px solid #e5e1f0;margin:16px 0"/>
                  <h3 style="margin:0 0 8px;color:#333">${subject}</h3>
                  <p style="color:#555;line-height:1.6;white-space:pre-wrap">${description}</p>
                  <hr style="border:none;border-top:1px solid #e5e1f0;margin:16px 0"/>
                  <p style="color:#999;font-size:12px">View and reply in the Esc(Q) SuperAdmin Dashboard → Support Tickets tab.</p>
                </div>
              </div>`,
          }),
        });
        console.log(`[Support] Email notification sent for ${ticketId}`);
      } catch (emailErr) {
        console.error('[Support] Email send failed:', emailErr);
      }
    }

    return res.json({ success: true, ticket });
  } catch (err: any) {
    console.error('[Support] Submit error:', err?.message || err);
    return res.status(500).json({ success: false, error: 'Failed to submit support ticket' });
  }
});

// GET /api/support/all — Superadmin fetches all tickets
app.get('/api/support/all', async (req, res) => {
  try {
    let tickets: any[] = [];
    if (pgReady) {
      tickets = await pgGetAll('support_tickets');
      tickets.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
    }
    return res.json({ success: true, tickets });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to fetch tickets' });
  }
});

// GET /api/support/user?userId=xxx — Customer fetches own tickets
app.get('/api/support/user', async (req, res) => {
  const userId = req.query.userId as string;
  if (!userId) return res.status(400).json({ success: false, error: 'userId required' });

  try {
    let tickets: any[] = [];
    if (pgReady) {
      tickets = await pgGetWhere('support_tickets', { userId });
      tickets.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
    }
    return res.json({ success: true, tickets });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to fetch tickets' });
  }
});

// POST /api/support/reply — Superadmin replies to a ticket (updates status + admin reply)
app.post('/api/support/reply', async (req, res) => {
  try {
    const { ticketId, adminReply, status } = req.body;
    if (!ticketId || !adminReply) {
      return res.status(400).json({ success: false, error: 'ticketId and adminReply required' });
    }

    const updates: any = { adminReply, updatedAt: Date.now() };
    if (status) updates.status = status;

    if (pgReady) {
      await pgUpdate('support_tickets', ticketId, updates);
    }

    // Fetch ticket to send reply email
    let ticket: any = null;
    if (pgReady) {
      const doc = await pgGetById('support_tickets', ticketId);
      if (doc) ticket = doc;
    }

    // Send reply email to customer
    if (ticket?.userEmail && process.env.RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Esc(Q) Support <onboarding@resend.dev>',
            to: [ticket.userEmail],
            subject: `[Esc(Q) Support] Reply to: ${ticket.subject}`,
            html: `
              <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
                <div style="background:#7c3aed;color:white;padding:20px;border-radius:16px 16px 0 0">
                  <h2 style="margin:0">💬 Support Reply</h2>
                </div>
                <div style="background:#f8f7ff;padding:24px;border:1px solid #e5e1f0;border-radius:0 0 16px 16px">
                  <p style="color:#666;font-size:14px">Hi ${ticket.userName},</p>
                  <p style="color:#666;font-size:14px">We've replied to your support ticket <strong>${ticketId}</strong>:</p>
                  <div style="background:#f3f0ff;padding:16px;border-radius:8px;border-left:4px solid #7c3aed;margin:16px 0">
                    <p style="color:#333;line-height:1.6;white-space:pre-wrap">${adminReply}</p>
                  </div>
                  <p style="color:#999;font-size:12px">Status updated to: <strong>${status || ticket.status}</strong></p>
                </div>
              </div>`,
          }),
        });
      } catch (e) {
        console.error('[Support] Reply email failed:', e);
      }
    }

    return res.json({ success: true, message: 'Reply sent and ticket updated' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to reply' });
  }
});

app.get('/api/canteen/qr/verify', async (req, res) => {
  const { code } = req.query;
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ success: false, error: 'QR code parameter is required.' });
  }

  try {
    const crypto = await import('crypto');
    let orderId: string;
    let sig: string;
    let ts: string;

    // Try JSON payload format first: {"o":"orderId","t":"timestamp","s":"signature"}
    try {
      const parsed = JSON.parse(code);
      if (parsed.o && parsed.s && parsed.t) {
        orderId = parsed.o;
        sig = parsed.s;
        ts = parsed.t;
        const expectedSig = crypto.createHmac('sha256', QR_SECRET).update(`${orderId}.${ts}`).digest('hex');
        if (sig !== expectedSig) {
          return res.status(400).json({ success: false, verified: false, error: 'QR signature verification failed. Invalid or tampered code.' });
        }
      } else {
        orderId = code;
      }
    } catch {
      // Not JSON - treat as raw order ID or QR_xxx format
      orderId = code.replace(/^QR_/, '').split('_')[0];
    }

    // Look up order in PostgreSQL or in-memory
    let targetOrder: Order | undefined;
    if (pgReady) {
      try {
        const doc = await pgGetById('orders', orderId);
        if (doc) {
          targetOrder = doc as Order;
        }
      } catch (err) {
        console.error('QR verify PostgreSQL error:', err);
      }
    }

    if (!targetOrder) {
      targetOrder = canteenState.orders.find(o => o.id === orderId || o.qrCode === code || o.id === code);
    }

    if (!targetOrder) {
      return res.status(404).json({ success: false, verified: false, error: `No order found matching code "${orderId}".` });
    }

    // Check if order is already collected/delivered
    if (targetOrder.status === 'collected' || targetOrder.status === 'delivered') {
      return res.json({
        success: true,
        verified: true,
        alreadyCollected: true,
        order: targetOrder,
        message: `Order ${targetOrder.id} has already been collected.`
      });
    }

    return res.json({
      success: true,
      verified: true,
      order: targetOrder,
      message: `Order ${targetOrder.id} verified successfully. Status: ${targetOrder.status}`
    });
  } catch (err: any) {
    console.error('QR verification error:', err);
    res.status(500).json({ success: false, error: 'Server error during QR verification.' });
  }
});

app.post('/api/canteen/qr/verify', async (req, res) => {
  const { code, orderId: directOrderId } = req.body;
  const scanInput = (code || directOrderId || '').trim();
  if (!scanInput) {
    return res.status(400).json({ success: false, error: 'QR code or order ID is required.' });
  }

  console.log('--- QR VERIFY --- scanInput:', scanInput);

  try {
    const crypto = await import('crypto');
    let orderId: string | null = null;
    let billNumber: string | null = null;
    let isWalkin = false;

    // Try JSON payload format
    try {
      const parsed = JSON.parse(scanInput);
      // Signed order QR: { o, s, t }
      if (parsed.o && parsed.s && parsed.t) {
        orderId = parsed.o;
        const expectedSig = crypto.createHmac('sha256', QR_SECRET).update(`${orderId}.${parsed.t}`).digest('hex');
        if (parsed.s !== expectedSig) {
          return res.status(400).json({ success: false, verified: false, error: 'QR signature verification failed.' });
        }
      }
      // Walk-in bill QR: { bill, total, date, verify }
      else if (parsed.bill) {
        billNumber = String(parsed.bill).trim();
        isWalkin = true;
      }
    } catch {
      // Plain text — treat as bill number or order ID
      billNumber = scanInput;
      isWalkin = true;
    }

    console.log('--- QR VERIFY --- parsed:', { billNumber, orderId, isWalkin });

    let targetOrder: any = null;

    // --- Walk-in bill lookup (PostgreSQL) ---
    // Check orders collection first (has correct 'ready' status), then walkin_bills
    if (isWalkin && billNumber && pgReady) {
      // 0. Check orders collection first (walkin bills now saved here with correct status)
      try {
        const order = await pgGetById('orders', billNumber);
        console.log('--- QR VERIFY --- orders by doc ID:', order !== null);
        if (order) {
          targetOrder = { id: billNumber, ...order };
        }
      } catch (err) {
        console.error('QR verify orders doc ID lookup error:', err);
      }

      // 1. Direct doc ID lookup in walkin_bills (fallback)
      if (!targetOrder) {
        try {
          const bill = await pgGetById('walkin_bills', billNumber);
          console.log('--- QR VERIFY --- walkin_bills by doc ID:', bill !== null);
          if (bill) {
            targetOrder = {
              id: billNumber,
              userId: bill.customerRegNo || 'walkin',
              userName: bill.customerName || 'Walk-in Customer',
              items: bill.items || [],
              totalPrice: bill.grandTotal || 0,
              paymentStatus: bill.paymentStatus || 'pending',
              paymentMethod: bill.paymentMethod || 'cash',
              qrCode: bill.billNumber,
              status: bill.status || (bill.paymentStatus === 'paid' ? 'ready' : 'pending'),
              timestamp: bill.timestamp,
              createdAt: bill.createdAt,
              canteenId: bill.canteenId,
              type: 'walkin',
              billNumber: bill.billNumber,
              customerName: bill.customerName,
              customerEmail: bill.customerPhone,
              customerRegNo: bill.customerRegNo,
            };
          }
        } catch (err) {
          console.error('QR verify walkin doc ID lookup error:', err);
        }
      }

      // 2. Fallback: query by billNumber field (for bills saved before doc ID change)
      if (!targetOrder) {
        try {
          const results = await pgGetWhere('walkin_bills', { billNumber });
          console.log('--- QR VERIFY --- walkin_bills by billNumber field:', results.length, 'docs');
          if (results.length > 0) {
            const bill = results[0];
            targetOrder = {
              id: billNumber,
              userId: bill.customerRegNo || 'walkin',
              userName: bill.customerName || 'Walk-in Customer',
              items: bill.items || [],
              totalPrice: bill.grandTotal || 0,
              paymentStatus: bill.paymentStatus || 'pending',
              paymentMethod: bill.paymentMethod || 'cash',
              qrCode: bill.billNumber,
              status: bill.status || (bill.paymentStatus === 'paid' ? 'ready' : 'pending'),
              timestamp: bill.timestamp,
              createdAt: bill.createdAt,
              canteenId: bill.canteenId,
              type: 'walkin',
              billNumber: bill.billNumber,
              customerName: bill.customerName,
              customerEmail: bill.customerPhone,
              customerRegNo: bill.customerRegNo,
            };
          }
        } catch (err) {
          console.error('QR verify walkin field query error:', err);
        }
      }
    }

    // --- Regular order lookup ---
    if (!targetOrder) {
      const searchOrderId = orderId || billNumber;
      if (searchOrderId && pgReady) {
        try {
          const doc = await pgGetById('orders', searchOrderId);
          if (doc) {
            targetOrder = doc as Order;
          }
        } catch (err) {
          console.error('QR verify POST PostgreSQL error:', err);
        }
      }

      // In-memory fallback
      if (!targetOrder && searchOrderId) {
        targetOrder = canteenState.orders.find(o =>
          o.id === searchOrderId ||
          (o as any).qrCode === searchOrderId ||
          o.id === scanInput
        );
      }
    }

    if (!targetOrder) {
      console.log('--- QR VERIFY --- NOT FOUND for:', scanInput);
      return res.status(404).json({ success: false, verified: false, error: `No order found matching "${scanInput}".` });
    }

    console.log('--- QR VERIFY --- FOUND:', targetOrder.id, targetOrder.status);

    // If action is collect, update status to collected
    const action = req.body.action;
    if (action === 'collect') {
      if (targetOrder.status === 'collected' || targetOrder.status === 'delivered') {
        return res.json({
          success: true,
          verified: true,
          alreadyCollected: true,
          order: targetOrder,
          message: `Order ${targetOrder.id} has already been collected.`
        });
      }
      // Update status to collected
      if (pgReady) {
        try {
          await pgUpdate('orders', targetOrder.id, { status: 'collected' });
        } catch (e) {
          console.error('Error updating order status:', e);
        }
      }
      targetOrder.status = 'collected';
    }

    return res.json({
      success: true,
      verified: true,
      order: targetOrder,
      message: `Order ${targetOrder.id} verified. Status: ${targetOrder.status}`
    });
  } catch (err: any) {
    console.error('QR verification POST error:', err);
    res.status(500).json({ success: false, error: 'Server error during QR verification.' });
  }
});

// 5. Update Order Status (Owner / Customer collection pickup)
app.post('/api/canteen/order/status', async (req, res) => {
  const { id, status } = req.body;

  if (!id || !status) {
    return res.status(400).json({ success: false, error: 'Order ID and status are required.' });
  }

  // Map 'delivered' to 'collected' for compatibility
  const mappedStatus = (status === 'delivered') ? 'collected' : status;

  // Try walkin_bills first
  if (pgReady) {
    try {
      const walkinDoc = await pgGetById('walkin_bills', id);
      if (walkinDoc) {
        const bill = walkinDoc;
        const updated = { ...bill, paymentStatus: mappedStatus === 'collected' || mappedStatus === 'delivered' ? 'paid' : bill.paymentStatus, status: mappedStatus };
        await pgUpdate('walkin_bills', id, updated);
        // Update in-memory state too
        canteenState.orders = canteenState.orders.map(order => order.id === id ? { ...order, status: mappedStatus } : order);
        return res.json({ success: true, message: `Walk-in bill status set to: ${mappedStatus}` });
      }
    } catch (err) {
      console.error('PostgreSQL walkin bill status update error:', err);
    }
  }

  let targetOrder: Order | undefined;
  if (pgReady) {
    try {
      const doc = await pgGetById('orders', id);
      if (doc) {
        targetOrder = doc as Order;
      }
    } catch (err) {
      console.error(err);
    }
  }

  if (!targetOrder) {
    targetOrder = canteenState.orders.find(order => order.id === id);
  }

  if (!targetOrder) {
    return res.status(404).json({ success: false, error: 'Order not found.' });
  }

  // Read-only status probe used by client payment polling — must NEVER mutate the order
  if (status === 'check') {
    return res.json({ success: true, order: targetOrder });
  }

  let pickupText = targetOrder.pickupTimeText;
  if (status === 'preparing') pickupText = 'Chef is preparing your meal';
  if (status === 'ready') pickupText = 'Ready! Scan QR code at the counter to collect.';
  if (status === 'collected' || status === 'delivered') pickupText = 'Collected';
  if (status === 'expired') pickupText = 'Expired (Not collected on time)';
  if (status === 'cancelled') pickupText = 'Cancelled';

  const updatedOrder = { ...targetOrder, status: mappedStatus, pickupTimeText: pickupText };

  if (pgReady) {
    try {
      await pgSet('orders', id, updatedOrder);
    } catch (err) {
      console.error('PostgreSQL order update status error:', err);
    }
  }

  canteenState.orders = canteenState.orders.map(order => order.id === id ? updatedOrder : order);

  // Phase 3: Update kitchen operations on status change
  if (pgReady) {
    try {
      const targetCanteenId = targetOrder.canteenId || 'canteen_001';
      const ops = await pgGetWhere('kitchen_operations', { canteenId: targetCanteenId });
      if (ops.length > 0) {
        let activeDelta = 0;
        if (mappedStatus === 'ready' || mappedStatus === 'collected' || mappedStatus === 'expired' || mappedStatus === 'cancelled') {
          activeDelta = -1;
        }
        const newActive = Math.max(0, (ops[0].activeOrders || 0) + activeDelta);
        await pgUpdate('kitchen_operations', ops[0].id, {
          activeOrders: newActive,
          lastUpdated: Date.now(),
        });
      }

      // Update prep_metrics for preparing -> ready transition
      if (mappedStatus === 'ready') {
        const metricId = `prep_${id}`;
        const existing = await pgGetById('preparation_metrics', metricId);
        if (existing) {
          const actualTime = existing.prepStartTime ? Math.round((Date.now() - existing.prepStartTime) / 60000) : 0;
          await pgUpdate('preparation_metrics', metricId, {
            prepEndTime: Date.now(),
            actualPrepTime: actualTime,
            status: 'completed',
          });
        }
      }
    } catch (err) {
      console.error('Kitchen operations update on status change error:', err);
    }
  }

  res.json({ success: true, message: `Order status set to: ${mappedStatus}` });
});

// 5a. Update Order Pickup Slot (Owner editing order)
app.post('/api/canteen/order/update-slot', async (req, res) => {
  const { id, pickupSlot } = req.body;
  if (!id || !pickupSlot) {
    return res.status(400).json({ success: false, error: 'Order ID and slot are required.' });
  }

  let targetOrder: Order | undefined;
  if (pgReady) {
    try {
      const doc = await pgGetById('orders', id);
      if (doc) {
        targetOrder = doc as Order;
      }
    } catch (err) {
      console.error(err);
    }
  }

  if (!targetOrder) {
    targetOrder = canteenState.orders.find(order => order.id === id);
  }

  if (!targetOrder) {
    return res.status(404).json({ success: false, error: 'Order not found.' });
  }

  const updatedOrder = { ...targetOrder, pickupSlot };

  if (pgReady) {
    try {
      await pgSet('orders', id, updatedOrder);
    } catch (err) {
      console.error(err);
    }
  }

  canteenState.orders = canteenState.orders.map(order => order.id === id ? updatedOrder : order);
  saveLocalDB();
  res.json({ success: true, order: updatedOrder });
});

// 5b. Update Batch Orders Status (Smart Batch Cooking)
app.post('/api/canteen/order/batch-status', async (req, res) => {
  const { ids, status } = req.body;
  if (!ids || !Array.isArray(ids) || !status) {
    return res.status(400).json({ success: false, error: 'Order IDs array and target status are required.' });
  }

  const updatedOrders: Order[] = [];

  for (const id of ids) {
    let targetOrder: Order | undefined;
    if (pgReady) {
      try {
        const doc = await pgGetById('orders', id);
        if (doc) {
          targetOrder = doc as Order;
        }
        } catch (e) { console.warn('Order lookup failed:', e); }
    } else {
      targetOrder = canteenState.orders.find(o => o.id === id);
    }

    if (targetOrder) {
      let pickupText = targetOrder.pickupTimeText;
      if (status === 'preparing') pickupText = 'Chef is preparing your meal';
      if (status === 'ready') pickupText = 'Ready! Scan QR code at the counter to collect.';
      if (status === 'collected' || status === 'delivered') pickupText = 'Collected';
      if (status === 'expired') pickupText = 'Expired (Not collected on time)';
      if (status === 'cancelled') pickupText = 'Cancelled';

      const mappedStatus = (status === 'delivered') ? 'collected' : status;
      const updated = { ...targetOrder, status: mappedStatus, pickupTimeText: pickupText };

      if (pgReady) {
        await pgSet('orders', id, updated);
      }
      canteenState.orders = canteenState.orders.map(o => o.id === id ? updated : o);
      updatedOrders.push(updated);
    }
  }

  res.json({ success: true, count: updatedOrders.length, message: `Updated status to ${status} for ${updatedOrders.length} orders.` });
});

// 6. Add Review & Trigger sentiment analyzer (Customer)
app.post('/api/canteen/review', async (req, res) => {
  const { userId, userName, rating, comment, menuItemId, menuItemName } = req.body;

  if (!rating || !comment) {
    return res.status(400).json({ success: false, error: 'Rating and comment text are required.' });
  }

  const reviewId = `rev_${Date.now()}`;
  let detectedSentiment: 'positive' | 'neutral' | 'negative' = 'neutral';

  if (genAI) {
    try {
      const response = await generateContentWithFallback({
        model: 'gemini-3.5-flash',
        contents: `Analyze the sentiment of this food review. Determine if it is positive, neutral, or negative. Respond with exactly one of those words: "positive", "neutral", "negative". All lowercase.\nReview: "${comment}"`,
      });
      const aiSentiment = response.text ? response.text.trim().toLowerCase() : 'neutral';
      if (aiSentiment.includes('positive')) detectedSentiment = 'positive';
      else if (aiSentiment.includes('negative')) detectedSentiment = 'negative';
      else if (aiSentiment.includes('neutral')) detectedSentiment = 'neutral';
    } catch (err) {
      console.error('Gemini sentiment service error, fallback to local search:', err);
      detectedSentiment = classifyRuleBasedSentiment(comment);
    }
  } else {
    detectedSentiment = classifyRuleBasedSentiment(comment);
  }

  const newReview: Review = {
    id: reviewId,
    userId: userId || 'user_guest',
    userName: userName || 'Guest User',
    rating: Number(rating),
    comment,
    sentiment: detectedSentiment,
    timestamp: new Date().toISOString(),
    menuItemId,
    menuItemName,
  };

  if (pgReady) {
    try {
      await pgSet('reviews', reviewId, newReview);
      if (menuItemId) {
        const item = await pgGetById('items', menuItemId);
        if (item) {
          const count = item.ratingCount || 0;
          const currentRating = item.rating || 5.0;
          const newRating = ((currentRating * count) + Number(rating)) / (count + 1);
          item.rating = Number(newRating.toFixed(1));
          item.ratingCount = count + 1;
          await pgSet('items', menuItemId, item);
        }
      }
    } catch (err) {
      console.error('PostgreSQL save review error:', err);
    }
  }

  canteenState.reviews.unshift(newReview);

  if (menuItemId) {
    canteenState.items = canteenState.items.map(item => {
      if (item.id === menuItemId) {
         const count = item.ratingCount || 0;
         const currentRating = item.rating || 5.0;
         const newRating = ((currentRating * count) + Number(rating)) / (count + 1);
         return {
           ...item,
           rating: Number(newRating.toFixed(1)),
           ratingCount: count + 1
         };
      }
      return item;
    });
  }

  res.json({ success: true, review: newReview, message: 'Review added. Sentiment calculated.' });
});

// 7. Reset state (for demo debugging)
app.post('/api/canteen/reset', async (req, res) => {
  if (pgReady) {
    try {
      await pgDeleteWhere('items', {});
      await pgDeleteWhere('orders', {});
      await pgDeleteWhere('reviews', {});
      await seedPostgresIfNeeded();
    } catch (err) {
      console.error('PostgreSQL reset error:', err);
    }
  }

  const canteenId = (req.body.canteenId || req.query.canteenId || 'canteen_001') as string;
  const targetCanteen = getCanteenState(canteenId);
  const resetCanteen: Canteen = {
    id: canteenId,
     name: canteenId === 'canteen_001' ? 'Esc(Q)' : 'Default Canteen',
    collegeId: targetCanteen.collegeId || 'college_001',
    ownerId: targetCanteen.ownerId || 'user_owner_default',
    status: targetCanteen.status || 'active',
    ownerName: targetCanteen.ownerName || 'Chef Watson',
    items: [...INITIAL_MENU_ITEMS],
    orders: [...INITIAL_ORDERS],
    reviews: [...INITIAL_REVIEWS],
    ingredients: [...INITIAL_INGREDIENTS],
    settings: { ...canteenSettings, canteenId }
  };
  const idx = canteensState.findIndex(x => x.id === canteenId);
  if (idx !== -1) {
    canteensState[idx] = resetCanteen;
  }
  res.json({ success: true, canteen: resetCanteen });
});

// Expiry checker logic
async function checkExpiredOrders() {
  const now = Date.now();
  let ordersToUpdate: Order[] = [];
  if (pgReady) {
    try {
      const results = await pgGetWhere('orders', { status: 'ready' });
      for (const o of results) {
        if (o.expiryTime && now > o.expiryTime) {
          o.status = 'expired';
          o.pickupTimeText = 'Expired (Not collected on time)';
          await pgSet('orders', o.id, o);
          ordersToUpdate.push(o);
        }
      }
    } catch (e) {
      console.error('PostgreSQL expiry check error:', e);
    }
  } else {
    canteenState.orders = canteenState.orders.map(o => {
      if (o.status === 'ready' && o.expiryTime && now > o.expiryTime) {
        o.status = 'expired';
        o.pickupTimeText = 'Expired (Not collected on time)';
        ordersToUpdate.push(o);
      }
      return o;
    });
  }
  if (ordersToUpdate.length > 0) {
    console.log(`Auto-expired ${ordersToUpdate.length} ready orders.`);
  }
}

// 7b. Update Settings (Owner)
app.post('/api/canteen/settings', async (req, res) => {
  const { noShowMinutes, defaultSlotCapacity, canteenId } = req.body;
  const targetCanteenId = (typeof canteenId === 'string' && canteenId.trim()) ? canteenId.trim() : 'canteen_001';

  if (noShowMinutes !== undefined) canteenSettings.noShowMinutes = Number(noShowMinutes);
  if (defaultSlotCapacity !== undefined) canteenSettings.defaultSlotCapacity = Number(defaultSlotCapacity);

  if (pgReady) {
    try {
      await pgSet('settings', `settings_${targetCanteenId}`, {
        noShowMinutes: Number(canteenSettings.noShowMinutes),
        defaultSlotCapacity: Number(canteenSettings.defaultSlotCapacity),
        canteenId: targetCanteenId
      });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ success: false, error: 'Failed to save settings to database.' });
    }
  }
  canteenState.settings = canteenSettings;
  res.json({ success: true, settings: canteenSettings, message: 'Settings updated successfully.' });
});

// 7c. Update Ingredients Stock (Owner) - Batch Update
app.post('/api/canteen/ingredients/batch', async (req, res) => {
  const { ingredients } = req.body;
  if (!ingredients || !Array.isArray(ingredients)) {
    return res.status(400).json({ success: false, error: 'Ingredients array required.' });
  }

  for (const ing of ingredients) {
    const match = canteenState.ingredients?.find(i => i.id === ing.id);
    if (match) {
      match.stockGrams = ing.stockGrams;
      match.name = ing.name;
      match.unit = ing.unit;
    } else {
      canteenState.ingredients?.push(ing);
    }
    if (pgReady) {
      try {
        await pgSet('ingredients', ing.id, ing);
      } catch (e) {
        console.error(e);
      }
    }
  }
  res.json({ success: true, ingredients: canteenState.ingredients, message: 'Ingredients updated successfully.' });
});

// Help functions
function classifyRuleBasedSentiment(text: string): 'positive' | 'neutral' | 'negative' {
  const norm = text.toLowerCase();
  const posWords = ['great', 'delicious', 'good', 'crisp', 'fast', 'love', 'amazing', 'tasty', 'fresh', 'best', 'authentic'];
  const negWords = ['bad', 'cold', 'slow', 'poor', 'disappointed', 'late', 'rubbish', 'worst', 'stale', 'horrible', 'delay'];
  
  let posCount = 0;
  let negCount = 0;
  
  posWords.forEach(w => { if (norm.includes(w)) posCount++; });
  negWords.forEach(w => { if (norm.includes(w)) negCount++; });

  if (posCount > negCount) return 'positive';
  if (negCount > posCount) return 'negative';
  return 'neutral';
}


// -------------------------------------------------------------
// WALK-IN BILLING (POS) ENDPOINT
app.post('/api/canteen/walkin-bill', async (req, res) => {
  try {
    const bill = req.body;
    const docId = bill.billNumber || `walkin_${Date.now()}`;
    bill.id = docId;
    bill.synced = !!pgReady;

    // Build the order object (same structure as online orders)
    const orderData: any = {
      id: docId,
      userId: bill.customerRegNo || 'walkin',
      userName: bill.customerName || 'Walk-in Customer',
      items: bill.items.map((it: any) => ({ itemId: it.itemId, name: it.name, price: it.price, quantity: it.quantity })),
      totalPrice: bill.grandTotal,
      paymentStatus: bill.paymentStatus === 'paid' ? 'paid' : 'pending',
      paymentMethod: bill.paymentMethod || 'cash',
      qrCode: bill.billNumber,
      status: 'ready',
      timestamp: bill.timestamp || new Date().toISOString(),
      createdAt: bill.createdAt || Date.now(),
      canteenId: bill.canteenId || 'canteen_001',
      subCanteenId: bill.subCanteenId || 'sub_001',
      type: 'walkin',
      billNumber: bill.billNumber,
      customerName: bill.customerName,
      customerEmail: bill.customerPhone,
      customerRegNo: bill.customerRegNo,
      grandTotal: bill.grandTotal,
    };

    console.log('--- WALKIN BILL --- docId:', docId, 'db:', !!pgReady);

    if (pgReady) {
      // Save to BOTH collections for maximum reliability
      try {
        await pgSet('walkin_bills', docId, { ...bill, id: docId });
        console.log('--- WALKIN BILL SAVED to walkin_bills ---');
      } catch (e: any) {
        console.error('--- WALKIN BILL walkin_bills save FAILED ---', e?.message);
      }
      try {
        await pgSet('orders', docId, orderData);
        console.log('--- WALKIN BILL SAVED to orders ---');
      } catch (e: any) {
        console.error('--- WALKIN BILL orders save FAILED ---', e?.message);
      }

      bill.id = docId;
      bill.synced = true;
    }

    // Always update in-memory inventory (works with or without PostgreSQL)
    for (const item of orderData.items) {
      const menuItem = canteenState.items.find(m => m.id === item.itemId);
      if (menuItem) {
        menuItem.bookedToday += item.quantity;
        menuItem.stock = Math.max(0, menuItem.stock - item.quantity);
      }
    }

    // Update PostgreSQL inventory if available
    if (pgReady) {
      for (const item of bill.items) {
        try {
          const results = await pgGetWhere('items', { id: item.itemId });
          if (results.length > 0) {
            const doc = results[0];
            await pgIncrement('items', doc.id, 'bookedToday', item.quantity);
            await pgIncrement('items', doc.id, 'stock', -item.quantity);
          }
        } catch (e: any) {
          console.error('--- WALKIN BILL inventory update FAILED ---', e?.message);
        }
      }
    }

    // Always store in in-memory state (works for same-instance scanning)
    canteenState.orders.push(orderData);

    res.json({ success: true, bill, order: orderData });
  } catch (error: any) {
    console.error('Walk-in bill error:', error?.message || error);
    res.status(500).json({ success: false, error: 'Failed to create walk-in bill' });
  }
});

// Lookup walk-in bill by bill number (for QR scan)
app.get('/api/canteen/walkin-bill/lookup', async (req, res) => {
  try {
    const { billNumber } = req.query;
    if (!billNumber) {
      return res.status(400).json({ success: false, error: 'billNumber is required' });
    }
    console.log('--- WALKIN LOOKUP --- billNumber:', billNumber);
    if (pgReady) {
      // 1. Direct doc ID lookup
      const bill = await pgGetById('walkin_bills', String(billNumber));
      if (bill) {
        return res.json({
          success: true,
          order: {
            id: String(billNumber),
            userId: bill.customerRegNo || 'walkin',
            userName: bill.customerName || 'Walk-in Customer',
            items: bill.items || [],
            totalPrice: bill.grandTotal || 0,
            paymentStatus: bill.paymentStatus || 'pending',
            paymentMethod: bill.paymentMethod || 'cash',
            qrCode: bill.billNumber,
            status: bill.status || (bill.paymentStatus === 'paid' ? 'ready' : 'pending'),
            timestamp: bill.timestamp,
            createdAt: bill.createdAt,
            canteenId: bill.canteenId,
            type: 'walkin',
            billNumber: bill.billNumber,
            customerName: bill.customerName,
            customerEmail: bill.customerPhone,
            customerRegNo: bill.customerRegNo,
          }
        });
      }
      // 2. Field query fallback
      const results = await pgGetWhere('walkin_bills', { billNumber: String(billNumber) });
      if (results.length > 0) {
        const bill = results[0];
        return res.json({
          success: true,
          order: {
            id: String(billNumber),
            userId: bill.customerRegNo || 'walkin',
            userName: bill.customerName || 'Walk-in Customer',
            items: bill.items || [],
            totalPrice: bill.grandTotal || 0,
            paymentStatus: bill.paymentStatus || 'pending',
            paymentMethod: bill.paymentMethod || 'cash',
            qrCode: bill.billNumber,
            status: bill.status || (bill.paymentStatus === 'paid' ? 'ready' : 'pending'),
            timestamp: bill.timestamp,
            createdAt: bill.createdAt,
            canteenId: bill.canteenId,
            type: 'walkin',
            billNumber: bill.billNumber,
            customerName: bill.customerName,
            customerEmail: bill.customerPhone,
            customerRegNo: bill.customerRegNo,
          }
        });
      }
    }
    return res.status(404).json({ success: false, error: `Walk-in bill ${billNumber} not found` });
  } catch (error) {
    console.error('Walkin bill lookup error:', error);
    res.status(500).json({ success: false, error: 'Failed to lookup walk-in bill' });
  }
});

// Get walk-in bills
app.get('/api/canteen/walkin-bills', async (req, res) => {
  try {
    const { canteenId, from, to } = req.query;
    if (pgReady) {
      let bills: any[] = [];
      if (canteenId) {
        bills = await pgGetWhereOrdered('walkin_bills', { canteenId }, 'created_at', 'desc', 500);
      } else {
        bills = await pgGetAll('walkin_bills');
      }
      res.json({ success: true, bills });
    } else {
      const bills = canteenState.orders.filter((o: any) => o.type === 'walkin');
      res.json({ success: true, bills });
    }
  } catch (error) {
    console.error('Get walkin bills error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch walk-in bills' });
  }
});

// Mark pending walk-in bill as paid
app.post('/api/canteen/walkin-bill/mark-paid', async (req, res) => {
  try {
    const { billId, paymentMethod } = req.body;
    if (pgReady) {
      await pgUpdate('walkin_bills', billId, { paymentStatus: 'paid', paymentMethod: paymentMethod || 'cash' });
    }
    const order = canteenState.orders.find((o: any) => o.id === billId || o.qrCode === billId);
    if (order) {
      order.paymentStatus = 'paid';
      order.paymentMethod = paymentMethod || 'cash';
      order.status = 'delivered';
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Mark paid error:', error);
    res.status(500).json({ success: false, error: 'Failed to mark as paid' });
  }
});

// AI ENDPOINTS powered by server-side Gemini 3.5-flash
// -------------------------------------------------------------

// AI Smart Recommendations API
app.post('/api/ai/recommend', async (req, res) => {
  const { orderHistory, timeOfDay, currentTempCelsius } = req.body;
  const time = timeOfDay || 'Afternoon';
  
  // Format items lists for the model context
  const menuSummary = canteenState.items
    .filter(i => i.stock > 0)
    .map(i => `${i.id}: ${i.name} (Price Rs.${i.price}, Category: ${i.category}, tags: [${(i.tags || []).join(', ')}])`)
    .join('\n');

  const systemInstruction = `You are the smart AI recommendations engine for "QR Dine", a canteen food ordering app.
Based on the current time of day, user order history, and available menu stock, you need to suggest exactly 2 or 3 food items from the menu that would be most enticing right now.
For example, Coffee or light snacks in mornings, heavy meal/combos at lunch.
Your output must be structured exactly in JSON matching this schema:
{
  "title": "A catchy lavender purple thematic recommendation card title, e.g., Sunup Aromas, Spicy Lunch Selections, Sunset Cravings",
  "reason": "An elegant, human-like 1-sentence reason explaining why these are recommended based on context (time of day / taste)",
  "itemIds": ["list of strings containing matching item IDs from the menu, e.g., ['item_001', 'item_002']"]
}`;

  if (genAI) {
    try {
      const response = await generateContentWithFallback({
        model: 'gemini-3.5-flash',
        contents: `Recommend items from the following canteen menu:\n${menuSummary}\n\nContext criteria:\nTime of day: ${time}\nOrder History hints: ${JSON.stringify(orderHistory || [])}\nTemperature outside: ${currentTempCelsius || 31}°C.`,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              reason: { type: Type.STRING },
              itemIds: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ['title', 'reason', 'itemIds']
          }
        }
      });

      const designRec = JSON.parse(response.text?.trim() || '{}');
      return res.json({ success: true, recommendation: designRec });
    } catch (error) {
      console.error('Gemini Recommendation failure. Falling back to local rules:', error);
    }
  }

  // Fallback Rule-Based Smart Recommendation (Pillar 2 schema compliant)
  const isMorning = ['Morning', '8:00 AM', 'Breakfast'].some(m => time.toLowerCase().includes(m.toLowerCase()));
  const isMealTime = ['Noon', 'Lunch', 'Afternoon'].some(l => time.toLowerCase().includes(l.toLowerCase()));
  
  let recIds: string[] = [];
  let title = 'Popular Daily Picks';
  let reason = 'These are the top items voted highly by your campus peers right now.';

  if (isMorning) {
    title = 'Morning Fresh Energizers';
    reason = 'Rich frothed filter coffee paired with light south Indian idlis are the perfect kickstart to a study day.';
    recIds = ['item_002', 'item_005'];
  } else if (isMealTime) {
    title = 'Savory Midday Combo';
    reason = 'Recharge your energy for upcoming lectures with our hearty paneer butter masala combo.';
    recIds = ['item_003', 'item_001'];
  } else {
    title = 'Midday Tea & Treats';
    reason = 'Perfect sweet chocolate indulgence and hot beverages to fuel your afternoon sessions.';
    recIds = ['item_004', 'item_002'];
  }

  // Ensure items are available in stock
  const validIds = recIds.filter(id => canteenState.items.find(i => i.id === id && i.stock > 0));

  res.json({
    success: true,
    recommendation: {
      title,
      reason,
      itemIds: validIds.length > 0 ? validIds : ['item_001', 'item_002']
    }
  });
});

// ============================================================================
// PHASE 3: SMART CANTEEN OPERATIONS - Kitchen Dashboard & Queue Management
// ============================================================================

// Apply auth to kitchen/owner write endpoints
app.use('/api/kitchen', (req, res, next) => {
  if (req.method === 'GET') return next();
  authMiddleware(req, res, next);
});
app.use('/api/owner', (req, res, next) => {
  if (req.method === 'GET') return next();
  authMiddleware(req, res, next);
});
app.use('/api/analytics', (req, res, next) => {
  authMiddleware(req, res, next);
});
app.use('/api/waste', (req, res, next) => {
  if (req.method === 'GET') return next();
  authMiddleware(req, res, next);
});
app.use('/api/predictions', (req, res, next) => {
  if (req.method === 'GET') return next();
  authMiddleware(req, res, next);
});
app.use('/api/recommendations', (req, res, next) => {
  if (req.method === 'GET') return next();
  authMiddleware(req, res, next);
});
app.use('/api/sync', (req, res, next) => {
  authMiddleware(req, res, next);
});

// 3a. GET /api/kitchen/dashboard - Live kitchen dashboard data
app.get('/api/kitchen/dashboard', async (req, res) => {
  try {
    const canteenId = (req.query.canteenId as string) || 'canteen_001';
    const now = Date.now();

    // Get active orders (scheduled + preparing)
    let activeOrders: Order[] = [];
    let pendingOrders: Order[] = [];
    let readyOrders: Order[] = [];

    if (pgReady) {
      try {
        const allOrders = await pgGetWhere('orders', { canteenId }) as Order[];
        activeOrders = allOrders.filter(o => ['scheduled', 'preparing'].includes(o.status));
        pendingOrders = allOrders.filter(o => o.status === 'scheduled');
        readyOrders = allOrders.filter(o => o.status === 'ready');
      } catch (err) {
        console.error('Kitchen dashboard PG error:', err);
      }
    }
    if (activeOrders.length === 0) {
      activeOrders = canteenState.orders.filter(o => o.status === 'scheduled' || o.status === 'preparing');
      pendingOrders = canteenState.orders.filter(o => o.status === 'scheduled');
      readyOrders = canteenState.orders.filter(o => o.status === 'ready');
    }

    // Get kitchen operations state
    let kitchenOps: any = null;
    if (pgReady) {
      try {
        const ops = await pgGetWhere('kitchen_operations', { canteenId });
        kitchenOps = ops.length > 0 ? ops[0] : null;
      } catch (err) { console.error(err); }
    }

    // Get prep metrics for active orders
    let prepMetrics: any[] = [];
    if (pgReady) {
      try {
        prepMetrics = await pgGetWhere('preparation_metrics', { canteenId });
      } catch (err) { console.error(err); }
    }

    // Compute queue summary
    const queueByStatus = {
      pending: pendingOrders.length,
      preparing: activeOrders.filter(o => o.status === 'preparing').length,
      ready: readyOrders.length,
      total: pendingOrders.length + activeOrders.filter(o => o.status === 'preparing').length,
    };

    // Average wait time (from created_at to now for active orders)
    const avgWaitTime = activeOrders.length > 0
      ? activeOrders.reduce((sum, o) => sum + (now - (o.createdAt || now)), 0) / activeOrders.length / 60000
      : 0;

    // Counter workload
    let counterData: any[] = [];
    if (pgReady) {
      try {
        counterData = await pgGetWhere('counter_workload', { canteenId });
      } catch (err) { console.error(err); }
    }

    res.json({
      success: true,
      dashboard: {
        canteenId,
        queue: queueByStatus,
        avgWaitTimeMinutes: Math.round(avgWaitTime * 10) / 10,
        activeOrders: activeOrders.slice(0, 30),
        pendingOrders: pendingOrders.slice(0, 20),
        readyOrders: readyOrders.slice(0, 20),
        kitchenOps: kitchenOps || { activeOrders: activeOrders.length, maxCapacity: 20, status: 'normal' },
        prepMetrics: prepMetrics.slice(-20),
        counters: counterData,
        lastUpdated: now,
      }
    });
  } catch (err: any) {
    console.error('Kitchen dashboard error:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to load kitchen dashboard' });
  }
});

// 3b. POST /api/kitchen/assign - Assign order to chef/station
app.post('/api/kitchen/assign', async (req, res) => {
  try {
    const { orderId, chefId, canteenId } = req.body;
    if (!orderId) return res.status(400).json({ success: false, error: 'Order ID required' });

    const targetCanteen = canteenId || 'canteen_001';
    const now = Date.now();

    // Update prep_metrics
    if (pgReady) {
      try {
        const metricId = `prep_${orderId}`;
        await pgSet('preparation_metrics', metricId, {
          id: metricId,
          canteenId: targetCanteen,
          orderId,
          assignedTo: chefId || '',
          prepStartTime: now,
          status: 'assigned',
          createdAt: now,
        });
      } catch (err) { console.error('Assign prep metric error:', err); }
    }

    // Update kitchen_operations active count
    if (pgReady) {
      try {
        const ops = await pgGetWhere('kitchen_operations', { canteenId: targetCanteen });
        if (ops.length > 0) {
          await pgUpdate('kitchen_operations', ops[0].id, {
            activeOrders: (ops[0].activeOrders || 0) + 1,
            lastUpdated: now,
          });
        } else {
          await pgSet('kitchen_operations', `kitchen_${targetCanteen}`, {
            id: `kitchen_${targetCanteen}`,
            canteenId: targetCanteen,
            activeOrders: 1,
            maxCapacity: 20,
            assignedChefId: chefId || '',
            status: 'normal',
            lastUpdated: now,
            createdAt: now,
          });
        }
      } catch (err) { console.error('Kitchen ops update error:', err); }
    }

    res.json({ success: true, message: 'Order assigned to chef' });
  } catch (err: any) {
    console.error('Kitchen assign error:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to assign order' });
  }
});

// 3c. POST /api/kitchen/prep-start - Mark order prep started
app.post('/api/kitchen/prep-start', async (req, res) => {
  try {
    const { orderId, chefId, canteenId } = req.body;
    if (!orderId) return res.status(400).json({ success: false, error: 'Order ID required' });

    const now = Date.now();
    const targetCanteen = canteenId || 'canteen_001';

    // Update prep metric
    if (pgReady) {
      try {
        const metricId = `prep_${orderId}`;
        const existing = await pgGetById('preparation_metrics', metricId);
        await pgSet('preparation_metrics', metricId, {
          ...(existing || {}),
          id: metricId,
          canteenId: targetCanteen,
          orderId,
          assignedTo: chefId || (existing?.assignedTo || ''),
          prepStartTime: now,
          status: 'preparing',
          createdAt: existing?.createdAt || now,
        });
      } catch (err) { console.error(err); }
    }

    // Update order prep_start_time
    let targetOrder: Order | undefined;
    if (pgReady) {
      try {
        const doc = await pgGetById('orders', orderId);
        if (doc) targetOrder = doc as Order;
      } catch (err) { console.error(err); }
    }
    if (!targetOrder) targetOrder = canteenState.orders.find(o => o.id === orderId);

    if (targetOrder) {
      const updatedOrder = { ...targetOrder, prepStartTime: now };
      if (pgReady) {
        try { await pgSet('orders', orderId, updatedOrder); } catch (err) { console.error(err); }
      }
      canteenState.orders = canteenState.orders.map(o => o.id === orderId ? updatedOrder : o);
    }

    res.json({ success: true, message: 'Preparation started' });
  } catch (err: any) {
    console.error('Prep start error:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to start preparation' });
  }
});

// 3d. POST /api/kitchen/prep-complete - Mark order prep completed
app.post('/api/kitchen/prep-complete', async (req, res) => {
  try {
    const { orderId, canteenId } = req.body;
    if (!orderId) return res.status(400).json({ success: false, error: 'Order ID required' });

    const now = Date.now();
    const targetCanteen = canteenId || 'canteen_001';

    // Update prep metric with actual time
    if (pgReady) {
      try {
        const metricId = `prep_${orderId}`;
        const existing = await pgGetById('preparation_metrics', metricId);
        if (existing) {
          const actualTime = existing.prepStartTime ? Math.round((now - existing.prepStartTime) / 60000) : 0;
          await pgUpdate('preparation_metrics', metricId, {
            prepEndTime: now,
            actualPrepTime: actualTime,
            status: 'completed',
          });
        }
      } catch (err) { console.error(err); }
    }

    // Update kitchen_operations active count
    if (pgReady) {
      try {
        const ops = await pgGetWhere('kitchen_operations', { canteenId: targetCanteen });
        if (ops.length > 0 && ops[0].activeOrders > 0) {
          await pgUpdate('kitchen_operations', ops[0].id, {
            activeOrders: ops[0].activeOrders - 1,
            lastUpdated: now,
          });
        }
      } catch (err) { console.error(err); }
    }

    res.json({ success: true, message: 'Preparation completed' });
  } catch (err: any) {
    console.error('Prep complete error:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to complete preparation' });
  }
});

// 3e. GET /api/kitchen/queue - Live queue data
app.get('/api/kitchen/queue', async (req, res) => {
  try {
    const canteenId = (req.query.canteenId as string) || 'canteen_001';
    let orders: Order[] = [];

    if (pgReady) {
      try {
        orders = await pgGetWhere('orders', { canteenId }) as Order[];
      } catch (err) { console.error(err); }
    }
    if (orders.length === 0) {
      orders = canteenState.orders;
    }

    const now = Date.now();
    const active = orders.filter(o => ['scheduled', 'preparing', 'ready'].includes(o.status));
    const byStatus = {
      scheduled: active.filter(o => o.status === 'scheduled').length,
      preparing: active.filter(o => o.status === 'preparing').length,
      ready: active.filter(o => o.status === 'ready').length,
    };

    const avgWaitTime = active.length > 0
      ? active.reduce((sum, o) => sum + (now - (o.createdAt || now)), 0) / active.length / 60000
      : 0;

    // Save snapshot for historical tracking
    if (pgReady) {
      try {
        const snapshotId = `snap_${canteenId}_${now}`;
        await pgSet('queue_snapshots', snapshotId, {
          id: snapshotId,
          canteenId,
          totalWaiting: byStatus.scheduled + byStatus.preparing,
          avgWaitTime: Math.round(avgWaitTime * 10) / 10,
          ordersByStatus: byStatus,
          recordedAt: now,
          createdAt: now,
        });
      } catch (err) { console.error(err); }
    }

    res.json({
      success: true,
      queue: {
        waiting: active.filter(o => o.status === 'scheduled'),
        preparing: active.filter(o => o.status === 'preparing'),
        ready: active.filter(o => o.status === 'ready'),
        counts: byStatus,
        avgWaitTimeMinutes: Math.round(avgWaitTime * 10) / 10,
        totalActive: active.length,
      }
    });
  } catch (err: any) {
    console.error('Queue data error:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to load queue data' });
  }
});

// 3f. GET /api/owner/dashboard - Owner analytics dashboard
app.get('/api/owner/dashboard', async (req, res) => {
  try {
    const canteenId = (req.query.canteenId as string) || 'canteen_001';
    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();

    let allOrders: Order[] = [];
    let items: MenuItem[] = [];
    let reviews: any[] = [];

    if (pgReady) {
      try {
        allOrders = await pgGetWhere('orders', { canteenId }) as Order[];
        items = await pgGetAll('items') as MenuItem[];
        reviews = await pgGetWhere('reviews', { canteenId });
      } catch (err) { console.error(err); }
    }
    if (allOrders.length === 0) allOrders = canteenState.orders;
    if (items.length === 0) items = canteenState.items;
    if (reviews.length === 0) reviews = canteenState.reviews || [];

    // Today's metrics
    const todayOrders = allOrders.filter(o => (o.createdAt || 0) >= todayMs);
    const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
    const completedToday = todayOrders.filter(o => ['collected', 'delivered'].includes(o.status));
    const cancelledToday = todayOrders.filter(o => o.status === 'cancelled');
    const expiredToday = todayOrders.filter(o => o.status === 'expired');

    // Average prep time (from completed orders today)
    const avgPrepTime = completedToday.length > 0
      ? completedToday.reduce((sum, o) => {
          const prepStart = o.prepStartTime || o.createdAt || now;
          const est = items.find(i => i.id === o.items?.[0]?.itemId)?.prepTime || 15;
          return sum + est;
        }, 0) / completedToday.length
      : 15;

    // Popular items
    const itemCounts: Record<string, { name: string; count: number; revenue: number }> = {};
    for (const order of todayOrders) {
      if (!order.items) continue;
      for (const item of order.items) {
        const key = item.itemId || item.name;
        if (!itemCounts[key]) itemCounts[key] = { name: item.name, count: 0, revenue: 0 };
        itemCounts[key].count += item.quantity || 1;
        itemCounts[key].revenue += (item.price || 0) * (item.quantity || 1);
      }
    }
    const popularItems = Object.entries(itemCounts)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Counter workload
    let counters: any[] = [];
    if (pgReady) {
      try {
        counters = await pgGetWhere('counter_workload', { canteenId });
      } catch (err) { console.error(err); }
    }

    // Waste summary today
    let wasteTotal = 0;
    if (pgReady) {
      try {
        const wasteRecords = await pgGetWhere('waste_records', { canteenId });
        wasteTotal = wasteRecords
          .filter((w: any) => (w.recordedAt || 0) >= todayMs)
          .reduce((sum: number, w: any) => sum + (w.estimatedCost || 0), 0);
      } catch (err) { console.error(err); }
    }

    // Rating summary
    const avgRating = reviews.length > 0
      ? reviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / reviews.length
      : 0;

    res.json({
      success: true,
      dashboard: {
        canteenId,
        today: {
          orders: todayOrders.length,
          revenue: todayRevenue,
          completed: completedToday.length,
          cancelled: cancelledToday.length,
          expired: expiredToday.length,
          avgPrepTimeMinutes: Math.round(avgPrepTime),
          wasteTotal,
        },
        popularItems,
        counters,
        avgRating: Math.round(avgRating * 10) / 10,
        totalReviews: reviews.length,
        totalMenuItems: items.length,
        totalOrdersAllTime: allOrders.length,
      }
    });
  } catch (err: any) {
    console.error('Owner dashboard error:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to load owner dashboard' });
  }
});

// 3g. POST /api/owner/counter - Update counter workload
app.post('/api/owner/counter', async (req, res) => {
  try {
    const { counterName, staffId, canteenId, assignedOrders, completedOrders, status } = req.body;
    const targetCanteen = canteenId || 'canteen_001';
    const now = Date.now();
    const counterId = `counter_${targetCanteen}_${counterName || 'default'}`;

    if (pgReady) {
      try {
        await pgSet('counter_workload', counterId, {
          id: counterId,
          canteenId: targetCanteen,
          counterName: counterName || 'Main Counter',
          staffId: staffId || '',
          assignedOrders: assignedOrders || 0,
          completedOrders: completedOrders || 0,
          status: status || 'idle',
          lastUpdated: now,
          createdAt: now,
        });
      } catch (err) { console.error(err); }
    }

    res.json({ success: true, message: 'Counter workload updated' });
  } catch (err: any) {
    console.error('Counter update error:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to update counter' });
  }
});

// ============================================================================
// PHASE 4: AI DEMAND & WASTE INTELLIGENCE
// ============================================================================

// 4a. POST /api/analytics/generate-predictions - Generate demand predictions
app.post('/api/analytics/generate-predictions', async (req, res) => {
  try {
    const { canteenId, daysBack } = req.body;
    const targetCanteen = canteenId || 'canteen_001';
    const now = Date.now();

    // Gather historical order data
    let allOrders: Order[] = [];
    if (pgReady) {
      try {
        allOrders = await pgGetWhere('orders', { canteenId: targetCanteen }) as Order[];
      } catch (err) { console.error(err); }
    }
    if (allOrders.length === 0) allOrders = canteenState.orders;

    const lookbackMs = (daysBack || 7) * 24 * 60 * 60 * 1000;
    const recentOrders = allOrders.filter(o => (o.createdAt || 0) >= (now - lookbackMs));

    // Aggregate item demand
    const demandMap: Record<string, { name: string; totalQty: number; daysAppeared: number; avgDaily: number }> = {};
    const daySet = new Set<string>();

    for (const order of recentOrders) {
      const day = new Date(order.createdAt || now).toISOString().split('T')[0];
      daySet.add(day);
      if (!order.items) continue;
      for (const item of order.items) {
        const key = item.itemId || item.name;
        if (!demandMap[key]) demandMap[key] = { name: item.name, totalQty: 0, daysAppeared: 0, avgDaily: 0 };
        demandMap[key].totalQty += item.quantity || 1;
      }
    }

    const numDays = Math.max(daySet.size, 1);
    for (const key of Object.keys(demandMap)) {
      demandMap[key].avgDaily = Math.round(demandMap[key].totalQty / numDays);
    }

    // Use Gemini for intelligent prediction if available
    let predictions: Array<{itemId: string; itemName: string; predictedQuantity: number; currentAvgDaily: number; basedOnDays: number; confidence?: number}> = Object.entries(demandMap).map(([id, data]) => ({
      itemId: id,
      itemName: data.name,
      predictedQuantity: Math.ceil(data.avgDaily * 1.15), // 15% buffer
      currentAvgDaily: data.avgDaily,
      basedOnDays: numDays,
    }));

    if (genAI) {
      try {
        const prompt = `Based on these canteen item sales over the last ${numDays} days, predict tomorrow's demand. Consider trends, weekend patterns, and typical canteen demand. Return JSON array with itemId, itemName, predictedQuantity, confidence (0-1), and reasoning.\n\nData: ${JSON.stringify(predictions.slice(0, 20))}`;
        const result = await generateContentWithFallback({
          model: 'gemini-3.5-flash',
          contents: prompt,
          config: { responseMimeType: 'application/json' },
        });
        const aiPredictions = JSON.parse(result.text || '[]');
        if (Array.isArray(aiPredictions) && aiPredictions.length > 0) {
          predictions = predictions.map(p => {
            const ai = aiPredictions.find((a: any) => a.itemId === p.itemId);
            if (ai) {
              return { ...p, predictedQuantity: ai.predictedQuantity || p.predictedQuantity, confidence: ai.confidence || 0.7 };
            }
            return { ...p, confidence: 0.5 };
          });
        }
      } catch (err) {
        console.log('Gemini prediction fallback to rule-based:', err);
      }
    }

    // Save predictions
    const predictionId = `pred_${targetCanteen}_${now}`;
    if (pgReady) {
      try {
        await pgSet('demand_predictions', predictionId, {
          id: predictionId,
          canteenId: targetCanteen,
          predictionDate: new Date(now + 86400000).toISOString().split('T')[0],
          predictedDemand: predictions,
          confidence: predictions.reduce((sum, p) => sum + (p.confidence || 0.5), 0) / Math.max(predictions.length, 1),
          basedOnDays: numDays,
          generatedAt: now,
          createdAt: now,
        });
      } catch (err) { console.error(err); }
    }

    res.json({ success: true, predictions, predictionId });
  } catch (err: any) {
    console.error('Prediction generation error:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to generate predictions' });
  }
});

// 4b. GET /api/analytics/predictions - Get latest predictions
app.get('/api/analytics/predictions', async (req, res) => {
  try {
    const canteenId = (req.query.canteenId as string) || 'canteen_001';
    let predictions: any[] = [];
    if (pgReady) {
      try {
        const preds = await pgGetWhereOrdered('demand_predictions', { canteenId }, 'created_at', 'desc', 10);
        predictions = preds;
      } catch (err) { console.error(err); }
    }
    res.json({ success: true, predictions });
  } catch (err: any) {
    console.error('Get predictions error:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to load predictions' });
  }
});

// 4c. POST /api/waste/log - Log waste record
app.post('/api/waste/log', async (req, res) => {
  try {
    const { canteenId, itemId, itemName, quantityWasted, reason, estimatedCost, recordedBy } = req.body;
    const targetCanteen = canteenId || 'canteen_001';
    const now = Date.now();
    const wasteId = `waste_${targetCanteen}_${now}`;

    const wasteRecord = {
      id: wasteId,
      canteenId: targetCanteen,
      itemId: itemId || '',
      itemName: itemName || '',
      quantityWasted: quantityWasted || 0,
      reason: reason || 'other',
      estimatedCost: estimatedCost || 0,
      recordedBy: recordedBy || '',
      recordedAt: now,
      createdAt: now,
    };

    if (pgReady) {
      try {
        await pgSet('waste_records', wasteId, wasteRecord);
      } catch (err) { console.error(err); }
    }

    res.json({ success: true, waste: wasteRecord });
  } catch (err: any) {
    console.error('Waste log error:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to log waste' });
  }
});

// 4d. GET /api/waste/summary - Get waste summary
app.get('/api/waste/summary', async (req, res) => {
  try {
    const canteenId = (req.query.canteenId as string) || 'canteen_001';
    const days = parseInt(req.query.days as string) || 30;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    let wasteRecords: any[] = [];
    if (pgReady) {
      try {
        wasteRecords = await pgGetWhere('waste_records', { canteenId });
      } catch (err) { console.error(err); }
    }

    const recentWaste = wasteRecords.filter((w: any) => (w.recordedAt || 0) >= cutoff);
    const totalCost = recentWaste.reduce((sum: number, w: any) => sum + (w.estimatedCost || 0), 0);
    const totalQuantity = recentWaste.reduce((sum: number, w: any) => sum + (w.quantityWasted || 0), 0);

    // By reason breakdown
    const byReason: Record<string, number> = {};
    for (const w of recentWaste) {
      const reason = w.reason || 'other';
      byReason[reason] = (byReason[reason] || 0) + (w.estimatedCost || 0);
    }

    // By item breakdown
    const byItem: Record<string, { name: string; quantity: number; cost: number }> = {};
    for (const w of recentWaste) {
      const key = w.itemId || w.itemName;
      if (!byItem[key]) byItem[key] = { name: w.itemName, quantity: 0, cost: 0 };
      byItem[key].quantity += w.quantityWasted || 0;
      byItem[key].cost += w.estimatedCost || 0;
    }

    res.json({
      success: true,
      summary: {
        totalCost,
        totalQuantity,
        recordCount: recentWaste.length,
        byReason,
        byItem: Object.entries(byItem).map(([id, data]) => ({ id, ...data })),
        period: `${days} days`,
      }
    });
  } catch (err: any) {
    console.error('Waste summary error:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to load waste summary' });
  }
});

// 4e. GET /api/recommendations - Get AI recommendations
app.get('/api/recommendations', async (req, res) => {
  try {
    const canteenId = (req.query.canteenId as string) || 'canteen_001';
    let recommendations: any[] = [];
    if (pgReady) {
      try {
        recommendations = await pgGetWhereOrdered('ai_recommendations', { canteenId }, 'created_at', 'desc', 20);
      } catch (err) { console.error(err); }
    }
    res.json({ success: true, recommendations });
  } catch (err: any) {
    console.error('Get recommendations error:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to load recommendations' });
  }
});

// 4f. POST /api/recommendations/generate - Generate AI recommendations
app.post('/api/recommendations/generate', async (req, res) => {
  try {
    const { canteenId } = req.body;
    const targetCanteen = canteenId || 'canteen_001';
    const now = Date.now();

    // Gather context
    let orders: Order[] = [];
    let items: MenuItem[] = [];
    let wasteRecords: any[] = [];
    let reviews: any[] = [];

    if (pgReady) {
      try {
        orders = await pgGetWhere('orders', { canteenId: targetCanteen }) as Order[];
        items = await pgGetAll('items') as MenuItem[];
        wasteRecords = await pgGetWhere('waste_records', { canteenId: targetCanteen });
        reviews = await pgGetWhere('reviews', { canteenId: targetCanteen });
      } catch (err) { console.error(err); }
    }
    if (orders.length === 0) orders = canteenState.orders;
    if (items.length === 0) items = canteenState.items;
    if (reviews.length === 0) reviews = canteenState.reviews || [];

    const contextSummary = {
      totalOrders: orders.length,
      totalItems: items.length,
      totalWasteRecords: wasteRecords.length,
      totalReviews: reviews.length,
      recentOrdersLast7Days: orders.filter(o => (o.createdAt || 0) >= now - 7 * 86400000).length,
      avgRating: reviews.length > 0 ? reviews.reduce((s: number, r: any) => s + (r.rating || 0), 0) / reviews.length : 0,
      lowStockItems: items.filter(i => i.stock < 5).map(i => i.name),
      topItems: items.sort((a, b) => (b.bookedToday || 0) - (a.bookedToday || 0)).slice(0, 5).map(i => i.name),
    };

    let generatedRecs: any[] = [];

    if (genAI) {
      try {
        const prompt = `As a canteen operations AI, analyze this data and provide 5 actionable recommendations to improve efficiency, reduce waste, and increase customer satisfaction. Return JSON array with title, description, type (efficiency/waste/customer_satisfaction/cost), and priority (low/medium/high).\n\nContext: ${JSON.stringify(contextSummary)}`;
        const result = await generateContentWithFallback({
          model: 'gemini-3.5-flash',
          contents: prompt,
          config: { responseMimeType: 'application/json' },
        });
        const aiRecs = JSON.parse(result.text || '[]');
        if (Array.isArray(aiRecs)) generatedRecs = aiRecs;
      } catch (err) {
        console.log('Gemini recommendation fallback:', err);
      }
    }

    // Fallback rule-based recommendations
    if (generatedRecs.length === 0) {
      if (contextSummary.lowStockItems.length > 0) {
        generatedRecs.push({
          title: 'Restock Low Inventory',
          description: `These items are running low: ${contextSummary.lowStockItems.join(', ')}. Consider restocking to avoid stockouts.`,
          type: 'efficiency',
          priority: 'high',
        });
      }
      if (contextSummary.totalWasteRecords > 10) {
        generatedRecs.push({
          title: 'Review Waste Patterns',
          description: 'High waste recorded. Consider adjusting prep quantities based on demand patterns.',
          type: 'waste',
          priority: 'medium',
        });
      }
      if (contextSummary.avgRating > 0 && contextSummary.avgRating < 3.5) {
        generatedRecs.push({
          title: 'Improve Food Quality',
          description: `Average rating is ${contextSummary.avgRating.toFixed(1)}/5. Focus on food quality improvements.`,
          type: 'customer_satisfaction',
          priority: 'high',
        });
      }
      generatedRecs.push({
        title: 'Optimize Prep Schedules',
        description: 'Align kitchen prep schedules with predicted demand to reduce wait times.',
        type: 'efficiency',
        priority: 'medium',
      });
      generatedRecs.push({
        title: 'Monitor Peak Hours',
        description: 'Track hourly order patterns to staff appropriately during peak periods.',
        type: 'efficiency',
        priority: 'low',
      });
    }

    // Save recommendations
    const savedRecs: any[] = [];
    if (pgReady) {
      for (const rec of generatedRecs.slice(0, 5)) {
        try {
          const recId = `rec_${targetCanteen}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const recData = {
            id: recId,
            canteenId: targetCanteen,
            type: rec.type || 'suggestion',
            title: rec.title,
            description: rec.description,
            priority: rec.priority || 'medium',
            status: 'active',
            generatedAt: now,
            createdAt: now,
          };
          await pgSet('ai_recommendations', recId, recData);
          savedRecs.push(recData);
        } catch (err) { console.error(err); }
      }
    }

    res.json({ success: true, recommendations: savedRecs.length > 0 ? savedRecs : generatedRecs.slice(0, 5) });
  } catch (err: any) {
    console.error('Generate recommendations error:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to generate recommendations' });
  }
});

// ============================================================================
// PHASE 6: OFFLINE & NETWORK RESILIENCE - Sync & Conflict Resolution
// ============================================================================

// 6a. POST /api/sync/push - Push offline changes to server
app.post('/api/sync/push', async (req, res) => {
  try {
    const { userId, canteenId, operations } = req.body;
    if (!operations || !Array.isArray(operations) || operations.length === 0) {
      return res.status(400).json({ success: false, error: 'No operations to sync' });
    }

    const now = Date.now();
    const results: any[] = [];

    for (const op of operations) {
      const syncEventId = `sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      let conflictDetected = false;
      let syncStatus = 'synced';

      try {
        // Apply the operation based on entity type
        if (op.entityType === 'order' && op.operation === 'update') {
          // Check for conflicts - has the order been modified since the client's version?
          if (pgReady && op.entityId) {
            const remoteVersion = await pgGetById('orders', op.entityId);
            if (remoteVersion && op.payload && op.payload.version) {
              if (remoteVersion.status !== op.payload.version.status) {
                conflictDetected = true;
                syncStatus = 'conflict';

                // Save conflict record
                const conflictId = `conflict_${syncEventId}`;
                await pgSet('conflict_records', conflictId, {
                  id: conflictId,
                  syncEventId,
                  entityType: op.entityType,
                  entityId: op.entityId,
                  localVersion: op.payload,
                  remoteVersion,
                  resolution: 'pending',
                  createdAt: now,
                });
              }
            }

            if (!conflictDetected) {
              await pgSet('orders', op.entityId, { ...op.payload, id: op.entityId });
            }
          }
        } else if (op.entityType === 'review' && op.operation === 'create') {
          if (pgReady) {
            await pgSet('reviews', op.entityId || `review_${now}`, { ...op.payload, id: op.entityId || `review_${now}` });
          }
        } else if (op.entityType === 'waste' && op.operation === 'create') {
          if (pgReady) {
            await pgSet('waste_records', op.entityId || `waste_${now}`, { ...op.payload, id: op.entityId || `waste_${now}` });
          }
        } else if (op.entityType === 'order' && op.operation === 'create') {
          if (pgReady) {
            await pgSet('orders', op.entityId, op.payload);
          }
        }

        // Record sync event
        if (pgReady) {
          try {
            await pgSet('synchronization_events', syncEventId, {
              id: syncEventId,
              userId: userId || '',
              canteenId: canteenId || '',
              direction: 'up',
              entityType: op.entityType,
              entityId: op.entityId || '',
              status: syncStatus,
              conflictDetected,
              syncedAt: conflictDetected ? 0 : now,
              createdAt: now,
            });
          } catch (err) { console.error(err); }
        }
      } catch (err: any) {
        syncStatus = 'error';
        console.error('Sync operation error:', err?.message);
      }

      results.push({ entityId: op.entityId, status: syncStatus, conflictDetected });
    }

    res.json({ success: true, results });
  } catch (err: any) {
    console.error('Sync push error:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to sync data' });
  }
});

// 6b. GET /api/sync/pending - Get pending sync operations for a user
app.get('/api/sync/pending', async (req, res) => {
  try {
    const userId = req.query.userId as string;
    const canteenId = req.query.canteenId as string;
    if (!userId) return res.status(400).json({ success: false, error: 'userId required' });

    let pendingOps: any[] = [];
    if (pgReady) {
      try {
        const conditions: any = { userId, status: 'pending' };
        if (canteenId) conditions.canteenId = canteenId;
        pendingOps = await pgGetWhere('sync_queue', conditions);
      } catch (err) { console.error(err); }
    }

    res.json({ success: true, pending: pendingOps });
  } catch (err: any) {
    console.error('Sync pending error:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to load pending syncs' });
  }
});

// 6c. POST /api/sync/resolve-conflict - Resolve a conflict
app.post('/api/sync/resolve-conflict', async (req, res) => {
  try {
    const { conflictId, resolution, resolvedBy, chosenVersion } = req.body;
    if (!conflictId || !resolution) {
      return res.status(400).json({ success: false, error: 'Conflict ID and resolution required' });
    }

    const now = Date.now();

    if (pgReady) {
      try {
        const conflict = await pgGetById('conflict_records', conflictId);
        if (!conflict) return res.status(404).json({ success: false, error: 'Conflict not found' });

        // Update conflict record
        await pgUpdate('conflict_records', conflictId, {
          resolution,
          resolvedBy: resolvedBy || '',
          resolvedAt: now,
        });

        // Apply the chosen version
        if (chosenVersion && conflict.entityType === 'order') {
          await pgSet('orders', conflict.entityId, { ...chosenVersion, id: conflict.entityId });
        }
      } catch (err) { console.error(err); }
    }

    res.json({ success: true, message: 'Conflict resolved' });
  } catch (err: any) {
    console.error('Resolve conflict error:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to resolve conflict' });
  }
});

// 6d. GET /api/sync/conflicts - Get unresolved conflicts
app.get('/api/sync/conflicts', async (req, res) => {
  try {
    const canteenId = req.query.canteenId as string;
    let conflicts: any[] = [];
    if (pgReady) {
      try {
        const allConflicts = await pgGetWhere('conflict_records', { resolution: 'pending' });
        conflicts = canteenId
          ? allConflicts.filter((c: any) => {
              // Filter by canteen via the entity
              return true; // simplified - return all pending
            })
          : allConflicts;
      } catch (err) { console.error(err); }
    }
    res.json({ success: true, conflicts });
  } catch (err: any) {
    console.error('Get conflicts error:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to load conflicts' });
  }
});

// 6e. GET /api/sync/events - Get sync event history
app.get('/api/sync/events', async (req, res) => {
  try {
    const userId = req.query.userId as string;
    const limit = parseInt(req.query.limit as string) || 50;
    let events: any[] = [];
    if (pgReady && userId) {
      try {
        events = await pgGetWhereOrdered('synchronization_events', { userId }, 'created_at', 'desc', limit);
      } catch (err) { console.error(err); }
    }
    res.json({ success: true, events });
  } catch (err: any) {
    console.error('Sync events error:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to load sync events' });
  }
});

// -------------------------------------------------------------
// VITE DEV SERVER OR STATIC PROD PRODUCTION MIDDLEWARE Setup
// -------------------------------------------------------------
async function seedCollegesToPostgres() {
  if (!pgReady) return;
  try {
    const list = await pgGetAll('colleges');
    if (list.length === 0) {
      console.log('Seeding default colleges to PostgreSQL...');
      for (const c of collegesState) {
        await pgSet('colleges', c.id, c);
      }
      console.log('Seeded', collegesState.length, 'colleges.');
    }
  } catch (e) {
    console.error('Failed to seed colleges:', e);
  }
}

async function startServer() {
  await seedCollegesToPostgres();
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Mounted Vite development server middleware.');
  } else {
    // Serve production static assets compiled inside dist
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('Serving production-ready compiled assets from dist/.');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`QR Dine Full-Stack Server booted and running on http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

// Global error handling middleware for better production diagnostics
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('GLOBAL SERVER ERROR:', err);
  res.status(500).json({ success: false, error: err?.message || String(err) });
});

export default app;

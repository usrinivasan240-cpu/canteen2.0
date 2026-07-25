/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';
import admin from 'firebase-admin';
import Razorpay from 'razorpay';
import { GoogleGenAI, Type } from '@google/genai';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { MenuItem, Order, Review, Canteen, OrderItem, Ingredient, CanteenSettings, College, SubCanteen, User } from './src/types';

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Enable CORS for mobile Capacitor WebView clients (http://localhost and capacitor://)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
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

const razorpayKeyId = (process.env.RAZORPAY_KEY_ID || '').trim();
const razorpayKeySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
let razorpay: any = null;

if (razorpayKeyId && razorpayKeySecret) {
  try {
    razorpay = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret
    });
    console.log('Razorpay SDK initialized successfully.');
  } catch (err) {
    console.error('Failed to initialize Razorpay SDK:', err);
  }
} else {
  console.log('Razorpay keys not configured. Operating with sandbox payment fallback.');
}

// ============================================================================
// FIRESTORE READ CACHE (reduces reads by 80-90%)
// ============================================================================
const firestoreCache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL = 60000; // 60 seconds for static data
const CANTEEN_CACHE_TTL = 30000; // 30 seconds for canteen data

function getCached(key: string): any | null {
  const entry = firestoreCache.get(key);
  if (entry && Date.now() < entry.expiresAt) return entry.data;
  firestoreCache.delete(key);
  return null;
}

function setCache(key: string, data: any, ttl: number = CACHE_TTL) {
  firestoreCache.set(key, { data, expiresAt: Date.now() + ttl });
}

function invalidateCanteenCache(canteenId: string) {
  firestoreCache.delete(`canteen_${canteenId}`);
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

app.get('/api/test', (req, res) => {
  const rpKeyId = process.env.RAZORPAY_KEY_ID || '';
  const rpKeyLen = rpKeyId.length;
  const rpKeyPrefix = rpKeyId.substring(0, 12);
  const rpSecretLen = (process.env.RAZORPAY_KEY_SECRET || '').length;
  res.json({ success: true, message: "Server is working!", dbConnected: !!db, envVar: !!process.env.FIREBASE_SERVICE_ACCOUNT, initError: firebaseInitError, envLength: (process.env.FIREBASE_SERVICE_ACCOUNT || '').length, razorpay: { initialized: !!razorpay, keyPrefix: rpKeyPrefix, keyLen: rpKeyLen, secretLen: rpSecretLen } });
});

// App version endpoint - bump this to force update popup on all devices
const APP_VERSION = '1.1.0';
const APP_UPDATE_URL = 'https://canteen20.vercel.app';

app.get('/api/app-version', (req, res) => {
  res.json({ version: APP_VERSION, updateUrl: APP_UPDATE_URL });
});

// Initialize Firebase Admin using token.json or env variable fallback
let db: admin.firestore.Firestore | null = null;
let firebaseInitError: string | null = null;
try {
  let envCreds = process.env.FIREBASE_SERVICE_ACCOUNT;
  const tokenPath = path.join(process.cwd(), 'token.json');

  if (envCreds) {
    console.log('FIREBASE_SERVICE_ACCOUNT found, length:', envCreds.length);
    // Attempt 1: direct parse
    let serviceAccount: any = null;
    try {
      serviceAccount = JSON.parse(envCreds);
    } catch (e: any) {
      console.log('Direct JSON.parse failed, attempting newline fix...');
      // Attempt 2: fix literal newlines in private_key
      try {
        let fixed = envCreds.replace(/\r/g, '');
        // Find private_key value and escape any bare newlines inside it
        const pkStart = fixed.indexOf('"private_key"');
        if (pkStart !== -1) {
          // Find the opening quote of the value
          const afterPk = fixed.indexOf(':"', pkStart) + 2;
          // Find the closing quote (accounting for escaped quotes)
          let i = afterPk;
          let inEscape = false;
          while (i < fixed.length) {
            if (inEscape) { inEscape = false; i++; continue; }
            if (fixed[i] === '\\') { inEscape = true; i++; continue; }
            if (fixed[i] === '"') break;
            if (fixed[i] === '\n') { fixed = fixed.substring(0, i) + '\\n' + fixed.substring(i + 1); i += 2; continue; }
            i++;
          }
        }
        serviceAccount = JSON.parse(fixed);
      } catch (e2: any) {
        firebaseInitError = `JSON parse failed: ${e2.message}. Env var length: ${envCreds.length}. First 100 chars: ${envCreds.substring(0, 100)}`;
        console.error(firebaseInitError);
      }
    }

    if (serviceAccount) {
      console.log('Parsed service account for project:', serviceAccount.project_id);
      if (admin.apps.length === 0) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
      }
      db = admin.firestore();
      db.settings({ ignoreUndefinedProperties: true });
      console.log('Firebase Admin SDK initialized successfully via FIREBASE_SERVICE_ACCOUNT!');
    }
  } else if (fs.existsSync(tokenPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }
    db = admin.firestore();
    db.settings({ ignoreUndefinedProperties: true });
    console.log('Firebase Admin SDK initialized successfully with token.json!');
  } else {
    firebaseInitError = 'No FIREBASE_SERVICE_ACCOUNT env var and no token.json file';
    console.warn('token.json not found and FIREBASE_SERVICE_ACCOUNT not set. Operating with fallback in-memory state.');
  }
} catch (error: any) {
  firebaseInitError = `Init error: ${error?.message || error}`;
  console.error('Failed to initialize Firebase Admin:', error?.message || error);
}

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

async function seedFirestoreIfNeeded() {
  if (!db) return;
  try {
    const itemsSnapshot = await db.collection('items').get();
    if (itemsSnapshot.empty) {
      console.log('Seeding initial menu items to Firestore...');
      const batch = db.batch();
      INITIAL_MENU_ITEMS.forEach(item => {
        const ref = db!.collection('items').doc(item.id);
        batch.set(ref, item);
      });
      await batch.commit();
    }

    const reviewsSnapshot = await db.collection('reviews').get();
    if (reviewsSnapshot.empty) {
      console.log('Seeding initial reviews to Firestore...');
      const batch = db.batch();
      INITIAL_REVIEWS.forEach(review => {
        const ref = db!.collection('reviews').doc(review.id);
        batch.set(ref, review);
      });
      await batch.commit();
    }

    const ordersSnapshot = await db.collection('orders').get();
    if (ordersSnapshot.empty) {
      console.log('Seeding initial orders to Firestore...');
      const batch = db.batch();
      INITIAL_ORDERS.forEach(order => {
        const ref = db!.collection('orders').doc(order.id);
        batch.set(ref, order);
      });
      await batch.commit();
    }
    console.log('Firestore check/seeding complete.');
  } catch (err) {
    console.error('Error seeding Firestore:', err);
  }
}
// Run seed check immediately
seedFirestoreIfNeeded();

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
    name: 'Violet Bites',
    collegeId: 'college_001',
    ownerId: 'user_owner_default',
    ownerName: 'Chef Watson',
    status: 'active',
    location: 'Campus Plaza',
    razorpayAccountId: 'acc_GX82jso291jS',
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
  const { name, email, password, role, phone, registerNumber, collegeId } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, error: 'Name, email, and password are required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const selectedRole = role || 'customer';
  const userId = `user_${Math.random().toString(36).substring(2, 11)}`;

  if (db) {
    try {
      const userDoc = await db.collection('users').doc(normalizedEmail).get();
      if (userDoc.exists) {
        return res.status(400).json({ success: false, error: 'User with this email already exists.' });
      }
      const newUser: any = {
        id: userId,
        name,
        email: normalizedEmail,
        password,
        role: selectedRole,
        phone: phone || '',
        registerNumber: registerNumber || '',
        collegeId: collegeId || '',
        canteenId: '',
        subCanteenId: '',
        status: 'active',
        createdAt: Date.now()
      };

      // Auto-assign first canteen in the user's college
      if (collegeId && db) {
        try {
          const canteensSnap = await db.collection('canteens').where('collegeId', '==', collegeId).where('status', '==', 'active').limit(1).get();
          if (!canteensSnap.empty) {
            const assignedCanteen = canteensSnap.docs[0];
            newUser.canteenId = assignedCanteen.id;
            // Auto-assign first sub-canteen of that canteen
            const subsSnap = await db.collection('subcanteens').where('canteenId', '==', assignedCanteen.id).where('status', '==', 'active').limit(1).get();
            if (!subsSnap.empty) {
              newUser.subCanteenId = subsSnap.docs[0].id;
            }
          }
        } catch (e) {
          console.error('Failed to auto-assign canteen:', e);
        }
      }

      await db.collection('users').doc(normalizedEmail).set(newUser);
      const token = Buffer.from(`${normalizedEmail}:${Date.now()}`).toString('base64');
      return res.json({ success: true, token, user: { id: userId, name, email: normalizedEmail, role: selectedRole, phone: newUser.phone, registerNumber: newUser.registerNumber, collegeId: newUser.collegeId, canteenId: newUser.canteenId, subCanteenId: newUser.subCanteenId } });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, error: 'Server authentication database error.' });
    }
  }

  const regToken = Buffer.from(`${normalizedEmail}:${Date.now()}`).toString('base64');
  return res.json({ success: true, token: regToken, user: { id: userId, name, email: normalizedEmail, role: selectedRole } });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  console.log('--- LOGIN ATTEMPT ---', { email });
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (db) {
    try {
      const userDoc = await db.collection('users').doc(normalizedEmail).get();
      if (userDoc.exists) {
        const user = userDoc.data();
        if (user && user.password === password) {
          const finalRole = user.role;
          console.log('--- LOGIN SUCCESS (DB) ---', { email: user.email, resolvedRole: finalRole });
          const token = Buffer.from(`${normalizedEmail}:${Date.now()}`).toString('base64');
          return res.json({ success: true, token, user: { id: user.id, name: user.name, email: user.email, role: finalRole, collegeId: user.collegeId, canteenId: user.canteenId, subCanteenId: user.subCanteenId, phone: user.phone, registerNumber: user.registerNumber } });
        } else {
          return res.status(400).json({ success: false, error: 'Incorrect password.' });
        }
      }
      
      if (['watson777@gmail.com', 'canteen_owner@gmail.com', 'superadmin@gmail.com', 'college_admin@gmail.com', 'chef@gmail.com', 'staff@gmail.com'].includes(normalizedEmail)) {
        let defaultRole = 'customer';
        let defaultName = 'Raju Watson';
        let collegeId: string | undefined;
        let canteenId: string | undefined;
        let subCanteenId: string | undefined;

        if (normalizedEmail === 'canteen_owner@gmail.com') {
          defaultRole = 'owner';
          defaultName = 'Canteen Owner';
          canteenId = 'canteen_001';
        } else if (normalizedEmail === 'superadmin@gmail.com') {
          defaultRole = 'superadmin';
          defaultName = 'Super Admin';
        } else if (normalizedEmail === 'college_admin@gmail.com') {
          defaultRole = 'admin';
          defaultName = 'College Admin';
          collegeId = 'college_001';
        } else if (normalizedEmail === 'chef@gmail.com') {
          defaultRole = 'chef';
          defaultName = 'Kitchen Chef';
          canteenId = 'canteen_001';
          subCanteenId = 'sub_001';
        } else if (normalizedEmail === 'staff@gmail.com') {
          defaultRole = 'staff';
          defaultName = 'Counter Staff';
          canteenId = 'canteen_001';
          subCanteenId = 'sub_001';
        }

        const defaultUser: any = { 
          id: `user_${defaultRole}_default`, 
          name: defaultName, 
          email: normalizedEmail, 
          password, 
          role: defaultRole,
          status: 'active'
        };
        if (collegeId) defaultUser.collegeId = collegeId;
        if (canteenId) defaultUser.canteenId = canteenId;
        if (subCanteenId) defaultUser.subCanteenId = subCanteenId;

        await db.collection('users').doc(normalizedEmail).set(defaultUser);
        const token = Buffer.from(`${normalizedEmail}:${Date.now()}`).toString('base64');
        return res.json({ success: true, token, user: { id: defaultUser.id, name: defaultUser.name, email: defaultUser.email, role: defaultUser.role, collegeId, canteenId, subCanteenId } });
      }
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, error: 'Database access failure.' });
    }
  }

  const token = Buffer.from(`${normalizedEmail}:${Date.now()}`).toString('base64');
  return res.json({
    success: true,
    token,
    user: {
      id: `user_${Math.random().toString(36).substring(2, 11)}`,
      name: normalizedEmail.split('@')[0],
      email: normalizedEmail,
      role: 'customer',
      collegeId: undefined,
      canteenId: undefined,
      subCanteenId: undefined
    }
  });
});

// ============================================================================
// OTP VERIFICATION FOR SUPERADMIN LOGIN
// ============================================================================

const SUPERADMIN_EMAIL = 'usrinivasan240@gmail.com';
const otpStore = new Map<string, { code: string; expiresAt: number; email: string }>();

app.post('/api/auth/generate-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, error: 'Email required' });
  const normalizedEmail = email.trim().toLowerCase();

  // Verify user is superadmin
  if (normalizedEmail !== 'superadmin@gmail.com') {
    return res.status(403).json({ success: false, error: 'OTP verification only required for superadmin accounts.' });
  }

  // Generate 6-digit OTP
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore.set(normalizedEmail, { code, expiresAt: Date.now() + 5 * 60 * 1000, email: normalizedEmail });

  console.log(`\n========================================`);
  console.log(`OTP for superadmin login: ${code}`);
  console.log(`Email: ${SUPERADMIN_EMAIL}`);
  console.log(`Expires in 5 minutes`);
  console.log(`========================================\n`);

  // Send OTP via email in background (non-blocking)
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Violet Bites <onboarding@resend.dev>',
        to: [SUPERADMIN_EMAIL],
        subject: 'Violet Bites - Superadmin Login OTP',
        html: `<div style="font-family:sans-serif;text-align:center;padding:20px;max-width:400px;margin:0 auto"><div style="background:#7c3aed;color:white;padding:15px;border-radius:16px 16px 0 0"><h2 style="margin:0">Violet Bites</h2></div><div style="background:#f8f7ff;padding:30px;border-radius:0 0 16px 16px;border:1px solid #e5e1f0"><p style="color:#555;font-size:14px">Your superadmin login OTP is:</p><div style="font-size:36px;letter-spacing:10px;color:#7c3aed;background:#f3f0ff;padding:20px;border-radius:12px;font-weight:bold;margin:15px 0">${code}</div><p style="color:#999;font-size:12px">Valid for 5 minutes. Do not share this code.</p></div></div>`
      })
    }).then(r => r.text()).then(t => console.log('Resend:', t)).catch(e => console.error('Resend error:', e));
  } else {
    console.log('RESEND_API_KEY not set. OTP:', code);
  }

  res.json({ success: true, message: `OTP sent to ${SUPERADMIN_EMAIL}` });
});

app.post('/api/auth/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ success: false, error: 'Email and OTP required' });
  const normalizedEmail = email.trim().toLowerCase();

  const stored = otpStore.get(normalizedEmail);
  if (!stored) {
    return res.status(400).json({ success: false, error: 'No OTP generated. Please request a new one.' });
  }
  if (Date.now() > stored.expiresAt) {
    otpStore.delete(normalizedEmail);
    return res.status(400).json({ success: false, error: 'OTP expired. Please request a new one.' });
  }
  if (stored.code !== otp.trim()) {
    return res.status(400).json({ success: false, error: 'Invalid OTP. Please try again.' });
  }

  otpStore.delete(normalizedEmail);
  res.json({ success: true, message: 'OTP verified successfully.' });
});

// ============================================================================
// SUPER ADMIN ENDPOINTS
// ============================================================================

// --- Colleges CRUD ---
app.get('/api/colleges', async (req, res) => {
  const cached = getCached('colleges');
  if (cached) return res.json({ success: true, colleges: cached });
  if (db) {
    try {
      const snap = await db.collection('colleges').get();
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as College);
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

  if (db) {
    try {
      await db.collection('colleges').doc(college.id).set(college);
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
  if (db) {
    try {
      await db.collection('colleges').doc(id).set({ logoUrl }, { merge: true });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ success: false, error: 'DB update failed' });
    }
  }
  const idx = collegesState.findIndex(c => c.id === id);
  if (idx !== -1) collegesState[idx] = { ...collegesState[idx], logoUrl };
  res.json({ success: true });
});

app.delete('/api/colleges/:id', async (req, res) => {
  const { id } = req.params;
  if (db) {
    try {
      await db.collection('colleges').doc(id).delete();
    } catch (e) {
      console.error(e);
    }
  }
  firestoreCache.delete('colleges');
  collegesState = collegesState.filter(c => c.id !== id);
  saveLocalDB();
  res.json({ success: true });
});

// --- Canteens CRUD ---
app.get('/api/canteens', async (req, res) => {
  const cached = getCached('canteens');
  if (cached) return res.json({ success: true, canteens: cached });
  if (db) {
    try {
      const snap = await db.collection('canteens').get();
      const list = snap.docs.map(doc => doc.data() as Canteen);
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
  if (!canteenData.razorpayAccountId) {
    canteenData.razorpayAccountId = 'acc_' + Math.random().toString(36).substring(2, 11);
  }

  if (db) {
    try {
      await db.collection('canteens').doc(canteenData.id).set(canteenData);
      
      // Auto-seed default settings
      const settingsDocId = `settings_${canteenData.id}`;
      const setDoc = await db.collection('settings').doc(settingsDocId).get();
      if (!setDoc.exists) {
        await db.collection('settings').doc(settingsDocId).set({
          noShowMinutes: 30,
          defaultSlotCapacity: 30,
          canteenId: canteenData.id
        });
      }

      // Auto-seed default ingredients
      const ingSnap = await db.collection('ingredients').where('canteenId', '==', canteenData.id).get();
      if (ingSnap.empty) {
        const batch = db.batch();
        INITIAL_INGREDIENTS.forEach(ing => {
          const ref = db!.collection('ingredients').doc(`${ing.id}_${canteenData.id}`);
          batch.set(ref, { ...ing, id: `${ing.id}_${canteenData.id}`, canteenId: canteenData.id });
        });
        await batch.commit();
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
  saveLocalDB();
  res.json({ success: true, canteen: getCanteenState(canteenData.id) });
});

app.post('/api/canteen/update-name', async (req, res) => {
  const { canteenId, name } = req.body;
  if (!canteenId || !name) {
    return res.status(400).json({ success: false, error: 'canteenId and name are required.' });
  }
  if (db) {
    try {
      await db.collection('canteens').doc(canteenId).update({ name });
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
  if (db) {
    try {
      await db.collection('canteens').doc(id).update(cleanUpdates);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ success: false, error: 'Failed to update canteen.' });
    }
  }
  const idx = canteensState.findIndex(c => c.id === id);
  if (idx !== -1) canteensState[idx] = { ...canteensState[idx], ...cleanUpdates };
  saveLocalDB();
  res.json({ success: true, canteen: canteensState[idx] || cleanUpdates });
});

app.delete('/api/canteens/:id', async (req, res) => {
  const { id } = req.params;
  if (db) {
    try {
      await db.collection('canteens').doc(id).delete();
    } catch (e) {
      console.error(e);
    }
  }
  firestoreCache.delete('canteens');
  firestoreCache.delete(`canteen_${id}`);
  canteensState = canteensState.filter(c => c.id !== id);
  saveLocalDB();
  res.json({ success: true });
});

// --- Sub-Canteens CRUD ---
app.get('/api/subcanteens', async (req, res) => {
  const cached = getCached('subcanteens');
  if (cached) return res.json({ success: true, subCanteens: cached });
  if (db) {
    try {
      const snap = await db.collection('subcanteens').get();
      const list = snap.docs.map(doc => doc.data() as SubCanteen);
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

  if (db) {
    try {
      await db.collection('subcanteens').doc(sub.id).set(sub);
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
  saveLocalDB();
  res.json({ success: true, subCanteen: sub });
});

app.delete('/api/subcanteens/:id', async (req, res) => {
  const { id } = req.params;
  if (db) {
    try {
      await db.collection('subcanteens').doc(id).delete();
    } catch (e) {
      console.error(e);
    }
  }
  subCanteensState = subCanteensState.filter(s => s.id !== id);
  firestoreCache.delete('subcanteens');
  saveLocalDB();
  res.json({ success: true });
});

app.get('/api/users', async (req, res) => {
  const cached = getCached('users');
  if (cached) return res.json({ success: true, users: cached });
  if (db) {
    try {
      const snap = await db.collection('users').get();
      const list = snap.docs.map(doc => {
        const u = doc.data();
        return { id: u.id, name: u.name, email: u.email, role: u.role, collegeId: u.collegeId, canteenId: u.canteenId, subCanteenId: u.subCanteenId, status: u.status, posting: u.posting };
      });
      return res.json({ success: true, users: list });
    } catch (e) {
      console.error(e);
    }
  }
  // Fallback default users
  res.json({
    success: true,
    users: usersState
  });
});

app.post('/api/users', async (req, res) => {
  const user = req.body as User;
  if (!user.name || !user.email || !user.role) {
    return res.status(400).json({ success: false, error: 'Name, email, and role are required' });
  }
  const emailKey = user.email.trim().toLowerCase();
  if (!user.id) user.id = `user_${Date.now()}`;
  if (!user.status) user.status = 'active';
  if (!user.password) user.password = 'changeme_' + Math.random().toString(36).substring(2, 10);

  // Create Firebase Auth account so the user can actually log in
  let firebaseUid: string | undefined;
  if (db) {
    try {
      const authUser = await admin.auth().createUser({
        email: emailKey,
        password: user.password,
        displayName: user.name,
        disabled: false,
      });
      firebaseUid = authUser.uid;
      // Set custom claims for role-based access
      const claims: Record<string, string> = { role: user.role };
      if (user.collegeId) claims.collegeId = user.collegeId;
      if (user.canteenId) claims.canteenId = user.canteenId;
      if (user.subCanteenId) claims.subCanteenId = user.subCanteenId;
      await admin.auth().setCustomUserClaims(authUser.uid, claims);
      console.log(`Created Firebase Auth user: ${emailKey} (${firebaseUid}) role=${user.role}`);
    } catch (authErr: any) {
      // If user already exists in Auth, just link to existing
      if (authErr.code === 'auth/email-already-exists') {
        try {
          const existingUser = await admin.auth().getUserByEmail(emailKey);
          firebaseUid = existingUser.uid;
          const claims: Record<string, string> = { role: user.role };
          if (user.collegeId) claims.collegeId = user.collegeId;
          if (user.canteenId) claims.canteenId = user.canteenId;
          if (user.subCanteenId) claims.subCanteenId = user.subCanteenId;
          await admin.auth().setCustomUserClaims(existingUser.uid, claims);
          await admin.auth().updateUser(existingUser.uid, { password: user.password, displayName: user.name });
          console.log(`Linked existing Auth user: ${emailKey} (${firebaseUid}) role=${user.role}`);
        } catch (linkErr) {
          console.error('Failed to link existing Auth user:', linkErr);
        }
      } else {
        console.error('Firebase Auth create failed:', authErr);
      }
    }
  }

  if (firebaseUid) user.id = firebaseUid;

  if (db) {
    try {
      const { password: _pw, ...userWithoutPassword } = user;
      await db.collection('users').doc(emailKey).set(userWithoutPassword);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ success: false, error: 'DB Save failed' });
    }
  }

  // Update local in-memory fallback state
  const idx = usersState.findIndex(u => u.email.toLowerCase() === emailKey);
  if (idx !== -1) {
    usersState[idx] = { ...usersState[idx], ...user };
  } else {
    usersState.push(user);
  }

  saveLocalDB();
  const { password: _pw, ...safeUser } = user;
  res.json({ success: true, user: safeUser });
});

app.delete('/api/users/:email', async (req, res) => {
  const { email } = req.params;
  const emailKey = email.trim().toLowerCase();

  // Delete from Firebase Auth
  if (db) {
    try {
      const authUser = await admin.auth().getUserByEmail(emailKey);
      await admin.auth().deleteUser(authUser.uid);
      console.log(`Deleted Firebase Auth user: ${emailKey} (${authUser.uid})`);
    } catch (authErr: any) {
      if (authErr.code !== 'auth/user-not-found') {
        console.error('Failed to delete Auth user:', authErr);
      }
    }
  }

  // Delete from Firestore
  if (db) {
    try {
      await db.collection('users').doc(emailKey).delete();
    } catch (e) {
      console.error(e);
    }
  }

  usersState = usersState.filter(u => u.email.toLowerCase() !== emailKey);
  saveLocalDB();
  res.json({ success: true });
});

app.put('/api/users/:email/role', async (req, res) => {
  const { email } = req.params;
  const { role, posting, name, collegeId, canteenId, subCanteenId, status, password } = req.body;
  const emailKey = email.trim().toLowerCase();

  if (!role) {
    return res.status(400).json({ success: false, error: 'Role is required' });
  }

  const updates: Record<string, string> = { role };
  if (posting !== undefined) updates.posting = posting;
  if (name) updates.name = name;
  if (collegeId !== undefined) updates.collegeId = collegeId;
  if (canteenId !== undefined) updates.canteenId = canteenId;
  if (subCanteenId !== undefined) updates.subCanteenId = subCanteenId;
  if (status) updates.status = status;
  if (password) updates.password = password;

  if (db) {
    try {
      await db.collection('users').doc(emailKey).set(updates, { merge: true });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ success: false, error: 'Failed to update user in DB' });
    }
  }

  // Update Firebase Auth custom claims so the user's token reflects the new role
  if (db) {
    try {
      const authUser = await admin.auth().getUserByEmail(emailKey);
      const claims: Record<string, string> = { role };
      if (collegeId !== undefined && collegeId) claims.collegeId = collegeId;
      if (canteenId !== undefined && canteenId) claims.canteenId = canteenId;
      if (subCanteenId !== undefined && subCanteenId) claims.subCanteenId = subCanteenId;
      await admin.auth().setCustomUserClaims(authUser.uid, claims);
      if (name) {
        await admin.auth().updateUser(authUser.uid, { displayName: name });
      }
      console.log(`Updated Auth claims for ${emailKey}: role=${role}`);
    } catch (authErr: any) {
      // User may not exist in Auth yet — log but don't fail
      if (authErr.code === 'auth/user-not-found') {
        console.warn(`Auth user not found for ${emailKey}, skipping claims update`);
      } else {
        console.error('Failed to update Auth claims:', authErr);
      }
    }
  }

  const idx = usersState.findIndex(u => u.email.toLowerCase() === emailKey);
  if (idx !== -1) {
    usersState[idx] = { ...usersState[idx], ...updates };
  }

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
  if (db) {
    try {
      const [itemsSnap, ordersSnap, reviewsSnap, ingSnap, settingsSnap, cRef] = await Promise.all([
        db.collection('items').where('canteenId', '==', canteenId).get(),
        db.collection('orders').where('canteenId', '==', canteenId).orderBy('createdAt', 'desc').limit(50).get(),
        db.collection('reviews').where('canteenId', '==', canteenId).orderBy('createdAt', 'desc').limit(20).get(),
        db.collection('ingredients').where('canteenId', '==', canteenId).get(),
        db.collection('settings').doc(`settings_${canteenId}`).get(),
        db.collection('canteens').doc(canteenId).get()
      ]);

      let items = itemsSnap.docs.map(doc => doc.data() as MenuItem);
      // NO fallback full-collection scan — use empty array instead
      let orders = ordersSnap.docs.map(doc => doc.data() as Order);
      let reviews = reviewsSnap.docs.map(doc => doc.data() as Review);
      const ingredients = ingSnap.empty ? INITIAL_INGREDIENTS.map(ing => ({ ...ing, canteenId })) : ingSnap.docs.map(doc => doc.data() as Ingredient);
      const settings = settingsSnap.exists ? settingsSnap.data() as CanteenSettings : { ...canteenSettings, canteenId };

      let canteenName = 'Violet Bites';
      let ownerName = 'Chef Watson';
      if (cRef.exists) {
        canteenName = cRef.data()?.name || canteenName;
        ownerName = cRef.data()?.ownerName || ownerName;
      }

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
      console.error('Firestore get error, falling back to local memory state:', err);
    }
  }
  res.json({ success: true, canteen: getCanteenState(canteenId) });
});

// 2. Add / Edit Menu Items (Owner)
app.post('/api/canteen/menu', async (req, res) => {
  const { id, name, price, stock, category, description, tags, available, imageUrl, prepTime, dailyLimit, isPaused, recipe } = req.body;
  
  if (!name || isNaN(price) || isNaN(stock)) {
    return res.status(400).json({ success: false, error: 'Name, valid price and stock are required.' });
  }

  const isNew = !id;
  const targetId = id || `item_${Date.now()}`;

  let existingItem: MenuItem | undefined;
  if (db && !isNew) {
    try {
      const doc = await db.collection('items').doc(id).get();
      if (doc.exists) {
        existingItem = doc.data() as MenuItem;
      }
    } catch (e) {
      console.error(e);
    }
  } else if (!isNew) {
    existingItem = canteenState.items.find(i => i.id === id);
  }

  const menuItem: MenuItem = {
    id: targetId,
    name,
    price: Number(price),
    stock: Number(stock),
    rating: existingItem?.rating || 5.0,
    ratingCount: existingItem?.ratingCount || 1,
    available: stock > 0 ? (available !== undefined ? available : true) : false,
    category,
    description: description || '',
    tags: tags || [],
    imageUrl: imageUrl || existingItem?.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=300&auto=format&fit=crop',
    prepTime: Number(prepTime) || existingItem?.prepTime || 10,
    dailyLimit: Number(dailyLimit) || existingItem?.dailyLimit || 100,
    bookedToday: existingItem?.bookedToday || 0,
    isPaused: isPaused !== undefined ? !!isPaused : (existingItem?.isPaused || false),
    recipe: recipe || existingItem?.recipe || []
  };

  if (db) {
    try {
      await db.collection('items').doc(targetId).set(menuItem);
    } catch (err) {
      console.error('Firestore save item error:', err);
    }
  }

  if (isNew) {
    canteenState.items.push(menuItem);
  } else {
    canteenState.items = canteenState.items.map(item => item.id === id ? menuItem : item);
  }

  invalidateCanteenCache(canteenId);
  res.json({ success: true, menuItem, message: isNew ? 'Menu item added' : 'Menu item updated' });
});

// 3. Delete Menu Item (Owner)
app.delete('/api/canteen/menu/:id', async (req, res) => {
  const { id } = req.params;
  if (db) {
    try {
      await db.collection('items').doc(id).delete();
    } catch (err) {
      console.error('Firestore delete error:', err);
    }
  }
  canteenState.items = canteenState.items.filter(item => item.id !== id);
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

  if (db) {
    try {
      await db.collection('ingredients').doc(targetId).set(ingredient);
    } catch (err) {
      console.error('Firestore save ingredient error:', err);
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
  if (db) {
    try {
      await db.collection('ingredients').doc(id).delete();
    } catch (err) {
      console.error('Firestore delete ingredient error:', err);
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
  const { userId, userName, items, paymentMethod, pickupSlot, canteenId, subCanteenId } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: 'Cannot place empty order.' });
  }

  const selectedSlot = pickupSlot || 'ASAP (Instant)';

  // 1. Check Slot Capacity
  let capacityLimit = canteenSettings.defaultSlotCapacity;
  let currentSlotBookingsCount = 0;
  if (db) {
    try {
      const settingsDoc = await db.collection('settings').doc(`settings_${canteenId || 'canteen_001'}`).get();
      if (settingsDoc.exists) {
        capacityLimit = (settingsDoc.data() as CanteenSettings).defaultSlotCapacity;
      }
      const ordersInSlot = await db.collection('orders').where('pickupSlot', '==', selectedSlot).where('canteenId', '==', canteenId || 'canteen_001').get();
      currentSlotBookingsCount = ordersInSlot.docs.filter(doc => {
        const o = doc.data() as Order;
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
  if (db) {
    try {
      const snap = await db.collection('items').get();
      currentItems = snap.docs.map(doc => doc.data() as MenuItem);
    } catch (err) {
      console.error(err);
      currentItems = canteenState.items;
    }
  } else {
    currentItems = canteenState.items;
  }

  // Retrieve current raw ingredients
  let currentIngredients: Ingredient[] = [];
  if (db) {
    try {
      const snap = await db.collection('ingredients').get();
      currentIngredients = snap.docs.map(doc => doc.data() as Ingredient);
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
    noShowMinutes = db
      ? ((await db.collection('settings').doc(`settings_${canteenId || 'canteen_001'}`).get()).data()?.noShowMinutes || 30)
      : canteenState.settings?.noShowMinutes || 30;
  } catch (settingsErr) {
    console.warn('Settings query failed, using default noShowMinutes:', settingsErr);
  }
  const expiryTime = pickupTimestamp + (noShowMinutes * 60 * 1000);

  if (razorpay) {
    try {
      const totalPrice = Number((subtotal / 0.9764).toFixed(2));
      const totalAmountPaise = Math.round(totalPrice * 100);
      let rzpOrder: any = null;
      const canteenAccountId = canteenState.razorpayAccountId;
      if (canteenAccountId && canteenAccountId.startsWith('acc_')) {
        try {
          rzpOrder = await razorpay.orders.create({
            amount: totalAmountPaise,
            currency: 'INR',
            transfers: [
              {
                account: canteenAccountId,
                amount: Math.round(foodAmount * 100),
                currency: 'INR',
                on_hold: false
              }
            ]
          });
        } catch (transferErr: any) {
          console.warn('Razorpay split transfer failed, falling back to standard order:', transferErr?.message || transferErr);
        }
      }
      if (!rzpOrder) {
        rzpOrder = await razorpay.orders.create({
          amount: totalAmountPaise,
          currency: 'INR'
        });
      }

      const newOrder: Order = {
        id: orderId,
        userId: userId || 'user_guest',
        userName: userName || 'Guest User',
        items: validatedItems,
        totalPrice,
        paymentStatus: 'pending',
        paymentMethod: 'Razorpay Online Gateway',
        qrCode: `QR_${orderId}_${Math.floor(Math.random() * 1000)}`,
        status: 'pending',
        timestamp: new Date().toISOString(),
        createdAt: Date.now(),
        pickupTimeText: 'Pending payment confirmation',
        razorpayOrderId: rzpOrder.id,
        pickupSlot: selectedSlot,
        prepStartTime,
        expiryTime,
        canteenId: canteenId || 'canteen_001',
        subCanteenId: subCanteenId || 'sub_001'
      };

      if (db) {
        await db.collection('orders').doc(orderId).set(newOrder);
      }
      canteenState.orders.unshift(newOrder);

      return res.json({
        success: true,
        useRazorpay: true,
        razorpayOrderId: rzpOrder.id,
        amount: totalAmountPaise,
        key: razorpayKeyId,
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

  // Fallback to Instant Mock Checkout when Razorpay credentials are not defined
  // Deduct ingredient stock, decrement item stock, increment bookedToday
  for (const clientItem of items) {
    const itemInMenu = currentItems.find(item => item.id === clientItem.itemId);
    if (itemInMenu) {
      itemInMenu.stock -= clientItem.quantity;
      itemInMenu.bookedToday += clientItem.quantity;
      if (itemInMenu.stock <= 0) {
        itemInMenu.available = false;
      }
      if (db) {
        await db.collection('items').doc(itemInMenu.id).set(itemInMenu);
      }
    }
  }
  canteenState.items = currentItems;

  for (const [ingId, reqAmount] of Object.entries(requiredIngredients)) {
    const ingredient = currentIngredients.find(i => i.id === ingId);
    if (ingredient) {
      ingredient.stockGrams = Math.max(0, ingredient.stockGrams - reqAmount);
      if (db) {
        await db.collection('ingredients').doc(ingredient.id).set(ingredient);
      }
    }
  }
  canteenState.ingredients = currentIngredients;

  const totalPrice = Number((subtotal / 0.9764).toFixed(2));
  const containsChefItems = validatedItems.some(it => {
    const itemMenu = currentItems.find(m => m.id === it.itemId);
    return itemMenu ? itemMenu.requiresChef !== false : true;
  });

  const newOrder: Order = {
    id: orderId,
    userId: userId || 'user_guest',
    userName: userName || 'Raju Watson',
    items: validatedItems,
    totalPrice: totalPrice,
    paymentStatus: 'paid', 
    paymentMethod: paymentMethod || 'Mock UPI Checkout',
    qrCode: `QR_${orderId}_${Math.floor(Math.random() * 1000)}`,
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

  if (db) {
    try {
      await db.collection('orders').doc(orderId).set(newOrder);
    } catch (err) {
      console.error('Firestore save order error:', err);
    }
  }

  canteenState.orders.unshift(newOrder);
  res.json({ success: true, useRazorpay: false, order: newOrder, qrPayload: generateSignedQR(orderId), message: 'Order placed & payment verified!' });
  } catch (topErr: any) {
    console.error('Order endpoint unhandled error:', typeof topErr === 'string' ? topErr : topErr?.message || JSON.stringify(topErr));
    if (!res.headersSent) {
      return res.status(500).json({ success: false, error: `Order processing error: ${typeof topErr === 'string' ? topErr : topErr?.message || 'Unexpected server error'}` });
    }
  }
});

// 4b. Verify Razorpay Payment Signature (Customer Checkout completion)
app.post('/api/canteen/payment/verify', async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ success: false, error: 'Missing payment signature verification parameters.' });
  }

  if (!razorpayKeySecret) {
    return res.status(500).json({ success: false, error: 'Razorpay client is not configured on the server.' });
  }

  try {
    const crypto = await import('crypto');
    const generatedSignature = crypto
      .createHmac('sha256', razorpayKeySecret)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, error: 'Payment verification failed. Signature mismatch.' });
    }

    // Retrieve order
    let targetOrder: Order | undefined;
    if (db) {
      const snap = await db.collection('orders').where('razorpayOrderId', '==', razorpay_order_id).get();
      if (!snap.empty) {
        targetOrder = snap.docs[0].data() as Order;
      }
    } else {
      targetOrder = canteenState.orders.find(o => o.razorpayOrderId === razorpay_order_id);
    }

    if (!targetOrder) {
      return res.status(404).json({ success: false, error: 'Order profile matching payment ID not found.' });
    }

    // Deduct stock, decrement item stock, increment bookedToday, deduct ingredients
    let currentItems: MenuItem[] = [];
    if (db) {
      const snap = await db.collection('items').get();
      currentItems = snap.docs.map(doc => doc.data() as MenuItem);
    } else {
      currentItems = canteenState.items;
    }

    let currentIngredients: Ingredient[] = [];
    if (db) {
      const snap = await db.collection('ingredients').get();
      currentIngredients = snap.docs.map(doc => doc.data() as Ingredient);
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
        if (db) {
          await db.collection('items').doc(itemInMenu.id).set(itemInMenu);
        }

        // Deduct ingredients
        if (itemInMenu.recipe) {
          for (const recipeItem of itemInMenu.recipe) {
            const reqAmount = recipeItem.amountGrams * item.quantity;
            const ingredient = currentIngredients.find(ing => ing.id === recipeItem.ingredientId);
            if (ingredient) {
              ingredient.stockGrams = Math.max(0, ingredient.stockGrams - reqAmount);
              if (db) {
                await db.collection('ingredients').doc(ingredient.id).set(ingredient);
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

    // Finalize order status to 'scheduled' or 'preparing' depending on time
    const updatedOrder: Order = {
      ...targetOrder,
      paymentStatus: 'paid',
      status: containsChefItems ? 'scheduled' : 'ready',
      razorpayPaymentId: razorpay_payment_id,
      pickupTimeText: containsChefItems ? `Scheduled for pickup at ${targetOrder.pickupSlot}` : 'Ready for collection at counter'
    };

    if (db) {
      await db.collection('orders').doc(updatedOrder.id).set(updatedOrder);
    }

    canteenState.orders = canteenState.orders.map(o => o.id === updatedOrder.id ? updatedOrder : o);

    res.json({ success: true, order: updatedOrder, message: 'Payment verified & order finalized.' });
  } catch (err: any) {
    console.error('Signature verification server error:', err);
    res.status(500).json({ success: false, error: 'Error finalising transaction payment.' });
  }
});

// 4c. QR Code Verification Endpoint (Staff scanning customer QR)
const QR_SECRET = process.env.QR_SECRET || crypto.randomBytes(32).toString('hex');

function generateSignedQR(orderId: string): string {
  const ts = Date.now().toString();
  const sig = crypto.createHmac('sha256', QR_SECRET).update(`${orderId}.${ts}`).digest('hex');
  return JSON.stringify({ o: orderId, t: ts, s: sig });
}

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

    // Look up order in Firestore or in-memory
    let targetOrder: Order | undefined;
    if (db) {
      try {
        const doc = await db.collection('orders').doc(orderId).get();
        if (doc.exists) {
          targetOrder = doc.data() as Order;
        }
      } catch (err) {
        console.error('QR verify Firestore error:', err);
      }
    }

    if (!targetOrder) {
      targetOrder = canteenState.orders.find(o => o.id === orderId || o.qrCode === code || o.id === code);
    }

    if (!targetOrder) {
      return res.status(404).json({ success: false, verified: false, error: `No order found matching code "${orderId}".` });
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

    // --- Walk-in bill lookup (Firestore) ---
    // Check orders collection first (has correct 'ready' status), then walkin_bills
    if (isWalkin && billNumber && db) {
      // 0. Check orders collection first (walkin bills now saved here with correct status)
      try {
        const orderDoc = await db.collection('orders').doc(billNumber).get();
        console.log('--- QR VERIFY --- orders by doc ID:', orderDoc.exists);
        if (orderDoc.exists) {
          const order = orderDoc.data()!;
          targetOrder = { id: orderDoc.id, ...order };
        }
      } catch (err) {
        console.error('QR verify orders doc ID lookup error:', err);
      }

      // 1. Direct doc ID lookup in walkin_bills (fallback)
      if (!targetOrder) {
        try {
          const doc = await db.collection('walkin_bills').doc(billNumber).get();
          console.log('--- QR VERIFY --- walkin_bills by doc ID:', doc.exists);
          if (doc.exists) {
            const bill = doc.data()!;
            targetOrder = {
              id: doc.id,
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
          const snap = await db.collection('walkin_bills').where('billNumber', '==', billNumber).limit(1).get();
          console.log('--- QR VERIFY --- walkin_bills by billNumber field:', snap.size, 'docs');
          if (!snap.empty) {
            const doc = snap.docs[0];
            const bill = doc.data();
            targetOrder = {
              id: doc.id,
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
      if (searchOrderId && db) {
        try {
          const doc = await db.collection('orders').doc(searchOrderId).get();
          if (doc.exists) {
            targetOrder = doc.data() as Order;
          }
        } catch (err) {
          console.error('QR verify POST Firestore error:', err);
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
  if (db) {
    try {
      const walkinDoc = await db.collection('walkin_bills').doc(id).get();
      if (walkinDoc.exists) {
        const bill = walkinDoc.data();
        const updated = { ...bill, paymentStatus: mappedStatus === 'collected' || mappedStatus === 'delivered' ? 'paid' : bill.paymentStatus, status: mappedStatus };
        await db.collection('walkin_bills').doc(id).set(updated, { merge: true });
        // Update in-memory state too
        canteenState.orders = canteenState.orders.map(order => order.id === id ? { ...order, status: mappedStatus } : order);
        return res.json({ success: true, message: `Walk-in bill status set to: ${mappedStatus}` });
      }
    } catch (err) {
      console.error('Firestore walkin bill status update error:', err);
    }
  }

  let targetOrder: Order | undefined;
  if (db) {
    try {
      const doc = await db.collection('orders').doc(id).get();
      if (doc.exists) {
        targetOrder = doc.data() as Order;
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

  let pickupText = targetOrder.pickupTimeText;
  if (status === 'preparing') pickupText = 'Chef is preparing your meal';
  if (status === 'ready') pickupText = 'Ready! Scan QR code at the counter to collect.';
  if (status === 'collected' || status === 'delivered') pickupText = 'Collected';
  if (status === 'expired') pickupText = 'Expired (Not collected on time)';
  if (status === 'cancelled') pickupText = 'Cancelled';

  const updatedOrder = { ...targetOrder, status: mappedStatus, pickupTimeText: pickupText };

  if (db) {
    try {
      await db.collection('orders').doc(id).set(updatedOrder);
    } catch (err) {
      console.error('Firestore order update status error:', err);
    }
  }

  canteenState.orders = canteenState.orders.map(order => order.id === id ? updatedOrder : order);
  res.json({ success: true, message: `Order status set to: ${mappedStatus}` });
});

// 5a. Update Order Pickup Slot (Owner editing order)
app.post('/api/canteen/order/update-slot', async (req, res) => {
  const { id, pickupSlot } = req.body;
  if (!id || !pickupSlot) {
    return res.status(400).json({ success: false, error: 'Order ID and slot are required.' });
  }

  let targetOrder: Order | undefined;
  if (db) {
    try {
      const doc = await db.collection('orders').doc(id).get();
      if (doc.exists) {
        targetOrder = doc.data() as Order;
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

  if (db) {
    try {
      await db.collection('orders').doc(id).set(updatedOrder);
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
    if (db) {
      try {
        const doc = await db.collection('orders').doc(id).get();
        if (doc.exists) {
          targetOrder = doc.data() as Order;
        }
      } catch (e) {}
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

      if (db) {
        await db.collection('orders').doc(id).set(updated);
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

  if (db) {
    try {
      await db.collection('reviews').doc(reviewId).set(newReview);
      if (menuItemId) {
        const itemDoc = await db.collection('items').doc(menuItemId).get();
        if (itemDoc.exists) {
          const item = itemDoc.data() as MenuItem;
          const count = item.ratingCount || 0;
          const currentRating = item.rating || 5.0;
          const newRating = ((currentRating * count) + Number(rating)) / (count + 1);
          item.rating = Number(newRating.toFixed(1));
          item.ratingCount = count + 1;
          await db.collection('items').doc(menuItemId).set(item);
        }
      }
    } catch (err) {
      console.error('Firestore save review error:', err);
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
  if (db) {
    try {
      const items = await db.collection('items').get();
      for (const doc of items.docs) await doc.ref.delete();
      const orders = await db.collection('orders').get();
      for (const doc of orders.docs) await doc.ref.delete();
      const reviews = await db.collection('reviews').get();
      for (const doc of reviews.docs) await doc.ref.delete();
      await seedFirestoreIfNeeded();
    } catch (err) {
      console.error('Firestore reset error:', err);
    }
  }

  const canteenId = (req.body.canteenId || req.query.canteenId || 'canteen_001') as string;
  const targetCanteen = getCanteenState(canteenId);
  const resetCanteen: Canteen = {
    id: canteenId,
    name: canteenId === 'canteen_001' ? 'Violet Bites' : 'Default Canteen',
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
  if (db) {
    try {
      const snap = await db.collection('orders').where('status', '==', 'ready').get();
      for (const doc of snap.docs) {
        const o = doc.data() as Order;
        if (o.expiryTime && now > o.expiryTime) {
          o.status = 'expired';
          o.pickupTimeText = 'Expired (Not collected on time)';
          await doc.ref.set(o);
          ordersToUpdate.push(o);
        }
      }
    } catch (e) {
      console.error('Firestore expiry check error:', e);
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
  const { noShowMinutes, defaultSlotCapacity } = req.body;
  
  if (noShowMinutes !== undefined) canteenSettings.noShowMinutes = Number(noShowMinutes);
  if (defaultSlotCapacity !== undefined) canteenSettings.defaultSlotCapacity = Number(defaultSlotCapacity);

  if (db) {
    try {
      await db.collection('settings').doc('settings_canteen_001').set(canteenSettings);
    } catch (e) {
      console.error(e);
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
    if (db) {
      try {
        await db.collection('ingredients').doc(ing.id).set(ing);
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
    bill.synced = !!db;

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

    console.log('--- WALKIN BILL --- docId:', docId, 'db:', !!db);

    if (db) {
      // Save to BOTH collections for maximum reliability
      try {
        await db.collection('walkin_bills').doc(docId).set({ ...bill, id: docId });
        console.log('--- WALKIN BILL SAVED to walkin_bills ---');
      } catch (e: any) {
        console.error('--- WALKIN BILL walkin_bills save FAILED ---', e?.message);
      }
      try {
        await db.collection('orders').doc(docId).set(orderData);
        console.log('--- WALKIN BILL SAVED to orders ---');
      } catch (e: any) {
        console.error('--- WALKIN BILL orders save FAILED ---', e?.message);
      }

      bill.id = docId;
      bill.synced = true;
    }

    // Always update in-memory inventory (works with or without Firestore)
    for (const item of orderData.items) {
      const menuItem = canteenState.items.find(m => m.id === item.itemId);
      if (menuItem) {
        menuItem.bookedToday += item.quantity;
        menuItem.stock = Math.max(0, menuItem.stock - item.quantity);
      }
    }

    // Update Firestore inventory if available
    if (db) {
      for (const item of bill.items) {
        try {
          const menuDoc = await db.collection('items').where('id', '==', item.itemId).get();
          if (!menuDoc.empty) {
            const doc = menuDoc.docs[0];
            await doc.ref.update({
              bookedToday: admin.firestore.FieldValue.increment(item.quantity),
              stock: admin.firestore.FieldValue.increment(-item.quantity),
            });
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
    if (db) {
      // 1. Direct doc ID lookup
      const doc = await db.collection('walkin_bills').doc(String(billNumber)).get();
      if (doc.exists) {
        const bill = doc.data()!;
        return res.json({
          success: true,
          order: {
            id: doc.id,
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
      const snap = await db.collection('walkin_bills').where('billNumber', '==', String(billNumber)).limit(1).get();
      if (!snap.empty) {
        const doc = snap.docs[0];
        const bill = doc.data();
        return res.json({
          success: true,
          order: {
            id: doc.id,
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
    if (db) {
      let query: FirebaseFirestore.Query = db.collection('walkin_bills');
      if (canteenId) query = query.where('canteenId', '==', canteenId);
      const snapshot = await query.orderBy('createdAt', 'desc').limit(500).get();
      const bills = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
    if (db) {
      const docRef = db.collection('walkin_bills').doc(billId);
      await docRef.update({ paymentStatus: 'paid', paymentMethod: paymentMethod || 'cash' });
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




// -------------------------------------------------------------
// VITE DEV SERVER OR STATIC PROD PRODUCTION MIDDLEWARE Setup
// -------------------------------------------------------------
async function seedCollegesToFirestore() {
  if (!db) return;
  try {
    const snap = await db.collection('colleges').get();
    if (snap.empty) {
      console.log('Seeding default colleges to Firestore...');
      for (const c of collegesState) {
        await db.collection('colleges').doc(c.id).set(c);
      }
      console.log('Seeded', collegesState.length, 'colleges.');
    }
  } catch (e) {
    console.error('Failed to seed colleges:', e);
  }
}

async function startServer() {
  await seedCollegesToFirestore();
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

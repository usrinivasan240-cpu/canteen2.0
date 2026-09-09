/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface RecipeMap {
  ingredientId: string;
  amountGrams: number;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  stock: number;
  rating: number;
  ratingCount: number;
  available: boolean;
  category: string;
  description: string;
  imageUrl?: string;
  tags?: string[]; // e.g. ["Spicy", "Vegetarian", "Best Seller"]
  prepTime: number; // in minutes
  dailyLimit: number;
  bookedToday: number;
  isPaused: boolean;
  recipe: RecipeMap[];
  canteenId?: string;
  subCanteenId?: string;
  collegeId?: string;
  requiresChef?: boolean;
  primaryChefId?: string | null;
  backupChefId?: string | null;
  preparationType?: 'COOKABLE' | 'READY_TO_SERVE';
}

export interface Chef {
  id: string;
  canteenId: string;
  userId?: string | null;
  name: string;
  phone?: string;
  email?: string;
  specialization?: string[];
  status: 'AVAILABLE' | 'UNAVAILABLE' | 'ON_LEAVE' | 'INACTIVE';
  isAvailable: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface KitchenTaskItem {
  itemId: string;
  itemName: string;
  quantity: number;
  price?: number;
}

export interface KitchenTask {
  id: string;
  orderId: string;
  canteenId: string;
  subCanteenId?: string;
  chefId: string | null;
  items: KitchenTaskItem[];
  status: 'PENDING' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'CANCELLED' | 'COMPLETED';
  priority?: number;
  assignedAt?: number;
  startedAt?: number;
  completedAt?: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface ChefLeave {
  id: string;
  chefId: string;
  startDate: number;
  endDate: number;
  reason?: string;
  createdAt?: number;
}

export interface OrderItem {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
}

export type OrderStatus = 'pending' | 'scheduled' | 'preparing' | 'ready' | 'collected' | 'expired' | 'cancelled' | 'delivered';
export type PaymentStatus = 'pending' | 'paid' | 'failed';

export interface Order {
  id: string;
  userId: string;
  userName: string;
  items: OrderItem[];
  totalPrice: number;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  qrCode: string;
  qrPayload?: string;
  status: OrderStatus;
  timestamp: string;
  createdAt: number;
  pickupTimeText?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  vyaparTxnId?: string;
  upiQrUrl?: string;
  upiString?: string;
  pickupSlot?: string;
  prepStartTime?: number;
  expiryTime?: number;
  canteenId?: string;
  subCanteenId?: string;
  collegeId?: string;
}

export interface Ingredient {
  id: string;
  name: string;
  stockGrams: number;
  unit: string;
  canteenId?: string;
  subCanteenId?: string;
}

export interface CanteenSettings {
  noShowMinutes: number;
  defaultSlotCapacity: number;
  slotDuration: number;
  prepBufferMinutes: number;
  orderCutoffMinutes: number;
  advanceBookingDays: number;
  canteenId?: string;
}

export interface Review {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  timestamp: string;
  menuItemId?: string;
  menuItemName?: string;
  canteenId?: string;
  subCanteenId?: string;
}

export interface CollegeBranding {
  heroTitle?: string;
  heroSubtitle?: string;
  heroTagline?: string;
  featureBadges?: string[];
  menuTitle?: string;
  menuSubtitle?: string;
  menuColumns?: number;
  showCategoryTabs?: boolean;
  showReviews?: boolean;
  showSentiment?: boolean;
  contactPhone?: string;
  contactEmail?: string;
  contactAddress?: string;
  footerCopyright?: string;
  footerLinks?: { label: string; action: string }[];
  heroLayout?: 'logo-left' | 'logo-center' | 'logo-right' | 'banner-left';
  heroLogoSize?: number;
  heroPadding?: string;
  heroBannerPosition?: 'right' | 'left' | 'background' | 'bottom';
  menuCardSize?: 'small' | 'medium' | 'large';
  menuGap?: string;
  menuAlignment?: 'left' | 'center' | 'justify';
  footerLayout?: '3-col' | '2-col' | '1-col';
  sectionSpacing?: string;
  headerStyle?: 'rounded' | 'flat' | 'shadow';
}

export interface PlatformFeesConfig {
  type: 'free' | 'flat' | 'percentage' | 'tiered' | 'custom';
  flatAmount?: number;           // e.g., 1 rupee per order
  percentage?: number;           // e.g., 1% of bill amount
  tiers?: PlatformFeeTier[];     // e.g., 1₹ for 0-100, 2₹ for 101-200, 3₹ for 301-400
  customFormula?: string;        // custom JS expression for complex calculations
  razorpayEnabled?: boolean;     // whether to use Razorpay for platform fee collection
  razorpayAccountId?: string;    // Razorpay account ID for fee collection
}

export interface PlatformFeeTier {
  minAmount: number;             // minimum bill amount (inclusive)
  maxAmount: number;             // maximum bill amount (inclusive), 0 = no upper limit
  feeAmount: number;             // platform fee for this tier
}

export interface RazorpayConfig {
  enabled: boolean;
  accountId?: string;
  keyId?: string;
  keySecret?: string; // encrypted or stored securely
  webhookSecret?: string;
}

export interface College {
  id: string;
  name: string;
  location: string;
  logoUrl?: string;
  bannerUrl?: string;
  bannerSubtitle?: string;
  bannerFeatures?: string[];
  branding?: CollegeBranding;
  status: 'active' | 'inactive';
  platformFees?: PlatformFeesConfig;
  razorpayConfig?: RazorpayConfig;
}

export interface Canteen {
  id: string;
  name: string;
  collegeId: string;
  ownerId: string;
  ownerName?: string;
  status: 'active' | 'inactive';
  location?: string;
  logoUrl?: string;
  items?: MenuItem[];
  orders?: Order[];
  reviews?: Review[];
  ingredients?: Ingredient[];
  settings?: CanteenSettings;
}

export interface SubCanteen {
  id: string;
  name: string;
  canteenId: string;
  status: 'active' | 'inactive';
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'superadmin' | 'admin' | 'owner' | 'chef' | 'staff' | 'customer';
  phone?: string;
  registerNumber?: string;
  collegeId?: string;
  canteenId?: string;
  subCanteenId?: string;
  status: 'active' | 'suspended';
  password?: string;
  posting?: string;
  createdAt?: number;
}

export interface AIRecommendation {
  title: string;
  reason: string;
  itemIds: string[];
}

export interface AIInventoryPredictor {
  itemId: string;
  name: string;
  predictedDemand: number;
  currentStock: number;
  restockAlert: boolean;
  reason: string;
}

export interface AISalesOptimizations {
  insights: string[];
  topPerformanceDish: string;
}

export interface WalkinCartItem {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  specialInstructions?: string;
}

export interface WalkinBill {
  id: string;
  billNumber: string;
  items: WalkinCartItem[];
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  paymentStatus: 'paid' | 'pending';
  paymentMethod?: 'cash' | 'upi' | 'card' | 'netbanking' | 'wallet' | 'other';
  customerName?: string;
  customerPhone?: string;
  customerRegNo?: string;
  customerDept?: string;
  customerNotes?: string;
  pendingReason?: string;
  pendingExpectedTime?: string;
  cashierName: string;
  canteenId: string;
  subCanteenId?: string;
  collegeId?: string;
  timestamp: string;
  createdAt: number;
  synced: boolean;
  type: 'walkin';
}

export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  category: 'payment' | 'refund' | 'order' | 'account' | 'app' | 'other';
  subject: string;
  description: string;
  orderId?: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  createdAt: number;
  updatedAt: number;
  adminReply?: string;
  canteenId?: string;
  collegeId?: string;
}

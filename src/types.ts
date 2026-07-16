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
  status: OrderStatus;
  timestamp: string;
  createdAt: number;
  pickupTimeText?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  pickupSlot?: string; // e.g. "12:45 PM"
  prepStartTime?: number; // unix timestamp
  expiryTime?: number; // unix timestamp
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

export interface College {
  id: string;
  name: string;
  location: string;
  status: 'active' | 'inactive';
}

export interface Canteen {
  id: string;
  name: string;
  collegeId: string;
  ownerId: string; // matches owner User.id or email
  ownerName?: string;
  status: 'active' | 'inactive';
  location?: string;
  razorpayAccountId?: string;
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
  collegeId?: string; // assigned college for Admins/Chefs/Staff
  canteenId?: string; // assigned canteen for Owners/Chefs/Staff
  subCanteenId?: string; // assigned sub-canteen for Chefs/Staff
  status: 'active' | 'suspended';
  password?: string;
  posting?: string;
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

export interface User {
  _id: string;
  name: string;
  email: string;
  role: "student" | "chef" | "staff" | "owner" | "admin" | "superadmin";
  phone?: string;
  registerNumber?: string;
  collegeId?: string;
  canteenId?: string;
  subCanteenId?: string;
}

export interface MenuItem {
  _id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image?: string;
  imageUrl?: string;
  available: boolean;
  requiresChef: boolean;
  canteenId: string;
  subCanteenId?: string;
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
}

export interface OrderItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  _id: string;
  userId: string;
  userName: string;
  items: OrderItem[];
  total: number;
  paymentMethod: string;
  pickupSlot: string;
  status: string;
  canteenId: string;
  subCanteenId?: string;
  qrCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  _id: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  canteenId: string;
  createdAt: string;
}

export interface Canteen {
  _id: string;
  name: string;
  description?: string;
  image?: string;
  location?: string;
  subCanteens?: SubCanteen[];
}

export interface SubCanteen {
  _id: string;
  name: string;
}

export interface CanteenData {
  canteen: Canteen;
  menu: MenuItem[];
  orders: Order[];
  reviews: Review[];
  ingredients: string[];
  settings: Record<string, unknown>;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface QRVerifyResponse {
  valid: boolean;
  order?: Order;
  message?: string;
}

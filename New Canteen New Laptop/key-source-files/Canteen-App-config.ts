export const API_BASE = "https://canteen20.vercel.app";

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBghKsD84qXfDtmnVj75deoc_xG7j2ApXw",
  authDomain: "canteen2-0.firebaseapp.com",
  projectId: "canteen2-0",
  storageBucket: "canteen2-0.firebasestorage.app",
  messagingSenderId: "114993861211756843019",
  appId: "1:114993861211756843019:web:e0f9c0c2c0e704b0544a4d",
};

export const ORDER_STATUSES = [
  "pending",
  "scheduled",
  "preparing",
  "ready",
  "collected",
  "delivered",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PICKUP_SLOTS = [
  "12:00 PM",
  "12:30 PM",
  "1:00 PM",
  "1:30 PM",
  "2:00 PM",
  "2:30 PM",
  "6:00 PM",
  "6:30 PM",
  "7:00 PM",
  "7:30 PM",
] as const;

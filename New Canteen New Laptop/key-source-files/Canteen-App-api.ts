import { API_BASE } from "./config";
import AsyncStorage from "@react-native-async-storage/async-storage";

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem("auth_token");
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.text();
    let msg = `Request failed (${res.status})`;
    try {
      const json = JSON.parse(body);
      msg = json.message || json.error || msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: any }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  register: (name: string, email: string, password: string, phone: string, registerNumber: string, collegeId: string) =>
    request<{ token: string; user: any }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password, role: "customer", phone, registerNumber, collegeId }),
    }),

  getColleges: () =>
    request<{ success: boolean; colleges: any[] }>("/api/colleges"),

  getCanteen: (canteenId: string) =>
    request<any>(`/api/canteen?canteenId=${canteenId}`),

  listCanteens: () =>
    request<{ success: boolean; canteens: any[] }>("/api/canteens"),

  getMenu: (canteenId: string) =>
    request<any[]>(`/api/canteen/menu?canteenId=${canteenId}`),

  addMenuItem: (item: any) =>
    request<any>("/api/canteen/menu", {
      method: "POST",
      body: JSON.stringify(item),
    }),

  deleteMenuItem: (id: string) =>
    request<any>(`/api/canteen/menu/${id}`, { method: "DELETE" }),

  placeOrder: (order: {
    userId: string;
    userName: string;
    items: any[];
    paymentMethod: string;
    pickupSlot: string;
    canteenId: string;
    subCanteenId?: string;
  }) =>
    request<any>("/api/canteen/order", {
      method: "POST",
      body: JSON.stringify(order),
    }),

  updateOrderStatus: (id: string, status: string) =>
    request<any>("/api/canteen/order/status", {
      method: "POST",
      body: JSON.stringify({ id, status }),
    }),

  batchUpdateStatus: (ids: string[], status: string) =>
    request<any>("/api/canteen/order/batch-status", {
      method: "POST",
      body: JSON.stringify({ ids, status }),
    }),

  verifyQR: (code: string) =>
    request<any>(`/api/canteen/qr/verify?code=${code}`),

  submitReview: (review: {
    userId: string;
    userName: string;
    rating: number;
    comment: string;
    canteenId: string;
  }) =>
    request<any>("/api/canteen/review", {
      method: "POST",
      body: JSON.stringify(review),
    }),
};

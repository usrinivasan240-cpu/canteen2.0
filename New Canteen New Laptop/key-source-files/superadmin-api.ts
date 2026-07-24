import { API_BASE } from './config';
import type { CanteenData } from './types';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  const token = localStorage.getItem('superadmin_token');
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `Request failed: ${res.status}`);
  }
  const text = await res.text();
  if (!text) return [] as unknown as T;
  const json = JSON.parse(text);
  if (json && typeof json === 'object' && 'success' in json) {
    const values = Object.values(json).filter(v => Array.isArray(v));
    if (values.length === 1) return values[0] as T;
    if (json.data) return json.data as T;
    return json as T;
  }
  return json as T;
}

function get<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' });
}

function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body) });
}

function put<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'PUT', body: JSON.stringify(body) });
}

function del<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' });
}

export const api = {
  auth: {
    login: (email: string, password: string, role: string) =>
      post<{ success: boolean; user: { id: string; name: string; email: string; role: string; collegeId?: string; canteenId?: string; subCanteenId?: string } }>('/api/auth/login', { email, password, role }),
  },

  colleges: {
    list: () => get<unknown[]>('/api/colleges'),
    create: (data: { name: string; location: string; status: string }) =>
      post<unknown>('/api/colleges', data),
    remove: (id: string) => del<unknown>(`/api/colleges/${id}`),
  },

  canteens: {
    list: () => get<unknown[]>('/api/canteens'),
    create: (data: { name: string; collegeId: string; ownerName: string; ownerEmail: string; location: string }) =>
      post<unknown>('/api/canteens', data),
    update: (id: string, data: { name?: string; collegeId?: string; ownerName?: string; location?: string; status?: string }) =>
      put<unknown>(`/api/canteens/${id}`, data),
    remove: (id: string) => del<unknown>(`/api/canteens/${id}`),
    updateName: (canteenId: string, name: string) =>
      post<unknown>('/api/canteen/update-name', { canteenId, name }),
  },

  subcanteens: {
    list: () => get<unknown[]>('/api/subcanteens'),
    create: (data: { name: string; canteenId: string; status: string }) =>
      post<unknown>('/api/subcanteens', data),
    remove: (id: string) => del<unknown>(`/api/subcanteens/${id}`),
  },

  users: {
    list: () => get<unknown[]>('/api/users'),
    create: (data: { name: string; email: string; password: string; role: string; collegeId?: string; canteenId?: string; subCanteenId?: string; posting?: string }) =>
      post<unknown>('/api/users', data),
    remove: (email: string) => del<unknown>(`/api/users/${encodeURIComponent(email)}`),
    update: (email: string, data: { role: string; name?: string; collegeId?: string; canteenId?: string; subCanteenId?: string; posting?: string; status?: string }) =>
      put<unknown>(`/api/users/${encodeURIComponent(email)}/role`, data),
  },

  canteenData: {
    get: (canteenId: string) =>
      get<CanteenData>(`/api/canteen?canteenId=${encodeURIComponent(canteenId)}`),
  },
};

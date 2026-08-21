const isCapacitor = !!(window as any).Capacitor;
const isLocalDev = window.location.hostname === 'localhost' && window.location.port !== '' && !isCapacitor;

export const API_BASE = isLocalDev
  ? ''
  : (import.meta.env.VITE_API_BASE_URL as string) || 'https://canteen20.vercel.app';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://azoutmrplruhcdxejynj.supabase.co';
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6b3V0bXJwbHJ1aGNkeGVqeW5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1ODYwOTMsImV4cCI6MjEwMjE2MjA5M30.55oQBJC35IUjihXw0wYPtpDC-qpBpG_1CVEigTN-RLA';

function getTokenExp(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

let refreshingPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('bb_refresh_token');
  if (!refreshToken) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY
    },
    body: JSON.stringify({ refresh_token: refreshToken })
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.access_token) return null;
  localStorage.setItem('bb_token', data.access_token);
  if (data.refresh_token) localStorage.setItem('bb_refresh_token', data.refresh_token);
  return data.access_token;
}

// Global fetch interceptor: auto-inject Authorization Bearer token from localStorage,
// silently refreshing the Supabase access token when it is at/near expiry.
const _originalFetch = window.fetch;
window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  try {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith(API_BASE)) {
      let token = localStorage.getItem('bb_token');
      if (token) {
        const exp = getTokenExp(token);
        if (exp !== null && exp * 1000 - Date.now() < 60_000 && localStorage.getItem('bb_refresh_token')) {
          if (!refreshingPromise) {
            refreshingPromise = refreshAccessToken().finally(() => { refreshingPromise = null; });
          }
          const fresh = await refreshingPromise;
          if (fresh) token = fresh;
        }
        init = init || {};
        init.headers = {
          ...(init.headers as Record<string, string> || {}),
          'Authorization': `Bearer ${token}`
        };
      }
    }
  } catch {}
  return _originalFetch(input, init);
};

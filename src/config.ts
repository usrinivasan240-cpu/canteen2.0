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

function needsRefresh(token: string): boolean {
  const exp = getTokenExp(token);
  if (exp === null) return true;
  return exp * 1000 - Date.now() < 60_000;
}

function hardResetAuth(): void {
  ['bb_token', 'bb_refresh_token', 'bb_user', 'bb_role', 'bb_loggedIn'].forEach((k) => localStorage.removeItem(k));
  window.location.reload();
}

let refreshingPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('bb_refresh_token');
  if (!refreshToken) return null;
  try {
    const res = await _originalFetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
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
  } catch {
    return null;
  }
}

async function getValidToken(): Promise<string | null> {
  let token = localStorage.getItem('bb_token');
  if (!token) return null;
  const hasRefresh = !!localStorage.getItem('bb_refresh_token');
  if (needsRefresh(token)) {
    if (!hasRefresh) {
      // Legacy/expired token with no way to renew — force clean re-login.
      hardResetAuth();
      return null;
    }
    if (!refreshingPromise) {
      refreshingPromise = refreshAccessToken().finally(() => { refreshingPromise = null; });
    }
    const fresh = await refreshingPromise;
    if (!fresh) {
      hardResetAuth();
      return null;
    }
    token = fresh;
  }
  return token;
}

// Global fetch interceptor: auto-inject Authorization Bearer token, proactively
// refreshing near expiry, and self-healing on 401 by refreshing + retrying once.
const _originalFetch = window.fetch;
window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (!rawUrl.startsWith(API_BASE)) return _originalFetch(input, init);

  const sendWithToken = async (): Promise<{ res: Response; sentToken: string | null } | null> => {
    const token = await getValidToken();
    if (!token) return null;
    const nextInit: RequestInit = { ...(init || {}) };
    nextInit.headers = {
      ...((init?.headers as Record<string, string>) || {}),
      'Authorization': `Bearer ${token}`
    };
    const res = await _originalFetch(input, nextInit);
    return { res, sentToken: token };
  };

  let attempt = await sendWithToken();
  if (!attempt) return _originalFetch(input, init);
  if (attempt.res.status === 401) {
    // Token rejected mid-flight (revoked/rotated server-side): force one refresh+retry.
    let fresh: string | null = null;
    if (localStorage.getItem('bb_refresh_token')) {
      if (!refreshingPromise) {
        refreshingPromise = refreshAccessToken().finally(() => { refreshingPromise = null; });
      }
      fresh = await refreshingPromise;
    }
    if (fresh) {
      attempt = await sendWithToken();
      if (!attempt) return _originalFetch(input, init);
    }
    if (!fresh || attempt.res.status === 401) {
      // Session unrecoverable — clean re-login instead of endless errors.
      hardResetAuth();
      return attempt.res;
    }
  }
  return attempt.res;
};

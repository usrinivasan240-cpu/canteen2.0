const isCapacitor = !!(window as any).Capacitor;
const hostname = window.location.hostname;
const isLocalDev = (hostname === 'localhost' || hostname === '127.0.0.1') && window.location.port !== '' && !isCapacitor;

export const API_BASE = isLocalDev
  ? ''
  : (import.meta.env.VITE_API_BASE_URL as string) || window.location.origin;

// Supabase creds resolve from build-time VITE_* when present, otherwise at
// runtime from /api/client-config. Nothing is hardcoded, so rotating Supabase
// no longer requires a frontend rebuild.
let supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || '';
let supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';
let configLoaded = !!(supabaseUrl && supabaseAnonKey);
let configPromise: Promise<boolean> | null = null;

export let isSupabaseConfigured = configLoaded;

async function loadSupabaseConfig(): Promise<boolean> {
  if (configLoaded) return true;
  if (!configPromise) {
    // Uses the pre-interceptor fetch on purpose: the interceptor would re-enter
    // refreshAccessToken and recurse.
    configPromise = _originalFetch(`${API_BASE}/api/client-config`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && d.supabaseUrl && d.supabaseAnonKey) {
          supabaseUrl = d.supabaseUrl;
          supabaseAnonKey = d.supabaseAnonKey;
          configLoaded = true;
          isSupabaseConfigured = true;
          return true;
        }
        console.error('[config] /api/client-config returned no Supabase creds — set SUPABASE_URL and SUPABASE_ANON_KEY on the server.');
        return false;
      })
      .catch(() => false);
  }
  return configPromise;
}

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

function hardResetAuth(canReload = true): void {
  ['bb_token', 'bb_refresh_token', 'bb_user', 'bb_role', 'bb_loggedIn'].forEach((k) => localStorage.removeItem(k));
  // Reloading only helps if a fresh session can be established. When the Supabase
  // creds are unavailable it cannot, so reloading here would trap the visitor in
  // an endless refresh loop with no way back out.
  if (!canReload) return;
  window.location.reload();
}

let refreshingPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('bb_refresh_token');
  if (!refreshToken) return null;
  if (!(await loadSupabaseConfig())) return null;
  try {
    const res = await _originalFetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey
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
      hardResetAuth(configLoaded);
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
  // Local-dev API_BASE is '' — ''.startsWith matches everything, so bail out
  // explicitly instead of leaking Bearer tokens to external URLs.
  if (!API_BASE || !rawUrl.startsWith(API_BASE)) return _originalFetch(input, init);

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
      hardResetAuth(configLoaded);
      return attempt.res;
    }
  }
  return attempt.res;
};

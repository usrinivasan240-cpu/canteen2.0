const isCapacitor = !!(window as any).Capacitor;
const isLocalDev = window.location.hostname === 'localhost' && window.location.port !== '' && !isCapacitor;

export const API_BASE = isLocalDev
  ? ''
  : (import.meta.env.VITE_API_BASE_URL as string) || 'https://canteen20.vercel.app';

// Global fetch interceptor: auto-inject Authorization Bearer token from localStorage
const _originalFetch = window.fetch;
window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  try {
    const token = localStorage.getItem('bb_token');
    if (token) {
      init = init || {};
      init.headers = {
        ...(init.headers as Record<string, string> || {}),
        'Authorization': `Bearer ${token}`
      };
    }
  } catch {}
  return _originalFetch(input, init);
};

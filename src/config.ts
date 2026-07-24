const isCapacitor = !!(window as any).Capacitor;
const isLocalDev = window.location.hostname === 'localhost' && window.location.port !== '' && !isCapacitor;

export const API_BASE = isLocalDev
  ? ''
  : (import.meta.env.VITE_API_BASE_URL as string) || 'https://canteen20.vercel.app';

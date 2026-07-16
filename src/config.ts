export const API_BASE = (window.location.hostname === 'localhost' && window.location.port !== '')
  ? ''
  : (import.meta.env.VITE_API_BASE_URL as string) || 'https://canteen20.vercel.app';

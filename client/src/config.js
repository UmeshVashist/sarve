// Central API configuration for Local Node.js server or Cloudflare Workers
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? '' // Use relative path /api for deployed web apps on Cloudflare/Vercel
    : 'http://localhost:5000');

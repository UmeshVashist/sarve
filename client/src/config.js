// Central API configuration for Survey Portal (Cloudflare Workers & D1 Database)
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  'https://sarve-portal-api.umeshvashist9.workers.dev';

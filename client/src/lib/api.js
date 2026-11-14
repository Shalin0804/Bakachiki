import axios from 'axios';

// VITE_API_URL is only needed when the API lives on another origin; in dev Vite proxies /api.
const API_ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* private mode */ } },
};
export const tokens = {
  auth: () => store.get('bk_token'),
  setAuth: (t) => store.set('bk_token', t),
  // Admin panel session is kept apart from the storefront one; the server also issues them for different audiences.
  admin: () => store.get('bk_admin_token'),
  setAdmin: (t) => store.set('bk_admin_token', t),
  cart: () => store.get('bk_cart'),
  setCart: (t) => store.set('bk_cart', t),
};

export const api = axios.create({ baseURL: `${API_ORIGIN}/api`, timeout: 20000 });

const isAdminCall = (url = '') => url.startsWith('/admin') || url.startsWith('/auth/admin');

api.interceptors.request.use((config) => {
  if (isAdminCall(config.url)) {
    const admin = tokens.admin();
    if (admin) config.headers.Authorization = `Bearer ${admin}`;
    return config;
  }
  const auth = tokens.auth();
  const cart = tokens.cart();
  if (auth) config.headers.Authorization = `Bearer ${auth}`;
  if (cart) config.headers['X-Cart-Token'] = cart;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const data = err.response?.data;
    const e = new Error(data?.error || (err.code === 'ECONNABORTED' ? 'The server took too long to respond' : 'Network error — check your connection'));
    e.status = err.response?.status;
    e.details = data?.details;
    if (e.status === 401) {
      if (isAdminCall(err.config?.url)) { if (tokens.admin()) window.dispatchEvent(new Event('bk:admin-unauthorized')); }
      else if (tokens.auth()) window.dispatchEvent(new Event('bk:unauthorized'));
    }
    return Promise.reject(e);
  },
);

/** Resolves server-relative media URLs against the API origin. */
export const asset = (url) => (!url ? '' : /^(https?:|data:|blob:)/.test(url) ? url : `${API_ORIGIN}${url}`);

export const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export const formatDate = (d, opts = { day: 'numeric', month: 'short', year: 'numeric' }) => new Date(d).toLocaleDateString('en-IN', opts);

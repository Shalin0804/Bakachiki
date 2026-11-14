import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, tokens } from '../lib/api.js';

const SettingsCtx = createContext(null);
const AuthCtx = createContext(null);
const CartCtx = createContext(null);
const UiCtx = createContext(null);

export const useSettings = () => useContext(SettingsCtx);
export const useAuth = () => useContext(AuthCtx);
export const useCart = () => useContext(CartCtx);
export const useUi = () => useContext(UiCtx);

const EMPTY_CART = { items: [], totals: { count: 0, subtotal: 0, discount: 0, shipping: 0, total: 0, free_shipping_remaining: 0 } };

export function StoreProvider({ children }) {
  // ---------- UI: toasts, fly-to-bag, quick view ----------
  const [toasts, setToasts] = useState([]);
  const [flyer, setFlyer] = useState(null);
  const [bagBump, setBagBump] = useState(0);
  const [quickView, setQuickView] = useState(null);
  const bagRef = useRef(null);

  const toast = useCallback((message, tone = 'ok') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t.slice(-2), { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);

  const fly = useCallback((src, fromEl) => {
    const bag = bagRef.current;
    if (!src || !fromEl || !bag || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setBagBump((n) => n + 1); return; }
    const from = fromEl.getBoundingClientRect();
    const to = bag.getBoundingClientRect();
    setFlyer({ id: Date.now(), src, from, to });
  }, []);
  const landed = useCallback(() => { setFlyer(null); setBagBump((n) => n + 1); }, []);

  // ---------- Settings ----------
  const [settings, setSettings] = useState(null);
  const [payments, setPayments] = useState({ razorpay: false, cod: true });
  const [bootError, setBootError] = useState(null);
  const loadSettings = useCallback(async () => {
    try {
      const { data } = await api.get('/settings');
      setSettings(data.settings);
      setPayments(data.payments);
      setBootError(null);
    } catch (e) { setBootError(e.message); }
  }, []);

  // ---------- Auth ----------
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(!tokens.auth());
  const [wishlist, setWishlist] = useState([]);
  const wishIds = useMemo(() => new Set(wishlist.map((p) => p.id)), [wishlist]);

  // ---------- Cart ----------
  const [cart, setCart] = useState(EMPTY_CART);
  const [cartLoading, setCartLoading] = useState(false);
  const applyCart = useCallback((data) => {
    if (data.token && !tokens.auth()) tokens.setCart(data.token);
    setCart(data);
    return data;
  }, []);
  const refreshCart = useCallback(async (coupon) => {
    if (!tokens.auth() && !tokens.cart()) { setCart(EMPTY_CART); return EMPTY_CART; }
    setCartLoading(true);
    try {
      const { data } = await api.get('/cart', { params: coupon ? { coupon } : {} });
      return applyCart(data);
    } catch (e) {
      if (e.status === 401) setCart(EMPTY_CART);
      return EMPTY_CART;
    } finally { setCartLoading(false); }
  }, [applyCart]);

  const startSession = useCallback(async ({ token, user: u }) => {
    tokens.setAuth(token);
    tokens.setCart(null); // server merged the guest cart into the account during login/register
    setUser(u);
    const [w] = await Promise.all([api.get('/account/wishlist').catch(() => ({ data: { products: [] } })), refreshCart()]);
    setWishlist(w.data.products);
  }, [refreshCart]);

  const logout = useCallback(() => {
    tokens.setAuth(null);
    setUser(null);
    setWishlist([]);
    setCart(EMPTY_CART);
  }, []);

  useEffect(() => {
    loadSettings();
    (async () => {
      if (tokens.auth()) {
        try {
          const { data } = await api.get('/auth/me');
          setUser(data.user);
          const w = await api.get('/account/wishlist');
          setWishlist(w.data.products);
        } catch { tokens.setAuth(null); }
        setAuthReady(true);
      }
      refreshCart();
    })();
    const onUnauthorized = () => logout();
    window.addEventListener('bk:unauthorized', onUnauthorized);
    return () => window.removeEventListener('bk:unauthorized', onUnauthorized);
  }, [loadSettings, refreshCart, logout]);

  const auth = useMemo(() => ({
    user, authReady,
    login: async (body) => { const { data } = await api.post('/auth/login', body); await startSession(data); return data.user; },
    register: async (body) => { const { data } = await api.post('/auth/register', body); await startSession(data); return data.user; },
    startSession, logout, setUser,
    wishlist, wishIds,
    toggleWishlist: async (productId) => {
      if (!user) { toast('Log in to save pieces to your wishlist', 'info'); return false; }
      const had = wishIds.has(productId);
      const { data } = had ? await api.delete(`/account/wishlist/${productId}`) : await api.post('/account/wishlist', { product_id: productId });
      setWishlist(data.products);
      toast(had ? 'Removed from wishlist' : 'Saved to wishlist');
      return !had;
    },
  }), [user, authReady, startSession, logout, wishlist, wishIds, toast]);

  const cartApi = useMemo(() => ({
    cart, cartLoading, refreshCart,
    count: cart.totals?.count || 0,
    add: async (variantId, quantity = 1, { image, fromEl } = {}) => {
      const { data } = await api.post('/cart/items', { variant_id: variantId, quantity });
      applyCart(data);
      fly(image, fromEl);
      toast('Added to bag');
      return data;
    },
    update: async (itemId, patch) => applyCart((await api.patch(`/cart/items/${itemId}`, patch)).data),
    remove: async (itemId) => applyCart((await api.delete(`/cart/items/${itemId}`)).data),
    reset: () => setCart(EMPTY_CART),
  }), [cart, cartLoading, refreshCart, applyCart, fly, toast]);

  const ui = useMemo(() => ({ toast, toasts, fly, flyer, landed, bagRef, bagBump, quickView, openQuickView: setQuickView, closeQuickView: () => setQuickView(null) }),
    [toast, toasts, fly, flyer, landed, bagBump, quickView]);

  const settingsApi = useMemo(() => ({ settings, payments, reload: loadSettings, bootError }), [settings, payments, loadSettings, bootError]);

  return (
    <SettingsCtx.Provider value={settingsApi}>
      <AuthCtx.Provider value={auth}>
        <CartCtx.Provider value={cartApi}>
          <UiCtx.Provider value={ui}>{children}</UiCtx.Provider>
        </CartCtx.Provider>
      </AuthCtx.Provider>
    </SettingsCtx.Provider>
  );
}

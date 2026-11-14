import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useAuth, useSettings } from './context/store.jsx';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import QuickView from './components/QuickView.jsx';
import { Loader, FlyToBag, Toasts, Cursor } from './components/Overlays.jsx';
import { PageLoader } from './components/ui.jsx';
import Home from './pages/Home.jsx';

const Shop = lazy(() => import('./pages/Shop.jsx'));
const Collections = lazy(() => import('./pages/Collections.jsx'));
const Product = lazy(() => import('./pages/Product.jsx'));
const Cart = lazy(() => import('./pages/Cart.jsx'));
const Checkout = lazy(() => import('./pages/Checkout.jsx'));
const OrderView = lazy(() => import('./pages/OrderView.jsx'));
const Auth = lazy(() => import('./pages/Auth.jsx'));
const Account = lazy(() => import('./pages/Account.jsx'));
const About = lazy(() => import('./pages/About.jsx'));
const Contact = lazy(() => import('./pages/Contact.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));
const AdminApp = lazy(() => import('./admin/AdminApp.jsx'));

export function RequireAuth({ children, admin = false }) {
  const { user, authReady } = useAuth();
  const location = useLocation();
  if (!authReady) return <PageLoader />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (admin && user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [pathname]);
  return null;
}

export default function App() {
  const location = useLocation();
  const { settings, bootError, reload } = useSettings();
  const isAdmin = location.pathname.startsWith('/admin');

  if (bootError && !settings) {
    return (
      <div className="grid min-h-dvh place-items-center bg-ink p-6 text-center">
        <div>
          <p className="display text-5xl">STORE OFFLINE</p>
          <p className="mt-3 text-mute">We couldn’t reach the BAKACHIKI server. {bootError}</p>
          <button className="btn btn-solid mt-6" onClick={reload}>Try again</button>
        </div>
      </div>
    );
  }

  if (isAdmin) {
    return (
      <Suspense fallback={<PageLoader />}>
        <ScrollToTop />
        <Routes>
          <Route path="/admin/*" element={<RequireAuth admin><AdminApp /></RequireAuth>} />
        </Routes>
        <Toasts />
      </Suspense>
    );
  }

  return (
    <div className="grain flex min-h-dvh flex-col">
      <Loader ready={Boolean(settings)} />
      <ScrollToTop />
      <Header />
      <Suspense fallback={<PageLoader />}>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Home />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/shop/:category" element={<Shop />} />
            <Route path="/new-drops" element={<Shop preset="new" />} />
            <Route path="/collections" element={<Collections />} />
            <Route path="/collections/:collection" element={<Shop />} />
            <Route path="/product/:slug" element={<Product />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/order/:number" element={<OrderView />} />
            <Route path="/login" element={<Auth mode="login" />} />
            <Route path="/register" element={<Auth mode="register" />} />
            <Route path="/forgot-password" element={<Auth mode="forgot" />} />
            <Route path="/reset-password/:token" element={<Auth mode="reset" />} />
            <Route path="/account/*" element={<RequireAuth><Account /></RequireAuth>} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AnimatePresence>
      </Suspense>
      <Footer />
      <QuickView />
      <FlyToBag />
      <Toasts />
      <Cursor />
    </div>
  );
}

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Shirt, ShoppingCart, Users, TicketPercent, FolderTree, Settings, MessageSquare, LogOut, Menu, X, ExternalLink, Boxes, ShieldCheck, KeyRound } from 'lucide-react';
import { api, tokens } from '../lib/api.js';
import { useSeo } from '../lib/seo.js';
import { PageLoader } from '../components/ui.jsx';
import AdminLogin from './AdminLogin.jsx';
import Inventory from './Inventory.jsx';
import { Staff, MyPassword } from './Staff.jsx';
import Dashboard from './Dashboard.jsx';
import { ProductList, ProductEdit } from './Products.jsx';
import { OrderList, OrderDetail, Invoice } from './Orders.jsx';
import { CustomerList, CustomerDetail } from './Customers.jsx';
import Coupons from './Coupons.jsx';
import Catalog from './Catalog.jsx';
import Content from './Content.jsx';
import Reviews from './Reviews.jsx';

const NAV = [
  ['/admin/dashboard', 'Dashboard', LayoutDashboard], ['/admin/products', 'Products', Shirt], ['/admin/orders', 'Orders', ShoppingCart],
  ['/admin/customers', 'Customers', Users], ['/admin/inventory', 'Inventory', Boxes], ['/admin/coupons', 'Coupons', TicketPercent],
  ['/admin/catalog', 'Categories & collections', FolderTree], ['/admin/reviews', 'Reviews', MessageSquare],
  ['/admin/settings', 'Settings & content', Settings], ['/admin/staff', 'Staff & roles', ShieldCheck, 'super_admin'],
];

// Admin session: separate token, separate login, separate context from the storefront's customer session.
const AdminCtx = createContext(null);
export const useAdmin = () => useContext(AdminCtx);

export default function AdminApp() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(!tokens.admin());
  const logout = useCallback(() => { tokens.setAdmin(null); setUser(null); }, []);

  useEffect(() => {
    if (tokens.admin()) {
      api.get('/auth/admin/me').then(({ data }) => setUser(data.user)).catch(() => tokens.setAdmin(null)).finally(() => setReady(true));
    }
    window.addEventListener('bk:admin-unauthorized', logout);
    return () => window.removeEventListener('bk:admin-unauthorized', logout);
  }, [logout]);

  const value = useMemo(() => ({
    user, logout,
    login: async (body) => { const { data } = await api.post('/auth/admin/login', body); tokens.setAdmin(data.token); setUser(data.user); },
  }), [user, logout]);

  return (
    <AdminCtx.Provider value={value}>
      <Routes>
        <Route path="login" element={<AdminLogin />} />
        <Route path="*" element={!ready ? <PageLoader /> : user ? <Shell /> : <ToLogin />} />
      </Routes>
    </AdminCtx.Provider>
  );
}

function ToLogin() {
  const { pathname, search } = useLocation();
  return <Navigate to={`/admin/login?next=${encodeURIComponent(pathname + search)}`} replace />;
}

const SuperOnly = ({ children }) => (useAdmin().user.role === 'super_admin' ? children : <Navigate to="/admin/dashboard" replace />);

function Shell() {
  const { user, logout } = useAdmin();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  useSeo({ title: 'Admin', noindex: true });
  useEffect(() => setOpen(false), [pathname]);

  if (pathname.match(/^\/admin\/orders\/\d+\/invoice$/)) {
    return <Routes><Route path="orders/:id/invoice" element={<Invoice />} /></Routes>;
  }

  return (
    <div className="min-h-dvh bg-ink lg:flex">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-panel transition-transform lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-16 items-center justify-between border-b border-line px-5">
          <Link to="/admin/dashboard" className="display text-2xl">BAKA<span className="text-neon">CHIKI</span> <span className="label align-middle text-mute">Admin</span></Link>
          <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X /></button>
        </div>
        <nav aria-label="Admin" className="min-h-0 flex-1 overflow-y-auto p-3">
          <ul className="space-y-1">
            {NAV.filter(([, , , role]) => !role || role === user.role).map(([to, label, Icon]) => (
              <li key={to}>
                <NavLink to={to} className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 text-sm transition ${isActive ? 'bg-neon text-ink font-bold' : 'text-paper/80 hover:bg-ink'}`}>
                  <Icon size={17} />{label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="space-y-1 border-t border-line p-3 text-sm">
          <Link to="/" className="flex items-center gap-3 px-3 py-2 text-mute hover:text-neon"><ExternalLink size={16} />View store</Link>
          <Link to="/admin/password" className="flex items-center gap-3 px-3 py-2 text-mute hover:text-neon"><KeyRound size={16} />Change password</Link>
          <button onClick={() => { logout(); navigate('/admin/login', { replace: true }); }} className="flex w-full items-center gap-3 px-3 py-2 text-mute hover:text-danger"><LogOut size={16} />Log out</button>
          <p className="truncate px-3 pt-1 text-xs text-mute">{user.email} · <span className="text-neon">{user.role === 'super_admin' ? 'Super admin' : 'Admin'}</span></p>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-ink/90 px-4 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="grid size-10 place-items-center"><Menu /></button>
          <span className="display text-xl">Admin</span>
        </header>
        <main id="main" className="mx-auto max-w-7xl p-4 sm:p-8">
          <Routes>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="products" element={<ProductList />} />
            <Route path="products/new" element={<ProductEdit />} />
            <Route path="products/:id" element={<ProductEdit />} />
            <Route path="orders" element={<OrderList />} />
            <Route path="orders/:id" element={<OrderDetail />} />
            <Route path="customers" element={<CustomerList />} />
            <Route path="customers/:id" element={<CustomerDetail />} />
            <Route path="coupons" element={<Coupons />} />
            <Route path="catalog" element={<Catalog />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="settings" element={<Content />} />
            <Route path="staff" element={<SuperOnly><Staff /></SuperOnly>} />
            <Route path="password" element={<MyPassword />} />
            <Route path="reviews" element={<Reviews />} />
            <Route path="*" element={<p className="text-mute">Not found. <Link to="/admin/dashboard" className="text-neon">Back to dashboard</Link></p>} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

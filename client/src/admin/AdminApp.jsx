import { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Shirt, ShoppingCart, Users, TicketPercent, FolderTree, FileText, MessageSquare, LogOut, Menu, X, ExternalLink } from 'lucide-react';
import { useAuth } from '../context/store.jsx';
import { useSeo } from '../lib/seo.js';
import Dashboard from './Dashboard.jsx';
import { ProductList, ProductEdit } from './Products.jsx';
import { OrderList, OrderDetail, Invoice } from './Orders.jsx';
import { CustomerList, CustomerDetail } from './Customers.jsx';
import Coupons from './Coupons.jsx';
import Catalog from './Catalog.jsx';
import Content from './Content.jsx';
import Reviews from './Reviews.jsx';

const NAV = [
  ['/admin', 'Dashboard', LayoutDashboard], ['/admin/products', 'Products', Shirt], ['/admin/orders', 'Orders', ShoppingCart],
  ['/admin/customers', 'Customers', Users], ['/admin/coupons', 'Coupons', TicketPercent], ['/admin/catalog', 'Categories & collections', FolderTree],
  ['/admin/content', 'Website content', FileText], ['/admin/reviews', 'Reviews', MessageSquare],
];

export default function AdminApp() {
  const { user, logout } = useAuth();
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
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-line bg-panel transition-transform lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-16 items-center justify-between border-b border-line px-5">
          <Link to="/admin" className="display text-2xl">BAKA<span className="text-neon">CHIKI</span> <span className="label align-middle text-mute">Admin</span></Link>
          <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X /></button>
        </div>
        <nav aria-label="Admin" className="p-3">
          <ul className="space-y-1">
            {NAV.map(([to, label, Icon]) => (
              <li key={to}>
                <NavLink end={to === '/admin'} to={to} className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 text-sm transition ${isActive ? 'bg-neon text-ink font-bold' : 'text-paper/80 hover:bg-ink'}`}>
                  <Icon size={17} />{label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="absolute inset-x-0 bottom-0 space-y-1 border-t border-line p-3 text-sm">
          <Link to="/" className="flex items-center gap-3 px-3 py-2 text-mute hover:text-neon"><ExternalLink size={16} />View store</Link>
          <button onClick={() => { logout(); navigate('/'); }} className="flex w-full items-center gap-3 px-3 py-2 text-mute hover:text-danger"><LogOut size={16} />Log out</button>
          <p className="truncate px-3 pt-1 text-xs text-mute">{user.email}</p>
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
            <Route index element={<Dashboard />} />
            <Route path="products" element={<ProductList />} />
            <Route path="products/new" element={<ProductEdit />} />
            <Route path="products/:id" element={<ProductEdit />} />
            <Route path="orders" element={<OrderList />} />
            <Route path="orders/:id" element={<OrderDetail />} />
            <Route path="customers" element={<CustomerList />} />
            <Route path="customers/:id" element={<CustomerDetail />} />
            <Route path="coupons" element={<Coupons />} />
            <Route path="catalog" element={<Catalog />} />
            <Route path="content" element={<Content />} />
            <Route path="reviews" element={<Reviews />} />
            <Route path="*" element={<p className="text-mute">Not found. <Link to="/admin" className="text-neon">Back to dashboard</Link></p>} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

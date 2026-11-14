import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, User, Heart, ShoppingBag, Menu, X, ArrowUpRight } from 'lucide-react';
import { useAuth, useCart, useSettings, useUi } from '../context/store.jsx';
import { api, asset, inr } from '../lib/api.js';

const NAV = [
  { to: '/', label: 'Home', hindi: 'बाकाचिकी' },
  { to: '/shop', label: 'Shop', hindi: 'बाकाचिकी' },
  { to: '/new-drops', label: 'New Drops', hindi: 'बाकाचिकी' },
  { to: '/collections', label: 'Collections', hindi: 'बाकाचिकी' },
  { to: '/about', label: 'About', hindi: 'बाकाचिकी' },
];

export const Logo = ({ className = '' }) => (
  <span className={`display inline-flex items-baseline gap-1 text-[1.65rem] leading-none tracking-tight ${className}`}>
    BAKA<span className="text-neon">CHIKI</span>
  </span>
);

function SearchOverlay({ open, onClose }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const input = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return undefined;
    setTimeout(() => input.current?.focus(), 50);
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return undefined; }
    setLoading(true);
    const t = setTimeout(() => {
      api.get('/products', { params: { q: q.trim(), limit: 6 } })
        .then(({ data }) => setResults(data.products))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const submit = (e) => { e.preventDefault(); if (q.trim()) { navigate(`/shop?q=${encodeURIComponent(q.trim())}`); onClose(); } };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80] bg-ink/97 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-label="Search">
          <div className="mx-auto flex h-full max-w-5xl flex-col px-4 pt-6 sm:px-8 sm:pt-10">
            <div className="flex justify-end">
              <button onClick={onClose} aria-label="Close search" className="grid size-11 place-items-center border border-line hover:border-neon hover:text-neon"><X /></button>
            </div>
            <form onSubmit={submit} className="mt-6 border-b-2 border-neon">
              <label htmlFor="site-search" className="label text-mute">Search the drop</label>
              <input id="site-search" ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="TYPE IT LOUD…" autoComplete="off"
                className="display w-full bg-transparent py-3 text-5xl text-paper outline-none placeholder:text-line sm:text-7xl" />
            </form>
            <div className="mt-8 flex-1 overflow-y-auto pb-10">
              {loading && <p className="label text-mute">Searching…</p>}
              {!loading && q.trim().length >= 2 && !results.length && <p className="text-mute">Nothing matches “{q}”. Try “tee” or “black”.</p>}
              <ul className="grid gap-3 sm:grid-cols-2">
                {results.map((p) => (
                  <li key={p.id}>
                    <Link to={`/product/${p.slug}`} onClick={onClose} className="group flex items-center gap-4 border border-line p-3 transition hover:border-neon">
                      <img src={asset(p.image)} alt="" className="size-20 bg-panel object-cover" loading="lazy" />
                      <span className="flex-1">
                        <span className="block font-bold group-hover:text-neon">{p.name}</span>
                        <span className="text-sm text-mute">{inr(p.sale_price)}</span>
                      </span>
                      <ArrowUpRight className="text-mute group-hover:text-neon" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function Header() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { count } = useCart();
  const { bagRef, bagBump } = useUi();
  const { settings } = useSettings();
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => { setMenu(false); setSearch(false); }, [pathname]);
  useEffect(() => { document.body.style.overflow = menu ? 'hidden' : ''; }, [menu]);

  const overHero = pathname === '/' && !scrolled && !menu;
  const announcement = settings?.announcement;

  return (
    <>
      <a href="#main" className="sr-only z-[90] bg-neon px-4 py-2 text-ink focus:not-sr-only focus:fixed focus:left-2 focus:top-2">Skip to content</a>
      <header className={`fixed inset-x-0 top-0 z-50 transition-[background,border-color,backdrop-filter] duration-500 ${overHero ? 'border-b border-transparent bg-transparent' : 'border-b border-line bg-ink/85 backdrop-blur-lg'}`}>
        <AnimatePresence initial={false}>
          {announcement?.enabled && !scrolled && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden bg-neon text-ink">
              <p className="truncate px-4 py-1.5 text-center text-[0.68rem] font-bold tracking-[0.2em]">{announcement.text}</p>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-4 px-4 sm:px-6 lg:h-20 lg:px-10">
          <button className="grid size-11 place-items-center lg:hidden" onClick={() => setMenu((m) => !m)} aria-label={menu ? 'Close menu' : 'Open menu'} aria-expanded={menu}>
            {menu ? <X /> : <Menu />}
          </button>
          <Link to="/" aria-label="BAKACHIKI home" className="lg:mr-6"><Logo /></Link>
          <nav aria-label="Main" className="hidden flex-1 items-center gap-1 lg:flex">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `group relative px-3 py-2 text-[0.78rem] font-bold uppercase tracking-[0.16em] ${isActive ? 'text-neon' : 'text-paper/80 hover:text-paper'}`}>
                {({ isActive }) => (
                  <>
                    <span className="relative block overflow-hidden">
                      <span className="block transition-transform duration-300 group-hover:-translate-y-full">{n.label}</span>
                      <span className="hindi absolute inset-0 translate-y-full text-base text-neon transition-transform duration-300 group-hover:translate-y-0">{n.hindi}</span>
                    </span>
                    {isActive && <motion.span layoutId="nav-dot" className="absolute -bottom-0.5 left-3 right-3 h-0.5 bg-neon" />}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
            <IconBtn label="Search" onClick={() => setSearch(true)}><Search size={20} /></IconBtn>
            <IconBtn label={user ? 'My account' : 'Log in'} to={user ? '/account' : '/login'} className="hidden xs:grid"><User size={20} /></IconBtn>
            <IconBtn label="Wishlist" to="/account/wishlist" className="hidden sm:grid"><Heart size={20} /></IconBtn>
            <Link ref={bagRef} to="/cart" aria-label={`Shopping bag, ${count} items`} className="relative grid size-11 place-items-center hover:text-neon">
              <ShoppingBag size={21} />
              <motion.span key={bagBump} initial={{ scale: bagBump ? 1.8 : 1 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 14 }}
                className={`absolute right-0.5 top-1 grid min-w-5 place-items-center rounded-full px-1 text-[0.65rem] font-bold leading-5 ${count ? 'bg-neon text-ink' : 'bg-line text-mute'}`}>
                {count}
              </motion.span>
            </Link>
          </div>
        </div>
      </header>

      {/* Mobile navigation */}
      <AnimatePresence>
        {menu && (
          <motion.div className="fixed inset-0 z-40 bg-ink pt-24 lg:hidden" initial={{ clipPath: 'inset(0 0 100% 0)' }} animate={{ clipPath: 'inset(0 0 0% 0)' }} exit={{ clipPath: 'inset(0 0 100% 0)' }} transition={{ duration: 0.55, ease: [0.7, 0, 0.2, 1] }}>
            <nav aria-label="Mobile" className="flex h-full flex-col px-5 pb-8">
              <ul className="flex-1">
                {NAV.map((n, i) => (
                  <motion.li key={n.to} initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 + i * 0.06 }} className="border-b border-line">
                    <NavLink to={n.to} end={n.to === '/'} className={({ isActive }) => `flex items-baseline justify-between py-4 ${isActive ? 'text-neon' : ''}`}>
                      <span className="display text-5xl">{n.label}</span>
                      <span className="hindi text-2xl text-green">{n.hindi}</span>
                    </NavLink>
                  </motion.li>
                ))}
              </ul>
              <div className="grid grid-cols-2 gap-3">
                <Link to={user ? '/account' : '/login'} className="btn btn-ghost">{user ? 'Account' : 'Log in'}</Link>
                <Link to="/account/wishlist" className="btn btn-ghost">Wishlist</Link>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
      <SearchOverlay open={search} onClose={() => setSearch(false)} />
    </>
  );
}

function IconBtn({ to, onClick, label, children, className = 'grid' }) {
  const cls = `${className} size-11 place-items-center transition hover:text-neon`;
  return to ? <Link to={to} aria-label={label} className={cls}>{children}</Link> : <button onClick={onClick} aria-label={label} className={cls}>{children}</button>;
}

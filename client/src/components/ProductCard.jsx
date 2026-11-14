import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, Eye, Plus } from 'lucide-react';
import { useAuth, useCart, useUi } from '../context/store.jsx';
import { asset } from '../lib/api.js';
import { Price } from './ui.jsx';

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

export default function ProductCard({ product: p, index = 0 }) {
  const { wishIds, toggleWishlist } = useAuth();
  const { add } = useCart();
  const { openQuickView, toast } = useUi();
  const [busy, setBusy] = useState(null);
  const imgRef = useRef(null);
  const color = p.colors?.[0]?.name;
  const sizes = SIZE_ORDER.map((s) => p.variants?.find((v) => v.size === s && v.color === color)).filter(Boolean);
  const wished = wishIds.has(p.id);

  const quickAdd = async (v) => {
    setBusy(v.id);
    try { await add(v.id, 1, { image: p.image, fromEl: imgRef.current }); } catch (e) { toast(e.message, 'error'); } finally { setBusy(null); }
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-5% 0px' }}
      transition={{ duration: 0.7, delay: (index % 4) * 0.08, ease: [0.2, 0.9, 0.1, 1] }}
      className="group relative flex flex-col"
    >
      <div className="relative overflow-hidden border border-line bg-panel transition-[border-color,box-shadow] duration-500 group-hover:border-neon group-hover:shadow-[0_0_40px_-12px_rgba(57,211,83,.55)]">
        <Link to={`/product/${p.slug}`} aria-label={p.name} className="block aspect-[5/6]">
          <img ref={imgRef} src={asset(p.image)} alt={p.name} loading="lazy" decoding="async"
            className="absolute inset-0 size-full object-cover transition duration-700 ease-out group-hover:scale-[1.04] group-hover:opacity-0" />
          {p.hover_image && (
            <img src={asset(p.hover_image)} alt="" aria-hidden="true" loading="lazy" decoding="async"
              className="absolute inset-0 size-full scale-110 object-cover opacity-0 transition duration-700 ease-out group-hover:scale-100 group-hover:opacity-100" />
          )}
        </Link>

        <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-2">
          {p.is_new_arrival && <span className="sticker">NEW DROP</span>}
          {p.is_best_seller && <span className="sticker !rotate-2 !bg-paper">BEST SELLER</span>}
          {!p.in_stock && <span className="sticker !rotate-0 !bg-danger !text-paper">SOLD OUT</span>}
        </div>

        <div className="absolute right-3 top-3 flex flex-col gap-2">
          <button onClick={() => toggleWishlist(p.id)} aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'} aria-pressed={wished}
            className="grid size-10 place-items-center border border-line bg-ink/70 backdrop-blur transition hover:border-neon">
            <Heart size={17} className={wished ? 'fill-neon text-neon' : ''} />
          </button>
          <button onClick={() => openQuickView(p.slug)} aria-label={`Quick view ${p.name}`}
            className="grid size-10 place-items-center border border-line bg-ink/70 backdrop-blur transition hover:border-neon lg:translate-x-14 lg:group-hover:translate-x-0 lg:group-focus-within:translate-x-0">
            <Eye size={17} />
          </button>
        </div>

        {/* Quick add: slides up on hover (desktop), always visible on touch below the card */}
        {p.in_stock && sizes.length > 0 && (
          <div className="absolute inset-x-0 bottom-0 hidden translate-y-full bg-ink/90 p-3 backdrop-blur transition-transform duration-500 ease-[var(--ease-snap)] group-hover:translate-y-0 group-focus-within:translate-y-0 lg:block">
            <p className="label mb-2 flex items-center gap-1 text-neon"><Plus size={12} /> Quick add</p>
            <div className="flex flex-wrap gap-1.5">
              {sizes.map((v) => (
                <button key={v.id} disabled={v.stock < 1 || busy} onClick={() => quickAdd(v)}
                  className="min-w-10 border border-line px-2 py-1.5 text-xs font-bold transition hover:border-neon hover:bg-neon hover:text-ink disabled:opacity-30 disabled:line-through">
                  {busy === v.id ? '…' : v.size}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold uppercase tracking-wide"><Link to={`/product/${p.slug}`} className="hover:text-neon">{p.name}</Link></h3>
          <Price price={p.price} sale={p.sale_price} className="mt-1 text-sm" />
        </div>
        <ul className="flex shrink-0 gap-1 pt-1" aria-label="Available colours">
          {p.colors?.map((c) => <li key={c.name} title={c.name} className="size-4 rounded-full border border-line" style={{ background: c.hex }}><span className="sr-only">{c.name}</span></li>)}
        </ul>
      </div>
      {p.in_stock && (
        <button onClick={() => openQuickView(p.slug)} className="mt-3 border border-line py-2.5 text-[0.7rem] font-bold uppercase tracking-[0.18em] transition hover:border-neon hover:text-neon lg:hidden">
          Quick add
        </button>
      )}
    </motion.article>
  );
}

export const ProductGridSkeleton = ({ n = 8 }) => (
  <div className="grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-5 lg:grid-cols-4">
    {Array.from({ length: n }, (_, i) => (
      <div key={i} className="animate-pulse">
        <div className="aspect-[5/6] border border-line bg-panel" />
        <div className="mt-3 h-4 w-3/4 bg-panel" />
        <div className="mt-2 h-4 w-1/3 bg-panel" />
      </div>
    ))}
  </div>
);

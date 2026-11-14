import { useEffect, useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, Ruler, Minus, Plus, Zap } from 'lucide-react';
import { useAuth, useCart, useSettings, useUi } from '../context/store.jsx';
import { Modal } from './ui.jsx';

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

export function useVariantPicker(product) {
  const colors = product?.colors || [];
  const [color, setColor] = useState(colors.find((c) => c.in_stock)?.name || colors[0]?.name);
  const [size, setSize] = useState(null);
  useEffect(() => { setColor(colors.find((c) => c.in_stock)?.name || colors[0]?.name); setSize(null); }, [product?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const variants = product?.variants || [];
  const bySize = useMemo(() => Object.fromEntries(variants.filter((v) => v.color === color).map((v) => [v.size, v])), [variants, color]);
  const variant = size ? bySize[size] : null;
  return { color, setColor: (c) => { setColor(c); setSize(null); }, size, setSize, bySize, variant };
}

export function SizeGuide({ open, onClose }) {
  const { settings } = useSettings();
  const guide = settings?.size_guide;
  return (
    <Modal open={open} onClose={onClose} title="Size guide">
      <p className="mb-4 text-sm text-mute">{guide?.note}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b border-line text-mute">{['Size', 'Chest', 'Length', 'Shoulder'].map((h) => <th key={h} className="label py-3 pr-4">{h}</th>)}</tr></thead>
          <tbody>
            {guide?.rows?.map((r) => (
              <tr key={r.size} className="border-b border-line/60">
                <td className="display py-3 pr-4 text-lg text-neon">{r.size}</td><td className="py-3 pr-4">{r.chest}″</td><td className="py-3 pr-4">{r.length}″</td><td className="py-3">{r.shoulder}″</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-mute">Fit: oversized, drop shoulder. Between sizes? Take your usual size for the intended baggy look.</p>
    </Modal>
  );
}

export function SizeSelector({ bySize, size, onChange, error }) {
  const id = useId();
  return (
    <fieldset>
      <legend className="sr-only">Size</legend>
      <div className="grid grid-cols-6 gap-1.5" role="radiogroup" aria-describedby={error ? `${id}-err` : undefined}>
        {SIZES.map((s) => {
          const v = bySize[s];
          const out = !v || v.stock < 1;
          const active = size === s;
          return (
            <button key={s} type="button" role="radio" aria-checked={active} disabled={out} onClick={() => onChange(s)}
              aria-label={`${s}${out ? ', sold out' : v.stock <= 5 ? `, only ${v.stock} left` : ''}`}
              className={`relative h-12 border text-sm font-bold transition ${out ? 'cursor-not-allowed border-line/50 text-line line-through' : active ? 'border-neon text-ink' : 'border-line hover:border-paper'}`}>
              {active && <motion.span layoutId={`size-${id}`} className="absolute inset-0 bg-neon" transition={{ type: 'spring', stiffness: 520, damping: 34 }} />}
              <span className="relative">{s}</span>
              {!out && v.stock <= 5 && <span className="absolute -top-1.5 right-1 size-2 rounded-full bg-warn" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      {error && <p id={`${id}-err`} className="mt-2 text-sm text-danger" role="alert">{error}</p>}
    </fieldset>
  );
}

/** Colour + size + quantity + actions. `imageEl` is the element the fly-to-bag animation starts from. */
export default function PurchasePanel({ product, picker, getImageEl, compact = false, onAdded }) {
  const { add } = useCart();
  const { wishIds, toggleWishlist } = useAuth();
  const { toast } = useUi();
  const navigate = useNavigate();
  const [qty, setQty] = useState(1);
  const [guide, setGuide] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const { color, setColor, size, setSize, bySize, variant } = picker;
  const inStock = product.variants.some((v) => v.stock > 0);
  const lowStock = variant && variant.stock <= 5;

  useEffect(() => { setQty(1); setError(''); }, [variant?.id]);

  const image = product.images.find((i) => i.kind === 'front' && i.color === color)?.url || product.images.find((i) => i.kind === 'front')?.url;

  const submit = async (buyNow) => {
    if (!variant) { setError('Pick a size first'); return; }
    setBusy(buyNow ? 'buy' : 'add');
    try {
      await add(variant.id, qty, { image, fromEl: getImageEl?.() });
      onAdded?.();
      if (buyNow) navigate('/checkout');
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(null); }
  };

  return (
    <div className="space-y-6">
      {product.colors.length > 0 && (
        <div>
          <p className="label mb-3 text-mute">Colour — <span className="text-paper">{color}</span></p>
          <div className="flex gap-2" role="radiogroup" aria-label="Colour">
            {product.colors.map((c) => (
              <button key={c.name} type="button" role="radio" aria-checked={color === c.name} aria-label={`${c.name}${c.in_stock ? '' : ', sold out'}`} onClick={() => setColor(c.name)}
                className={`relative size-11 rounded-full border-2 p-0.5 transition ${color === c.name ? 'border-neon' : 'border-line hover:border-mute'}`}>
                <span className="block size-full rounded-full" style={{ background: c.hex }} />
                {!c.in_stock && <span className="absolute left-1/2 top-1/2 h-0.5 w-12 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-danger" />}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="label text-mute">Size {size && <>— <span className="text-paper">{size}</span></>}</p>
          <button type="button" onClick={() => setGuide(true)} className="label inline-flex items-center gap-1.5 text-neon underline-offset-4 hover:underline"><Ruler size={14} />Size guide</button>
        </div>
        <SizeSelector bySize={bySize} size={size} onChange={(s) => { setSize(s); setError(''); }} error={error} />
        {lowStock && <p className="mt-2 text-sm text-warn">Only {variant.stock} left in {variant.size} — move fast.</p>}
      </div>

      {!compact && (
        <div className="flex items-center gap-4">
          <p className="label text-mute">Qty</p>
          <div className="flex items-center border border-line">
            <button type="button" aria-label="Decrease quantity" className="grid size-11 place-items-center hover:text-neon disabled:opacity-30" disabled={qty <= 1} onClick={() => setQty((q) => q - 1)}><Minus size={16} /></button>
            <span className="w-10 text-center font-bold" aria-live="polite">{qty}</span>
            <button type="button" aria-label="Increase quantity" className="grid size-11 place-items-center hover:text-neon disabled:opacity-30" disabled={qty >= Math.min(10, variant?.stock || 10)} onClick={() => setQty((q) => q + 1)}><Plus size={16} /></button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button type="button" disabled={!inStock || busy} onClick={() => submit(false)} className="btn btn-solid flex-1">
          {!inStock ? 'Sold out' : busy === 'add' ? 'Adding…' : 'Add to bag'}
        </button>
        <button type="button" onClick={() => toggleWishlist(product.id)} aria-label={wishIds.has(product.id) ? 'Remove from wishlist' : 'Add to wishlist'} aria-pressed={wishIds.has(product.id)}
          className="grid size-12 shrink-0 place-items-center border border-line transition hover:border-neon">
          <Heart size={20} className={wishIds.has(product.id) ? 'fill-neon text-neon' : ''} />
        </button>
      </div>
      {inStock && (
        <button type="button" disabled={Boolean(busy)} onClick={() => submit(true)} className="btn btn-ghost w-full">
          <Zap size={16} />{busy === 'buy' ? 'One sec…' : 'Buy now'}
        </button>
      )}
      <SizeGuide open={guide} onClose={() => setGuide(false)} />
    </div>
  );
}

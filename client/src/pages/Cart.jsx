import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Minus, Plus, Trash2, Tag, ArrowRight, AlertTriangle } from 'lucide-react';
import { useCart, useUi } from '../context/store.jsx';
import { asset, inr } from '../lib/api.js';
import { useSeo } from '../lib/seo.js';
import { Page, Empty, MaskText, Spinner } from '../components/ui.jsx';

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const getCoupon = () => { try { return sessionStorage.getItem('bk_coupon') || ''; } catch { return ''; } };
const setCoupon = (c) => { try { c ? sessionStorage.setItem('bk_coupon', c) : sessionStorage.removeItem('bk_coupon'); } catch { /* ignore */ } };

export function Summary({ cart, children }) {
  const t = cart.totals;
  return (
    <dl className="space-y-3 text-sm">
      <Row k={`Subtotal (${t.count} item${t.count === 1 ? '' : 's'})`} v={inr(t.subtotal)} />
      {t.discount > 0 && <Row k={`Discount${cart.coupon ? ` · ${cart.coupon.code}` : ''}`} v={`− ${inr(t.discount)}`} accent />}
      <Row k="Shipping" v={t.shipping ? inr(t.shipping) : 'FREE'} accent={!t.shipping} />
      {children}
      <div className="flex items-baseline justify-between border-t border-line pt-4">
        <dt className="label">Total</dt><dd className="display text-4xl">{inr(t.total)}</dd>
      </div>
    </dl>
  );
}
const Row = ({ k, v, accent }) => <div className="flex justify-between gap-4"><dt className="text-mute">{k}</dt><dd className={accent ? 'font-bold text-neon' : ''}>{v}</dd></div>;

export default function Cart() {
  const { cart, cartLoading, refreshCart, update, remove } = useCart();
  const { toast } = useUi();
  const navigate = useNavigate();
  const [code, setCode] = useState(getCoupon());
  const [busy, setBusy] = useState(null);
  useSeo({ title: 'Your bag', noindex: true });

  useEffect(() => { refreshCart(getCoupon()); }, [refreshCart]);

  const act = async (id, fn) => {
    setBusy(id);
    try { await fn(); await refreshCart(getCoupon()); } catch (e) { toast(e.message, 'error'); } finally { setBusy(null); }
  };
  const applyCoupon = async (e) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    setCoupon(c);
    const res = await refreshCart(c);
    if (res.coupon_error) { toast(res.coupon_error, 'error'); setCoupon(''); } else if (c) toast(`${c} applied`);
  };
  const removeCoupon = () => { setCoupon(''); setCode(''); refreshCart(); };

  const t = cart.totals;
  const unavailable = cart.items.some((i) => !i.available);
  const threshold = t.free_shipping_remaining + (t.subtotal - t.discount);
  const progress = threshold ? Math.min(100, ((t.subtotal - t.discount) / threshold) * 100) : 100;

  return (
    <Page className="mx-auto max-w-[1600px] px-4 pt-28 sm:px-8 lg:px-10 lg:pt-32">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <MaskText as="h1" lines={['Your Bag']} className="display text-6xl sm:text-8xl" inView={false} />
        <p className="hindi text-5xl text-green" aria-hidden="true">बाकाचिकी</p>
      </div>

      {!cart.items.length ? (
        <div className="mt-10">{cartLoading ? <div className="grid h-60 place-items-center"><Spinner /></div> : (
          <Empty title="Your bag is empty" hindi="बाकाचिकी" action={<Link to="/shop" className="btn btn-solid">Start shopping<ArrowRight size={16} /></Link>}>Fill it with something loud.</Empty>
        )}</div>
      ) : (
        <div className="mt-8 grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-8">
            {t.free_shipping_remaining > 0 ? (
              <div className="mb-6 border border-line p-4">
                <p className="text-sm">Add <b className="text-neon">{inr(t.free_shipping_remaining)}</b> more for free shipping</p>
                <div className="mt-3 h-1.5 bg-line"><motion.div className="h-full bg-neon" initial={{ width: 0 }} animate={{ width: `${progress}%` }} /></div>
              </div>
            ) : <p className="label mb-6 border border-neon/40 p-4 text-neon">✦ You’ve unlocked free shipping</p>}

            <ul className="divide-y divide-line border-y border-line">
              <AnimatePresence initial={false}>
                {cart.items.map((item) => {
                  const colors = [...new Map(item.options.map((o) => [o.color, o])).values()];
                  const sizes = SIZE_ORDER.map((s) => item.options.find((o) => o.color === item.color && o.size === s)).filter(Boolean);
                  return (
                    <motion.li key={item.id} layout exit={{ opacity: 0, x: -40, height: 0 }} className={`flex gap-4 py-5 ${busy === item.id ? 'opacity-50' : ''}`}>
                      <Link to={`/product/${item.product.slug}`} className="w-24 shrink-0 sm:w-32">
                        <img src={asset(item.product.image)} alt={item.product.name} className="aspect-[5/6] w-full border border-line bg-panel object-cover" loading="lazy" />
                      </Link>
                      <div className="flex min-w-0 flex-1 flex-col gap-3">
                        <div className="flex justify-between gap-3">
                          <Link to={`/product/${item.product.slug}`} className="font-bold uppercase leading-tight hover:text-neon">{item.product.name}</Link>
                          <p className="shrink-0 font-bold">{inr(item.unit_price * item.quantity)}</p>
                        </div>
                        {!item.available && <p className="flex items-center gap-2 text-sm text-danger"><AlertTriangle size={14} />{item.stock ? `Only ${item.stock} left — reduce quantity` : 'Sold out — remove to continue'}</p>}
                        <div className="flex flex-wrap items-center gap-2">
                          {colors.length > 1 ? (
                            <select aria-label="Colour" value={item.color} disabled={busy === item.id} className="field h-10 min-h-0 w-auto py-0 text-sm"
                              onChange={(e) => {
                                const v = item.options.find((o) => o.color === e.target.value && o.size === item.size && o.stock > 0) || item.options.find((o) => o.color === e.target.value && o.stock > 0);
                                if (v) act(item.id, () => update(item.id, { variant_id: v.id })); else toast('That colour is sold out', 'error');
                              }}>
                              {colors.map((c) => <option key={c.color} value={c.color}>{c.color}</option>)}
                            </select>
                          ) : <span className="chip"><span className="size-3 rounded-full" style={{ background: item.color_hex }} />{item.color}</span>}
                          <select aria-label="Size" value={item.variant_id} disabled={busy === item.id} className="field h-10 min-h-0 w-auto py-0 text-sm"
                            onChange={(e) => act(item.id, () => update(item.id, { variant_id: Number(e.target.value) }))}>
                            {sizes.map((o) => <option key={o.id} value={o.id} disabled={o.stock < 1 && o.id !== item.variant_id}>{o.size}{o.stock < 1 ? ' (sold out)' : ''}</option>)}
                          </select>
                        </div>
                        <div className="mt-auto flex items-center justify-between">
                          <div className="flex items-center border border-line">
                            <button aria-label="Decrease quantity" disabled={item.quantity <= 1 || busy} onClick={() => act(item.id, () => update(item.id, { quantity: item.quantity - 1 }))} className="grid size-10 place-items-center hover:text-neon disabled:opacity-30"><Minus size={14} /></button>
                            <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                            <button aria-label="Increase quantity" disabled={item.quantity >= Math.min(10, item.stock) || busy} onClick={() => act(item.id, () => update(item.id, { quantity: item.quantity + 1 }))} className="grid size-10 place-items-center hover:text-neon disabled:opacity-30"><Plus size={14} /></button>
                          </div>
                          <button onClick={() => act(item.id, () => remove(item.id))} className="label inline-flex items-center gap-1.5 text-mute hover:text-danger"><Trash2 size={14} />Remove</button>
                        </div>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          </div>

          <aside className="lg:col-span-4">
            <div className="sticky top-28 space-y-6 border border-line bg-panel p-6">
              <h2 className="display text-3xl">Summary</h2>
              {cart.coupon ? (
                <div className="flex items-center justify-between border border-neon/50 p-3 text-sm">
                  <span className="flex items-center gap-2 text-neon"><Tag size={14} />{cart.coupon.code}</span>
                  <button onClick={removeCoupon} className="label text-mute hover:text-paper">Remove</button>
                </div>
              ) : (
                <form onSubmit={applyCoupon} className="flex gap-2">
                  <label htmlFor="coupon" className="sr-only">Coupon code</label>
                  <input id="coupon" className="field h-11 min-h-0 uppercase" placeholder="Coupon code" value={code} onChange={(e) => setCode(e.target.value)} />
                  <button className="btn btn-ghost min-h-11 px-4">Apply</button>
                </form>
              )}
              <Summary cart={cart} />
              <button onClick={() => navigate('/checkout')} disabled={unavailable} className="btn btn-solid w-full">Checkout<ArrowRight size={16} /></button>
              {unavailable && <p className="text-sm text-danger">Fix the highlighted items to continue.</p>}
              <Link to="/shop" className="label block text-center text-mute hover:text-neon">Continue shopping</Link>
            </div>
          </aside>
        </div>
      )}
    </Page>
  );
}

export { getCoupon, setCoupon };

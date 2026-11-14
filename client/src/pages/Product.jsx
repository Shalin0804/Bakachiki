import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Truck, RotateCcw, ShieldCheck } from 'lucide-react';
import { api, asset, inr, formatDate } from '../lib/api.js';
import { useSeo } from '../lib/seo.js';
import { useAuth, useCart, useSettings, useUi } from '../context/store.jsx';
import { Page, Price, Stars, PageLoader, Empty, Field, Reveal, MaskText } from '../components/ui.jsx';
import ProductViewer from '../components/ProductViewer.jsx';
import PurchasePanel, { useVariantPicker } from '../components/PurchasePanel.jsx';
import ProductCard from '../components/ProductCard.jsx';

export default function Product() {
  const { slug } = useParams();
  const [product, setProduct] = useState(null);
  const [error, setError] = useState(null);
  const picker = useVariantPicker(product);
  const { settings } = useSettings();
  const { add } = useCart();
  const { toast } = useUi();
  const stageRef = useRef(null);
  const panelRef = useRef(null);
  const [showSticky, setShowSticky] = useState(false);

  useEffect(() => {
    setProduct(null); setError(null);
    api.get(`/products/${slug}`).then(({ data }) => setProduct(data.product)).catch((e) => setError(e));
  }, [slug]);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([e]) => setShowSticky(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [product]);

  const front = product?.images.find((i) => i.kind === 'front' && i.color === picker.color) || product?.images[0];
  useSeo(product ? {
    title: product.meta_title?.replace(/\s*\|\s*BAKACHIKI$/, '') || product.name,
    description: product.meta_description || product.description?.slice(0, 160),
    image: asset(front?.url),
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      sku: product.sku,
      description: product.description,
      image: product.images.filter((i) => i.kind !== 'video' && i.kind !== 'frame').map((i) => new URL(asset(i.url), window.location.origin).href),
      brand: { '@type': 'Brand', name: 'BAKACHIKI' },
      material: product.fabric,
      color: product.colors.map((c) => c.name).join(', '),
      ...(product.rating.count ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: product.rating.average, reviewCount: product.rating.count } } : {}),
      offers: {
        '@type': 'Offer', priceCurrency: 'INR', price: product.sale_price, url: window.location.href,
        availability: product.variants.some((v) => v.stock > 0) ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        itemCondition: 'https://schema.org/NewCondition',
      },
    },
  } : { title: error ? 'Product not found' : undefined });

  if (error) return <Page className="px-4 pt-36"><Empty title="Product not found" hindi="बाकाचिकी" action={<Link to="/shop" className="btn btn-solid">Back to shop</Link>}>It may have sold out for good or moved.</Empty></Page>;
  if (!product) return <div className="pt-28"><PageLoader /></div>;

  const specs = [['Fabric', product.fabric], ['GSM', product.gsm], ['Fit', product.fit], ['Print', product.print_type], ['Colours', product.colors.map((c) => c.name).join(', ')], ['Sizes', [...new Set(product.variants.map((v) => v.size))].join(' / ')]].filter(([, v]) => v);
  const stickyAdd = async () => {
    if (!picker.variant) { panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); toast('Pick a size first', 'info'); return; }
    try { await add(picker.variant.id, 1, { image: front?.url, fromEl: stageRef.current }); } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <Page className="pt-20 lg:pt-24">
      <nav aria-label="Breadcrumb" className="mx-auto max-w-[1600px] px-4 py-4 text-xs text-mute sm:px-8 lg:px-10">
        <ol className="flex flex-wrap gap-2">
          <li><Link to="/" className="hover:text-neon">Home</Link> /</li>
          <li><Link to="/shop" className="hover:text-neon">Shop</Link> /</li>
          {product.category && <li><Link to={`/shop/${product.category.slug}`} className="hover:text-neon">{product.category.name}</Link> /</li>}
          <li aria-current="page" className="text-paper">{product.name}</li>
        </ol>
      </nav>

      <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-8 px-4 sm:px-8 lg:grid-cols-12 lg:gap-12 lg:px-10">
        <div ref={stageRef} className="min-w-0 lg:col-span-7">
          <ProductViewer images={product.images} color={picker.color} hotspots={product.hotspots || []} name={product.name} />
        </div>

        <div className="min-w-0 lg:col-span-5">
          <div className="lg:sticky lg:top-28">
            <div className="flex flex-wrap gap-2">
              {product.is_new_arrival && <span className="sticker">NEW DROP</span>}
              {product.is_best_seller && <span className="sticker !rotate-2 !bg-paper">BEST SELLER</span>}
            </div>
            <MaskText as="h1" lines={[product.name]} className="display mt-4 text-5xl sm:text-6xl" inView={false} />
            {product.rating.count > 0 && (
              <a href="#reviews" className="mt-3 inline-flex items-center gap-2 text-sm text-mute hover:text-neon"><Stars value={product.rating.average} />{product.rating.average} · {product.rating.count} review{product.rating.count > 1 ? 's' : ''}</a>
            )}
            <div className="mt-4 flex items-end gap-3">
              <Price price={product.price} sale={product.sale_price} big />
            </div>
            <p className="mt-1 text-xs text-mute">Inclusive of all taxes</p>
            <p className="mt-6 leading-relaxed text-paper/80">{product.description}</p>

            <div ref={panelRef} className="mt-8 border-t border-line pt-8">
              <PurchasePanel product={product} picker={picker} getImageEl={() => stageRef.current} />
            </div>

            <dl className="mt-8 grid grid-cols-2 border-l border-t border-line text-sm sm:grid-cols-3">
              {specs.map(([k, v]) => (
                <div key={k} className="border-b border-r border-line p-3">
                  <dt className="label text-mute">{k}</dt><dd className="mt-1 font-bold">{v}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-6 divide-y divide-line border-y border-line">
              <Accordion title="Shipping" icon={Truck}>
                Flat {inr(settings?.store.shipping_flat)} shipping, free above {inr(settings?.store.free_shipping_threshold)}. {settings?.store.cod_enabled ? 'Cash on Delivery available.' : ''}
              </Accordion>
              <Accordion title="Returns & exchanges" icon={RotateCcw}>
                Easy {settings?.store.return_days}-day returns and size exchanges on unworn pieces with tags. Reach us via the contact page to start one.
              </Accordion>
              <Accordion title="Care" icon={ShieldCheck}>
                Wash inside out in cold water. Don’t iron directly on the puff print. Dry in shade to keep the raised ink crisp.
              </Accordion>
            </div>
          </div>
        </div>
      </div>

      <Reviews product={product} />

      {product.related.length > 0 && (
        <section className="mx-auto mt-28 max-w-[1600px] px-4 sm:px-8 lg:px-10" aria-labelledby="related">
          <h2 id="related" className="display mb-10 border-b border-line pb-6 text-5xl sm:text-7xl">You might <span className="outline-text">also</span> like</h2>
          <div className="grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-5 lg:grid-cols-4">
            {product.related.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
          </div>
        </section>
      )}

      {/* Sticky mobile add-to-bag */}
      <AnimatePresence>
        {showSticky && (
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
            <div className="flex items-center gap-3">
              <img src={asset(front?.url)} alt="" className="size-12 border border-line object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{product.name}</p>
                <p className="text-xs text-mute">{inr(product.sale_price)}{picker.size ? ` · Size ${picker.size}` : ' · Pick a size'}</p>
              </div>
              <button onClick={stickyAdd} className="btn btn-solid min-h-12 px-5">{picker.size ? 'Add' : 'Size'}</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Page>
  );
}

function Accordion({ title, icon: Icon, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between py-4 text-left">
        <span className="label flex items-center gap-3"><Icon size={16} className="text-neon" />{title}</span>
        <ChevronDown size={18} className={`transition ${open ? 'rotate-180 text-neon' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <p className="pb-4 text-sm text-mute">{children}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Reviews({ product }) {
  const { user } = useAuth();
  const { toast } = useUi();
  const [reviews, setReviews] = useState([]);
  const [form, setForm] = useState({ rating: 5, title: '', body: '' });
  const [busy, setBusy] = useState(false);
  const load = () => api.get(`/products/${product.id}/reviews`).then(({ data }) => setReviews(data.reviews)).catch(() => {});
  useEffect(() => { load(); }, [product.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api.post(`/products/${product.id}/reviews`, form); toast('Thanks for the review!'); setForm({ rating: 5, title: '', body: '' }); load(); } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  };

  return (
    <section id="reviews" className="mx-auto mt-28 grid max-w-[1600px] gap-10 px-4 sm:px-8 lg:grid-cols-12 lg:px-10" aria-labelledby="reviews-h">
      <div className="lg:col-span-4">
        <h2 id="reviews-h" className="display text-5xl sm:text-6xl">Reviews</h2>
        <p className="hindi mt-1 text-4xl text-green" aria-hidden="true">बाकाचिकी</p>
        {product.rating.count > 0 && <p className="mt-6 flex items-center gap-3"><span className="display text-6xl text-neon">{product.rating.average}</span><Stars value={product.rating.average} size={18} /></p>}
        {user ? (
          <form onSubmit={submit} className="mt-8 space-y-4">
            <fieldset>
              <legend className="label mb-2 text-mute">Your rating</legend>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setForm({ ...form, rating: n })} aria-label={`${n} star${n > 1 ? 's' : ''}`} aria-pressed={form.rating === n}
                    className={`size-10 border font-bold ${n <= form.rating ? 'border-neon bg-neon text-ink' : 'border-line'}`}>{n}</button>
                ))}
              </div>
            </fieldset>
            <Field label="Headline" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={120} />
            <Field label="Review" as="textarea" rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} maxLength={2000} />
            <button disabled={busy} className="btn btn-ghost w-full">{busy ? 'Posting…' : 'Post review'}</button>
            <p className="text-xs text-mute">Reviews are open to customers who ordered this piece.</p>
          </form>
        ) : <p className="mt-6 text-sm text-mute"><Link to={`/login?next=/product/${product.slug}`} className="text-neon underline">Log in</Link> to review a piece you’ve bought.</p>}
      </div>
      <div className="lg:col-span-8">
        {!reviews.length ? <Empty title="No reviews yet">Be the first to rate this drop.</Empty> : (
          <ul className="divide-y divide-line border-y border-line">
            {reviews.map((r) => (
              <Reveal key={r.id}>
                <li className="py-6">
                  <div className="flex items-center justify-between gap-3"><Stars value={r.rating} /><span className="text-xs text-mute">{formatDate(r.created_at)}</span></div>
                  {r.title && <p className="mt-3 font-bold">{r.title}</p>}
                  {r.body && <p className="mt-2 text-paper/80">{r.body}</p>}
                  <p className="label mt-3 text-mute">— {r.user.name}</p>
                </li>
              </Reveal>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

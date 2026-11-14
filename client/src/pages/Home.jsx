import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useSettings } from '../context/store.jsx';
import { api, asset } from '../lib/api.js';
import { useSeo } from '../lib/seo.js';
import { Page, MaskText, Reveal, Marquee } from '../components/ui.jsx';
import ProductCard, { ProductGridSkeleton } from '../components/ProductCard.jsx';

// Relative luminance → pick readable ink for whatever tee colour is showing.
const isLight = (hex = '#000000') => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55;
};

// Hero: a giant swatch of the actual tee fabric with the back print raised on it. The swatch takes the colour
// of each product in the catalogue (from the API); the puff type tilts toward the cursor like real raised ink.
function Hero({ hero }) {
  const [tees, setTees] = useState([]);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const panel = useRef(null);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rotY = useSpring(useTransform(mx, [0, 1], [-14, 14]), { stiffness: 120, damping: 18 });
  const rotX = useSpring(useTransform(my, [0, 1], [10, -10]), { stiffness: 120, damping: 18 });
  const shine = useTransform([mx, my], ([x, y]) => `radial-gradient(circle at ${x * 100}% ${y * 100}%, rgba(255,255,255,.55), transparent 38%)`);

  useEffect(() => {
    api.get('/products', { params: { limit: 12 } }).then(({ data }) => {
      setTees(data.products.filter((p) => p.colors?.[0]).map((p) => ({ slug: p.slug, name: p.colors[0].name, hex: p.colors[0].hex, image: p.image })));
    }).catch(() => {});
  }, []);
  useEffect(() => {
    if (tees.length < 2 || paused) return undefined;
    const t = setInterval(() => setIdx((i) => (i + 1) % tees.length), 3800);
    return () => clearInterval(t);
  }, [tees.length, paused]);

  const tee = tees[idx] || { hex: '#151815', name: '' };
  const light = isLight(tee.hex);
  const ink = light ? 'text-ink' : 'text-paper';
  const word = hero.hindi || 'बाकाचिकी';

  const onMove = (e) => {
    const r = panel.current.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width);
    my.set((e.clientY - r.top) / r.height);
  };
  const onLeave = () => { mx.set(0.5); my.set(0.5); };

  return (
    <section className="relative isolate flex min-h-[100svh] flex-col bg-ink px-3 pb-3 pt-20 sm:px-4 lg:pt-24" aria-label="Featured drop">
      <h1 className="sr-only">{hero.title || 'BAKACHIKI'} — {hero.subtitle}</h1>
      <motion.div ref={panel} onPointerMove={onMove} onPointerLeave={onLeave}
        animate={{ backgroundColor: tee.hex }} transition={{ duration: 0.9, ease: [0.2, 0.9, 0.1, 1] }}
        className="relative flex flex-1 flex-col overflow-hidden [perspective:1200px]">
        {/* knit texture + soft fold shading so the panel reads as cotton, not a flat colour */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[.18] mix-blend-overlay [background:repeating-linear-gradient(90deg,rgba(255,255,255,.5)_0_1px,transparent_1px_4px),repeating-linear-gradient(0deg,rgba(0,0,0,.6)_0_1px,transparent_1px_3px)]" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_20%_0%,rgba(255,255,255,.14),transparent_55%),radial-gradient(90%_70%_at_100%_100%,rgba(0,0,0,.45),transparent_60%)]" />

        {/* top strip: drop name + colour name, like the tee's own label */}
        <div className={`relative z-10 flex items-start justify-between gap-4 p-4 sm:p-6 ${ink}`}>
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="label inline-flex items-center gap-2">
            <span className="size-2 animate-pulse rounded-full bg-neon" />{hero.eyebrow}
          </motion.p>
          <AnimatePresence mode="wait">
            <motion.p key={tee.name} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="display text-right text-2xl sm:text-4xl">
              {tee.name}<span className="block font-sans text-[0.65rem] font-bold tracking-[0.2em] opacity-70">240 GSM · PUFF PRINT</span>
            </motion.p>
          </AnimatePresence>
        </div>

        {/* the print */}
        <div className="relative z-0 grid flex-1 place-items-center px-2">
          <motion.div style={{ rotateX: rotX, rotateY: rotY, transformStyle: 'preserve-3d' }} className="relative select-none text-center">
            <motion.p aria-hidden="true" initial={{ opacity: 0, scale: 1.25, filter: 'blur(12px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} transition={{ delay: 0.15, duration: 1.1, ease: [0.2, 0.9, 0.1, 1] }}
              className="puff hindi relative whitespace-nowrap text-[21vw] leading-none text-green lg:text-[15vw]" style={{ transform: 'translateZ(60px)' }}>
              {word}
              <motion.span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-clip-text text-transparent mix-blend-soft-light [text-shadow:none] [-webkit-text-stroke:0]" style={{ backgroundImage: shine }}>{word}</motion.span>
            </motion.p>
            <p aria-hidden="true" className={`display mt-1 text-[5vw] tracking-[0.35em] opacity-80 lg:text-[2.6vw] ${ink}`} style={{ transform: 'translateZ(20px)' }}>{hero.title || 'BAKACHIKI'}</p>
          </motion.div>
        </div>

        {/* copy + colour swatches */}
        <div className={`relative z-10 grid items-end gap-6 p-4 sm:p-6 lg:grid-cols-12 ${ink}`}>
          <div className="lg:col-span-5">
            <p className="max-w-sm text-sm opacity-85 sm:text-base">{hero.subtitle}</p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Link to={hero.cta_primary?.href || '/new-drops'} className="btn btn-solid">{hero.cta_primary?.label || 'EXPLORE THE DROP'}<ArrowRight size={16} /></Link>
              <Link to={hero.cta_secondary?.href || '/shop'} className="btn btn-ghost bg-ink/60 text-paper backdrop-blur">{hero.cta_secondary?.label || 'SHOP NOW'}</Link>
            </div>
          </div>
          {tees.length > 0 && (
            <div className="lg:col-span-6 lg:col-start-7" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
              <p className="label mb-3 opacity-70 lg:text-right">Pick a colour · {tees.length} on the rack</p>
              <div role="radiogroup" aria-label="Tee colour" className="flex flex-wrap items-center gap-2 lg:justify-end">
                {tees.map((t, i) => (
                  <button key={t.slug} role="radio" aria-checked={i === idx} aria-label={t.name} onClick={() => { setIdx(i); setPaused(true); }}
                    className={`grid size-11 place-items-center rounded-full border-2 transition ${i === idx ? 'scale-110 border-neon' : light ? 'border-ink/25 hover:border-ink' : 'border-paper/25 hover:border-paper'}`}>
                    <span className="size-7 rounded-full shadow-[inset_0_-3px_6px_rgba(0,0,0,.35)]" style={{ background: t.hex }} />
                  </button>
                ))}
                <Link to={`/product/${tee.slug}`} className="ml-1 inline-flex h-11 items-center gap-3 border border-line bg-ink/80 pl-1 pr-4 text-sm font-bold text-paper backdrop-blur transition hover:border-neon hover:text-neon">
                  {tee.image && <img src={asset(tee.image)} alt="" className="size-9 object-cover" />}Shop {tee.name}<ArrowRight size={15} />
                </Link>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </section>
  );
}

function SectionHead({ index, title, hindi, link, linkLabel }) {
  return (
    <div className="mb-10 flex flex-wrap items-end justify-between gap-6 border-b border-line pb-6">
      <div>
        <p className="label mb-3 text-neon">[{index}]</p>
        <MaskText lines={[title]} className="display text-5xl sm:text-7xl lg:text-8xl" />
      </div>
      <div className="flex items-end gap-6">
        {hindi && <p className="hindi hidden text-5xl text-green sm:block">{hindi}</p>}
        {link && <Link to={link} className="label group inline-flex items-center gap-2 border-b border-neon pb-1 text-neon">{linkLabel}<ArrowRight size={14} className="transition group-hover:translate-x-1" /></Link>}
      </div>
    </div>
  );
}

function ProductRow({ params }) {
  const [products, setProducts] = useState(null);
  useEffect(() => { api.get('/products', { params: { limit: 8, ...params } }).then(({ data }) => setProducts(data.products)).catch(() => setProducts([])); }, [JSON.stringify(params)]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!products) return <ProductGridSkeleton n={4} />;
  if (!products.length) return <p className="text-mute">New pieces are on their way.</p>;
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-5 lg:grid-cols-4">
      {products.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
    </div>
  );
}

export default function Home() {
  const { settings } = useSettings();
  const [collections, setCollections] = useState([]);
  useEffect(() => { api.get('/collections').then(({ data }) => setCollections(data.collections)).catch(() => {}); }, []);
  useSeo({ description: settings?.seo?.description, image: settings?.seo?.og_image });
  if (!settings) return null;
  const { hero, marquee, promo, about } = settings;

  return (
    <Page>
      <Hero hero={hero} />

      <div className="relative z-10 -my-4 -rotate-2 bg-neon py-3 text-ink shadow-[0_0_60px_rgba(57,211,83,.35)]">
        <Marquee items={marquee.items} itemClass="display text-3xl sm:text-4xl" speed={22} />
      </div>

      <section className="mx-auto max-w-[1600px] px-4 pt-28 sm:px-8 lg:px-10" aria-labelledby="drop-heading">
        <h2 id="drop-heading" className="sr-only">The drop</h2>
        <SectionHead index="01" title="The Drop" hindi="बाकाचिकी" link="/new-drops" linkLabel="All new drops" />
        <ProductRow params={{ badge: 'featured' }} />
      </section>

      {promo.enabled && (
        <section className="mx-auto mt-32 grid max-w-[1600px] items-center gap-10 px-4 sm:px-8 lg:grid-cols-12 lg:px-10" aria-label={promo.title}>
          <Reveal className="relative lg:col-span-6">
            <div className="bracket relative aspect-[5/6] overflow-hidden border border-line">
              <motion.img src={asset(promo.image_url)} alt={promo.title} loading="lazy" className="size-full object-cover" initial={{ scale: 1.2 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={{ duration: 1.6, ease: [0.2, 0.9, 0.1, 1] }} />
            </div>
            <span className="sticker absolute -right-2 -top-4 text-lg sm:-right-6">RAISED INK ↑</span>
          </Reveal>
          <div className="lg:col-span-5 lg:col-start-8">
            <p className="label mb-4 text-neon">[02] {promo.eyebrow}</p>
            <MaskText lines={promo.title.split(' ').reduce((acc, w, i) => { if (i % 2) acc[acc.length - 1] += ` ${w}`; else acc.push(w); return acc; }, [])} className="display text-6xl sm:text-8xl" />
            <Reveal delay={0.2}><p className="mt-6 max-w-md text-lg text-paper/80">{promo.body}</p></Reveal>
            <Reveal delay={0.3}>
              <dl className="mt-8 grid grid-cols-3 border border-line">
                {[['240', 'GSM cotton'], ['3D', 'Puff print'], ['DROP', 'Shoulder fit']].map(([k, v]) => (
                  <div key={v} className="border-r border-line p-4 last:border-r-0">
                    <dt className="display text-3xl text-neon sm:text-4xl">{k}</dt><dd className="label mt-1 text-mute">{v}</dd>
                  </div>
                ))}
              </dl>
              <Link to={promo.cta_href || '/shop'} className="btn btn-solid mt-8">{promo.cta_label}<ArrowRight size={16} /></Link>
            </Reveal>
          </div>
        </section>
      )}

      {collections.length > 0 && (
        <section className="mt-32" aria-labelledby="col-heading">
          <div className="mx-auto max-w-[1600px] px-4 sm:px-8 lg:px-10">
            <h2 id="col-heading" className="sr-only">Collections</h2>
            <SectionHead index="03" title="Collections" hindi="बाकाचिकी" link="/collections" linkLabel="View all" />
          </div>
          <div className="scrollbar-none flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:px-8 lg:px-10">
            {collections.map((c, i) => (
              <Link key={c.id} to={`/collections/${c.slug}`} className="group relative block w-[82vw] shrink-0 snap-start overflow-hidden border border-line sm:w-[46vw] lg:w-[38vw]">
                <div className="aspect-[3/2] overflow-hidden bg-panel">
                  {c.image_url && <img src={asset(c.image_url)} alt="" loading="lazy" className="size-full object-cover transition duration-700 group-hover:scale-105" />}
                </div>
                <div className="flex items-end justify-between gap-4 p-5">
                  <div>
                    <p className="font-mono text-xs text-mute">{String(i + 1).padStart(2, '0')}</p>
                    <h3 className="display text-4xl group-hover:text-neon">{c.name}</h3>
                    {c.tagline && <p className="mt-1 text-sm text-mute">{c.tagline}</p>}
                  </div>
                  <span className="grid size-12 shrink-0 place-items-center border border-line transition group-hover:border-neon group-hover:bg-neon group-hover:text-ink"><ArrowRight /></span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto mt-28 max-w-[1600px] px-4 sm:px-8 lg:px-10" aria-labelledby="best-heading">
        <h2 id="best-heading" className="sr-only">Best sellers</h2>
        <SectionHead index="04" title="Best Sellers" hindi="बाकाचिकी" link="/shop?badge=bestseller" linkLabel="Shop best sellers" />
        <ProductRow params={{ sort: 'popular' }} />
      </section>

      <section className="relative mt-32 overflow-hidden border-y border-line bg-panel py-24" aria-label="About BAKACHIKI">
        <p aria-hidden="true" className="hindi pointer-events-none absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap text-[38vw] leading-none text-green/10">{about.hindi}</p>
        <div className="relative mx-auto max-w-5xl px-5 text-center">
          <p className="label text-neon">[05] Manifesto</p>
          <MaskText lines={[about.title]} className="display mt-4 text-5xl sm:text-7xl lg:text-8xl" />
          <Reveal delay={0.2}><p className="mx-auto mt-6 max-w-2xl text-lg text-paper/80">{about.body.split('\n')[0]}</p></Reveal>
          <Link to="/about" className="btn btn-ghost mt-8">Our story<ArrowRight size={16} /></Link>
        </div>
      </section>
    </Page>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useSettings } from '../context/store.jsx';
import { api, asset } from '../lib/api.js';
import { useSeo } from '../lib/seo.js';
import { Page, MaskText, Reveal, Marquee } from '../components/ui.jsx';
import ProductCard, { ProductGridSkeleton } from '../components/ProductCard.jsx';
import Hero from '../components/Hero.jsx';

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
      <Hero hero={hero} stickers={marquee.items} />

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

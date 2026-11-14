import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, X } from 'lucide-react';
import { api, asset, inr } from '../lib/api.js';
import { useSeo } from '../lib/seo.js';
import { Page, MaskText, Modal, Empty } from '../components/ui.jsx';
import ProductCard, { ProductGridSkeleton } from '../components/ProductCard.jsx';

const SORTS = [['newest', 'Newest'], ['price_asc', 'Price: Low to High'], ['price_desc', 'Price: High to Low'], ['popular', 'Popularity']];
const HINDI = { all: 'सब कुछ', new: 'नया माल', bestseller: 'सबसे हिट' };

export default function Shop({ preset }) {
  const { category, collection } = useParams();
  const [sp, setSp] = useSearchParams();
  const [meta, setMeta] = useState({ colors: [], sizes: [], price: { max: 0 }, categories: [] });
  const [col, setCol] = useState(null);
  const [data, setData] = useState({ products: [], total: 0, pages: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drawer, setDrawer] = useState(false);

  const badge = preset || sp.get('badge') || '';
  const filters = useMemo(() => ({
    q: sp.get('q') || '', sizes: sp.get('sizes') || '', colors: sp.get('colors') || '',
    min_price: sp.get('min_price') || '', max_price: sp.get('max_price') || '', in_stock: sp.get('in_stock') || '',
    sort: sp.get('sort') || (badge === 'bestseller' ? 'popular' : 'newest'),
  }), [sp, badge]);

  useEffect(() => { api.get('/products/filters').then(({ data: d }) => setMeta(d)).catch(() => {}); }, []);
  useEffect(() => {
    setCol(null);
    if (collection) api.get(`/collections/${collection}`).then(({ data: d }) => setCol(d.collection)).catch(() => setCol({ name: 'Collection not found' }));
  }, [collection]);

  const queryKey = JSON.stringify({ category, collection, badge, filters });
  useEffect(() => { setPage(1); }, [queryKey]);
  useEffect(() => {
    setLoading(true); setError('');
    const params = Object.fromEntries(Object.entries({ ...filters, category, collection, badge, page, limit: 12 }).filter(([, v]) => v !== '' && v != null));
    api.get('/products', { params })
      .then(({ data: d }) => setData((prev) => ({ ...d, products: page > 1 ? [...prev.products, ...d.products] : d.products })))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [queryKey, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key, value) => {
    const next = new URLSearchParams(sp);
    if (value === '' || value == null) next.delete(key); else next.set(key, value);
    setSp(next, { replace: true });
  };
  const toggleList = (key, v) => {
    const cur = new Set((filters[key] || '').split(',').filter(Boolean));
    cur.has(v) ? cur.delete(v) : cur.add(v);
    set(key, [...cur].join(','));
  };
  const clearAll = () => setSp(new URLSearchParams(filters.q ? { q: filters.q } : {}), { replace: true });
  const activeCount = ['sizes', 'colors', 'min_price', 'max_price', 'in_stock'].reduce((n, k) => n + (filters[k] ? 1 : 0), 0);

  const cat = meta.categories.find((c) => c.slug === category);
  const title = col?.name || cat?.name || (badge === 'new' ? 'New Drops' : badge === 'bestseller' ? 'Best Sellers' : filters.q ? `“${filters.q}”` : 'Shop All');
  const hindi = HINDI[badge] || (col ? 'संग्रह' : cat ? 'चुनिंदा' : HINDI.all);
  useSeo({ title, description: col?.description || cat?.description || `Shop ${title} — oversized Hindi streetwear tees from BAKACHIKI.` });

  const tabs = [
    { to: '/shop', label: 'All Products', active: !category && !badge && !collection },
    ...meta.categories.map((c) => ({ to: `/shop/${c.slug}`, label: c.name, active: category === c.slug })),
    { to: '/new-drops', label: 'New Arrivals', active: badge === 'new' },
    { to: '/shop?badge=bestseller', label: 'Best Sellers', active: badge === 'bestseller' },
  ];

  const filterPanel = (
    <div className="space-y-8">
      <FilterGroup title="Size">
        <div className="grid grid-cols-6 gap-1.5 lg:grid-cols-3">
          {meta.sizes.map((s) => {
            const on = filters.sizes.split(',').includes(s);
            return <button key={s} onClick={() => toggleList('sizes', s)} aria-pressed={on} className={`h-11 border text-sm font-bold transition ${on ? 'border-neon bg-neon text-ink' : 'border-line hover:border-paper'}`}>{s}</button>;
          })}
        </div>
      </FilterGroup>
      <FilterGroup title="Colour">
        <div className="flex flex-wrap gap-2">
          {meta.colors.map((c) => {
            const on = filters.colors.split(',').includes(c.name);
            return (
              <button key={c.name} onClick={() => toggleList('colors', c.name)} aria-pressed={on} className={`chip transition ${on ? 'border-neon text-neon' : 'hover:border-paper'}`}>
                <span className="size-3.5 rounded-full border border-line" style={{ background: c.hex }} />{c.name}
              </button>
            );
          })}
        </div>
      </FilterGroup>
      <FilterGroup title="Price">
        <PriceRange max={meta.price.max} min={filters.min_price} maxV={filters.max_price} onChange={(a, b) => { const next = new URLSearchParams(sp); a ? next.set('min_price', a) : next.delete('min_price'); b ? next.set('max_price', b) : next.delete('max_price'); setSp(next, { replace: true }); }} />
      </FilterGroup>
      <FilterGroup title="Availability">
        <label className="flex cursor-pointer items-center justify-between gap-3">
          <span className="text-sm">In stock only</span>
          <input type="checkbox" className="peer sr-only" checked={Boolean(filters.in_stock)} onChange={(e) => set('in_stock', e.target.checked ? '1' : '')} />
          <span className="relative h-6 w-11 rounded-full border border-line bg-panel transition peer-checked:border-neon peer-checked:bg-neon/20 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-neon after:absolute after:left-1 after:top-1 after:size-3.5 after:rounded-full after:bg-mute after:transition peer-checked:after:translate-x-5 peer-checked:after:bg-neon" />
        </label>
      </FilterGroup>
      {activeCount > 0 && <button onClick={clearAll} className="label text-neon underline underline-offset-4">Clear all filters</button>}
    </div>
  );

  return (
    <Page className="pt-24 lg:pt-28">
      <header className="relative mx-auto max-w-[1600px] overflow-hidden px-4 pb-8 pt-10 sm:px-8 lg:px-10">
        {col?.image_url && <img src={asset(col.image_url)} alt="" aria-hidden="true" className="absolute inset-0 -z-10 size-full object-cover opacity-20" />}
        <p className="label text-neon">{collection ? 'Collection' : 'Shop'} · {data.total} pieces</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <MaskText key={title} as="h1" lines={[title]} className="display text-6xl sm:text-8xl lg:text-[9rem]" inView={false} />
          <p className="hindi text-5xl text-green sm:text-7xl" aria-hidden="true">{hindi}</p>
        </div>
        {col?.description && <p className="mt-4 max-w-xl text-mute">{col.description}</p>}
      </header>

      {!collection && (
        <nav aria-label="Categories" className="scrollbar-none sticky top-16 z-30 overflow-x-auto border-y border-line bg-ink/90 backdrop-blur lg:top-20">
          <ul className="mx-auto flex max-w-[1600px] gap-1 px-4 sm:px-8 lg:px-10">
            {tabs.map((t) => (
              <li key={t.to}>
                <Link to={t.to} aria-current={t.active ? 'page' : undefined}
                  className={`block whitespace-nowrap border-b-2 px-3 py-4 text-[0.72rem] font-bold uppercase tracking-[0.16em] transition ${t.active ? 'border-neon text-neon' : 'border-transparent text-mute hover:text-paper'}`}>{t.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="mx-auto flex max-w-[1600px] gap-10 px-4 pt-8 sm:px-8 lg:px-10">
        <aside className="hidden w-60 shrink-0 lg:block" aria-label="Filters">
          <div className="sticky top-44">{filterPanel}</div>
        </aside>
        <div className="min-w-0 flex-1">
          <div className="mb-6 flex items-center justify-between gap-3">
            <button onClick={() => setDrawer(true)} className="chip h-11 px-4 lg:hidden"><SlidersHorizontal size={15} />Filters{activeCount > 0 && <span className="grid size-5 place-items-center rounded-full bg-neon text-[0.65rem] text-ink">{activeCount}</span>}</button>
            <p className="hidden text-sm text-mute lg:block">{data.total} result{data.total === 1 ? '' : 's'}</p>
            <label className="flex items-center gap-2">
              <span className="label hidden text-mute sm:inline">Sort</span>
              <select value={filters.sort} onChange={(e) => set('sort', e.target.value)} className="field h-11 min-h-0 w-auto py-0 pr-8 text-sm" aria-label="Sort products">
                {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          </div>
          {activeCount > 0 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {filters.sizes.split(',').filter(Boolean).map((s) => <Pill key={s} onClear={() => toggleList('sizes', s)}>Size {s}</Pill>)}
              {filters.colors.split(',').filter(Boolean).map((c) => <Pill key={c} onClear={() => toggleList('colors', c)}>{c}</Pill>)}
              {(filters.min_price || filters.max_price) && <Pill onClear={() => { const n = new URLSearchParams(sp); n.delete('min_price'); n.delete('max_price'); setSp(n, { replace: true }); }}>{inr(filters.min_price || 0)} – {filters.max_price ? inr(filters.max_price) : 'any'}</Pill>}
              {filters.in_stock && <Pill onClear={() => set('in_stock', '')}>In stock</Pill>}
            </div>
          )}

          {error && <p className="text-danger" role="alert">{error}</p>}
          {loading && page === 1 ? <ProductGridSkeleton n={6} /> : data.products.length === 0 ? (
            <Empty title="Nothing here yet" hindi="खाली" action={activeCount ? <button className="btn btn-ghost" onClick={clearAll}>Clear filters</button> : <Link to="/shop" className="btn btn-ghost">Shop all</Link>}>
              {activeCount ? 'No pieces match these filters.' : 'This drop is still cooking. Check back soon.'}
            </Empty>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-5 xl:grid-cols-3">
                {data.products.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
              </div>
              {page < data.pages && (
                <div className="mt-14 text-center">
                  <button onClick={() => setPage((p) => p + 1)} disabled={loading} className="btn btn-ghost">{loading ? 'Loading…' : `Load more (${data.total - data.products.length})`}</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Modal open={drawer} onClose={() => setDrawer(false)} title="Filters" side>
        {filterPanel}
        <button onClick={() => setDrawer(false)} className="btn btn-solid mt-10 w-full">Show {data.total} results</button>
      </Modal>
    </Page>
  );
}

const FilterGroup = ({ title, children }) => (
  <section><h2 className="label mb-4 border-b border-line pb-2 text-mute">{title}</h2>{children}</section>
);

const Pill = ({ children, onClear }) => (
  <button onClick={onClear} className="chip border-neon/60 text-neon hover:border-neon" aria-label={`Remove filter ${children}`}>{children}<X size={12} /></button>
);

function PriceRange({ max, min, maxV, onChange }) {
  const ceiling = Math.max(500, Math.ceil((max || 0) / 100) * 100);
  const [lo, setLo] = useState(min || '');
  const [hi, setHi] = useState(maxV || '');
  useEffect(() => { setLo(min || ''); setHi(maxV || ''); }, [min, maxV]);
  const commit = () => onChange(lo, hi);
  return (
    <div>
      <input type="range" min={0} max={ceiling} step={50} value={hi || ceiling} onChange={(e) => setHi(e.target.value === String(ceiling) ? '' : e.target.value)} onPointerUp={commit} onKeyUp={commit}
        className="w-full accent-[#39D353]" aria-label="Maximum price" />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <input className="field h-11 min-h-0 text-sm" inputMode="numeric" placeholder="Min ₹" value={lo} onChange={(e) => setLo(e.target.value.replace(/\D/g, ''))} onBlur={commit} aria-label="Minimum price" />
        <input className="field h-11 min-h-0 text-sm" inputMode="numeric" placeholder={`Max ₹${ceiling}`} value={hi} onChange={(e) => setHi(e.target.value.replace(/\D/g, ''))} onBlur={commit} aria-label="Maximum price" />
      </div>
    </div>
  );
}

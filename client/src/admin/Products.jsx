import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, ArrowUp, ArrowDown, Upload, Crosshair, ExternalLink } from 'lucide-react';
import { api, asset, inr, formatDate } from '../lib/api.js';
import { useUi } from '../context/store.jsx';
import { Field, PageLoader, Spinner } from '../components/ui.jsx';
import { PageHead, Card, useFetch, Table, SearchBox, Pager, Toggle } from './kit.jsx';

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const KINDS = ['front', 'back', 'side', 'fabric', 'print', 'model', 'gallery', 'frame', 'video'];

export function ProductList() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, , loading] = useFetch('/admin/products', { q, page });
  return (
    <>
      <PageHead title="Products">
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search name or SKU" />
        <Link to="/admin/products/new" className="btn btn-solid min-h-11"><Plus size={16} />Add product</Link>
      </PageHead>
      <Table head={['', 'Product', 'SKU', 'Category', 'Price', 'Stock', 'Flags', 'Status']} loading={loading && !data}>
        {data?.products.map((p) => (
          <tr key={p.id} className="hover:bg-panel">
            <td className="px-4 py-2">{p.thumb && <img src={asset(p.thumb)} alt="" className="size-12 border border-line object-cover" />}</td>
            <td className="px-4 py-2"><Link to={`/admin/products/${p.id}`} className="font-bold hover:text-neon">{p.name}</Link></td>
            <td className="px-4 py-2 font-mono text-xs">{p.sku}</td>
            <td className="px-4 py-2 text-mute">{p.category?.name || '—'}</td>
            <td className="px-4 py-2">{p.discount_price ? <>{inr(p.discount_price)} <s className="text-mute">{inr(p.price)}</s></> : inr(p.price)}</td>
            <td className={`px-4 py-2 font-bold ${Number(p.total_stock) <= 5 ? 'text-warn' : ''}`}>{p.total_stock}</td>
            <td className="px-4 py-2 text-xs text-mute">{[p.is_featured && 'Featured', p.is_new_arrival && 'New', p.is_best_seller && 'Best'].filter(Boolean).join(' · ') || '—'}</td>
            <td className="px-4 py-2">{p.is_active ? <span className="text-neon">Live</span> : <span className="text-mute">Hidden</span>}</td>
          </tr>
        ))}
      </Table>
      <Pager page={page} pages={data?.pages} onPage={setPage} />
    </>
  );
}

const EMPTY = {
  name: '', slug: '', sku: '', description: '', price: '', discount_price: '', category_id: '', collection_ids: [],
  fabric: '', gsm: '', fit: '', print_type: '', hotspots: [], variants: [],
  is_featured: false, is_new_arrival: true, is_best_seller: false, is_active: true, meta_title: '', meta_description: '',
};

const toForm = (p) => ({
  ...EMPTY, ...p,
  discount_price: p.discount_price ?? '', category_id: p.category_id ?? '', gsm: p.gsm ?? '',
  fabric: p.fabric || '', fit: p.fit || '', print_type: p.print_type || '', meta_title: p.meta_title || '', meta_description: p.meta_description || '',
  collection_ids: (p.collections || []).map((c) => c.id), hotspots: p.hotspots || [],
  variants: (p.variants || []).map(({ id, color, color_hex, size, sku, stock }) => ({ id, color, color_hex, size, sku, stock })),
});

export function ProductEdit() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const { toast } = useUi();
  const [form, setForm] = useState(isNew ? EMPTY : null);
  const [product, setProduct] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [cats] = useFetch('/admin/categories');
  const [cols] = useFetch('/admin/collections');

  useEffect(() => {
    if (isNew) { setForm(EMPTY); setProduct(null); return; }
    api.get(`/admin/products/${id}`).then(({ data }) => { setProduct(data.product); setForm(toForm(data.product)); }).catch((e) => toast(e.message, 'error'));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!form) return <PageLoader />;
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };
  const bind = (k) => ({ value: form[k] ?? '', onChange: (e) => set(k, e.target.value), error: errors[k] });

  const save = async (e) => {
    e.preventDefault(); setBusy(true); setErrors({});
    const body = {
      ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, form[k]])),
      variants: form.variants.map((v) => ({ ...v, stock: Number(v.stock) || 0 })),
    };
    try {
      const { data } = isNew ? await api.post('/admin/products', body) : await api.put(`/admin/products/${id}`, body);
      toast('Product saved');
      setProduct(data.product); setForm(toForm(data.product));
      if (isNew) navigate(`/admin/products/${data.product.id}`, { replace: true });
    } catch (err) { setErrors(err.details || {}); toast(err.message, 'error'); } finally { setBusy(false); }
  };

  const del = async () => {
    if (!window.confirm(`Delete “${form.name}” permanently? Past orders keep their snapshot. Consider hiding it instead.`)) return;
    try { await api.delete(`/admin/products/${id}`); toast('Product deleted'); navigate('/admin/products'); } catch (e) { toast(e.message, 'error'); }
  };

  // Variant matrix helpers
  const addColor = () => {
    const color = window.prompt('Colour name (e.g. Black)');
    if (!color) return;
    const hex = window.prompt('Hex colour', '#000000') || '#000000';
    const base = (form.sku || 'BK').toUpperCase();
    const code = color.replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase();
    set('variants', [...form.variants, ...SIZES.map((s) => ({ color, color_hex: hex, size: s, sku: `${base}-${code}-${s}`, stock: 0 }))]);
  };
  const setVariant = (i, k, v) => set('variants', form.variants.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const colorGroups = [...new Set(form.variants.map((v) => v.color))];

  return (
    <form onSubmit={save} noValidate>
      <PageHead title={isNew ? 'New product' : form.name || 'Edit product'}>
        {!isNew && product?.is_active && <a href={`/product/${product.slug}`} target="_blank" rel="noreferrer" className="btn btn-ghost min-h-11"><ExternalLink size={15} />View</a>}
        {!isNew && <button type="button" onClick={del} className="btn btn-ghost min-h-11 hover:!text-ink"><Trash2 size={15} />Delete</button>}
        <button disabled={busy} className="btn btn-solid min-h-11">{busy ? 'Saving…' : 'Save product'}</button>
      </PageHead>
      {Object.keys(errors).length > 0 && <p className="mb-4 border border-danger p-3 text-sm text-danger" role="alert">Fix: {Object.entries(errors).filter(([, v]) => v).map(([k, v]) => `${k} — ${[].concat(v)[0]}`).join('; ')}</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Basics">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" {...bind('name')} required className="sm:col-span-2" />
              <Field label="URL slug" {...bind('slug')} hint="Leave blank to generate from name" />
              <Field label="SKU" {...bind('sku')} required />
              <Field label="Description" as="textarea" rows={5} {...bind('description')} className="sm:col-span-2" />
              <Field label="Price (₹)" type="number" min="1" {...bind('price')} required />
              <Field label="Discount price (₹)" type="number" min="1" {...bind('discount_price')} hint="Leave blank for no discount" />
            </div>
          </Card>
          <Card title="Product details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Fabric" {...bind('fabric')} placeholder="Cotton" />
              <Field label="GSM" type="number" {...bind('gsm')} placeholder="240" />
              <Field label="Fit" {...bind('fit')} placeholder="Oversized · Drop Shoulder" />
              <Field label="Print type" {...bind('print_type')} placeholder="Puff / Emboss" />
            </div>
          </Card>

          <Card title="Variants & stock" action={<button type="button" onClick={addColor} className="chip hover:border-neon"><Plus size={13} />Add colour (all sizes)</button>}>
            {!form.variants.length && <p className="text-sm text-mute">No variants yet. Add a colour to create its six sizes.</p>}
            {colorGroups.map((color) => (
              <div key={color} className="mb-5">
                <p className="mb-2 flex items-center gap-2 font-bold"><span className="size-4 rounded-full border border-line" style={{ background: form.variants.find((v) => v.color === color).color_hex }} />{color}</p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead><tr className="text-left text-mute"><th className="label py-1">Size</th><th className="label">SKU</th><th className="label">Hex</th><th className="label">Stock</th><th /></tr></thead>
                    <tbody>
                      {form.variants.map((v, i) => v.color === color && (
                        <tr key={i}>
                          <td className="py-1 pr-2"><select className="field h-10 min-h-0 py-0" value={v.size} onChange={(e) => setVariant(i, 'size', e.target.value)} aria-label="Size">{SIZES.map((s) => <option key={s}>{s}</option>)}</select></td>
                          <td className="pr-2"><input className="field h-10 min-h-0 font-mono text-xs" value={v.sku} onChange={(e) => setVariant(i, 'sku', e.target.value)} aria-label="Variant SKU" /></td>
                          <td className="pr-2"><input type="color" className="h-10 w-14 border border-line bg-panel" value={v.color_hex} onChange={(e) => set('variants', form.variants.map((x) => (x.color === color ? { ...x, color_hex: e.target.value } : x)))} aria-label="Colour hex" /></td>
                          <td className="pr-2"><input type="number" min="0" className="field h-10 min-h-0 w-24" value={v.stock} onChange={(e) => setVariant(i, 'stock', e.target.value)} aria-label="Stock" /></td>
                          <td><button type="button" onClick={() => set('variants', form.variants.filter((_, j) => j !== i))} aria-label="Remove variant" className="grid size-10 place-items-center text-mute hover:text-danger"><Trash2 size={15} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            <p className="text-xs text-mute">Stock edits here are logged as inventory adjustments. Save to apply.</p>
          </Card>

          {!isNew && product && <MediaManager product={product} onChange={(p) => { setProduct(p); }} />}
          {!isNew && product && <Hotspots product={product} hotspots={form.hotspots} onChange={(h) => set('hotspots', h)} />}
          {!isNew && product && <InventoryLog productId={product.id} />}
          {isNew && <Card title="Media & hotspots"><p className="text-sm text-mute">Save the product first, then upload images, videos and 360° frames.</p></Card>}
        </div>

        <div className="space-y-6">
          <Card title="Visibility">
            <div className="space-y-2">
              <Toggle label="Live on store" checked={form.is_active} onChange={(v) => set('is_active', v)} />
              <Toggle label="Featured (homepage)" checked={form.is_featured} onChange={(v) => set('is_featured', v)} />
              <Toggle label="New arrival" checked={form.is_new_arrival} onChange={(v) => set('is_new_arrival', v)} />
              <Toggle label="Best seller" checked={form.is_best_seller} onChange={(v) => set('is_best_seller', v)} />
            </div>
          </Card>
          <Card title="Organise">
            <Field label="Category" as="select" {...bind('category_id')}>
              <option value="">— None —</option>
              {cats?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Field>
            <p className="label mb-2 mt-5 text-mute">Collections</p>
            <div className="space-y-2">
              {cols?.collections.map((c) => (
                <Toggle key={c.id} label={c.name} checked={form.collection_ids.includes(c.id)} onChange={(on) => set('collection_ids', on ? [...form.collection_ids, c.id] : form.collection_ids.filter((x) => x !== c.id))} />
              ))}
            </div>
          </Card>
          <Card title="SEO">
            <div className="space-y-4">
              <Field label="Meta title" {...bind('meta_title')} maxLength={160} />
              <Field label="Meta description" as="textarea" rows={3} {...bind('meta_description')} maxLength={300} />
            </div>
          </Card>
        </div>
      </div>
    </form>
  );
}

function MediaManager({ product, onChange }) {
  const { toast } = useUi();
  const fileRef = useRef(null);
  const [kind, setKind] = useState('front');
  const [color, setColor] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const colors = [...new Set(product.variants.map((v) => v.color))];
  const media = [...product.images].sort((a, b) => a.sort_order - b.sort_order);

  const run = async (fn) => { setBusy(true); try { const { data } = await fn(); onChange(data.product); } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); } };
  const upload = (files) => {
    if (!files?.length && !url) return;
    const fd = new FormData();
    [...(files || [])].forEach((f) => fd.append('files', f));
    fd.append('kind', kind); if (color) fd.append('color', color); if (url && !files?.length) fd.append('url', url);
    run(() => api.post(`/admin/products/${product.id}/media`, fd, { timeout: 120000 })).then(() => { setUrl(''); toast('Media added'); });
  };
  const move = (i, d) => {
    const ids = media.map((m) => m.id);
    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    run(() => api.put(`/admin/products/${product.id}/media-order`, { ids }));
  };

  return (
    <Card title={`Media (${media.length})`}>
      <div className="grid gap-3 border border-dashed border-line p-4 sm:grid-cols-4">
        <Field label="Type" as="select" value={kind} onChange={(e) => setKind(e.target.value)}>{KINDS.map((k) => <option key={k} value={k}>{k === 'frame' ? 'frame (360° sequence)' : k}</option>)}</Field>
        <Field label="Colour" as="select" value={color} onChange={(e) => setColor(e.target.value)}><option value="">All colours</option>{colors.map((c) => <option key={c}>{c}</option>)}</Field>
        <div className="sm:col-span-2">
          <span className="label mb-2 block text-mute">Files</span>
          <button type="button" disabled={busy} onClick={() => fileRef.current.click()} className="btn btn-ghost min-h-12 w-full">{busy ? <Spinner /> : <Upload size={16} />}Upload {kind === 'frame' ? 'frames' : 'files'}</button>
          <input ref={fileRef} type="file" multiple hidden accept={kind === 'video' ? 'video/mp4,video/webm' : 'image/jpeg,image/png,image/webp,image/avif'} onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
        </div>
        <div className="flex gap-2 sm:col-span-4">
          <input className="field h-11 min-h-0 text-sm" placeholder="…or paste an image/video URL" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Media URL" />
          <button type="button" onClick={() => upload(null)} disabled={!url || busy} className="btn btn-ghost min-h-11">Add URL</button>
        </div>
        <p className="text-xs text-mute sm:col-span-4">360°: upload 24–72 frames in one go as type “frame”, named in order (frame-01.jpg, frame-02.jpg…). With fewer than 8 frames the viewer rotates through front / side / back shots instead.</p>
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {media.map((m, i) => (
          <li key={m.id} className="border border-line bg-ink">
            <div className="relative aspect-[5/6]">
              {m.kind === 'video' ? <video src={asset(m.url)} className="size-full object-cover" muted /> : <img src={asset(m.url)} alt="" className="size-full object-cover" loading="lazy" />}
              <span className="absolute left-1 top-1 bg-ink/80 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase">{i + 1}</span>
            </div>
            <div className="space-y-1.5 p-2">
              <select className="field h-9 min-h-0 py-0 text-xs" value={m.kind} onChange={(e) => run(() => api.patch(`/admin/media/${m.id}`, { kind: e.target.value }))} aria-label="Media type">{KINDS.map((k) => <option key={k}>{k}</option>)}</select>
              <select className="field h-9 min-h-0 py-0 text-xs" value={m.color || ''} onChange={(e) => run(() => api.patch(`/admin/media/${m.id}`, { color: e.target.value || null }))} aria-label="Media colour"><option value="">All colours</option>{colors.map((c) => <option key={c}>{c}</option>)}</select>
              <div className="flex justify-between">
                <span className="flex">
                  <button type="button" disabled={i === 0 || busy} onClick={() => move(i, -1)} className="grid size-8 place-items-center disabled:opacity-30" aria-label="Move earlier"><ArrowUp size={14} /></button>
                  <button type="button" disabled={i === media.length - 1 || busy} onClick={() => move(i, 1)} className="grid size-8 place-items-center disabled:opacity-30" aria-label="Move later"><ArrowDown size={14} /></button>
                </span>
                <button type="button" onClick={() => window.confirm('Delete this media?') && run(() => api.delete(`/admin/media/${m.id}`))} className="grid size-8 place-items-center text-mute hover:text-danger" aria-label="Delete media"><Trash2 size={14} /></button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Hotspots({ product, hotspots, onChange }) {
  const [view, setView] = useState('back');
  const img = product.images.find((i) => i.kind === view) || product.images.find((i) => i.kind === 'front');
  const place = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * 100); const y = Math.round(((e.clientY - r.top) / r.height) * 100);
    onChange([...hotspots, { x, y, view, title: 'New detail', body: 'Describe this detail' }]);
  };
  const upd = (i, k, v) => onChange(hotspots.map((h, j) => (j === i ? { ...h, [k]: v } : h)));
  return (
    <Card title="Hotspots (green + markers on the viewer)">
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <div className="mb-2 flex gap-1">{['front', 'back', 'side'].map((v) => <button key={v} type="button" onClick={() => setView(v)} className={`chip ${view === v ? 'border-neon text-neon' : ''}`}>{v}</button>)}</div>
          <button type="button" onClick={place} className="relative block aspect-[5/6] w-full cursor-crosshair border border-line bg-ink" aria-label="Click to place a hotspot">
            {img && <img src={asset(img.url)} alt="" className="size-full object-contain" />}
            {hotspots.map((h, i) => (h.view === view || h.view === 'any') && <span key={i} className="absolute grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-neon text-xs font-bold text-ink" style={{ left: `${h.x}%`, top: `${h.y}%` }}>{i + 1}</span>)}
          </button>
          <p className="mt-2 flex items-center gap-1 text-xs text-mute"><Crosshair size={12} />Click the image to drop a hotspot. Save product to publish.</p>
        </div>
        <ol className="space-y-3">
          {hotspots.map((h, i) => (
            <li key={i} className="space-y-2 border border-line p-3">
              <div className="flex items-center gap-2">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-neon text-xs font-bold text-ink">{i + 1}</span>
                <input className="field h-9 min-h-0 text-sm" value={h.title} onChange={(e) => upd(i, 'title', e.target.value)} aria-label="Hotspot title" />
                <select className="field h-9 min-h-0 w-24 py-0 text-xs" value={h.view || 'any'} onChange={(e) => upd(i, 'view', e.target.value)} aria-label="Shown on view">{['any', 'front', 'back', 'side'].map((v) => <option key={v}>{v}</option>)}</select>
                <button type="button" onClick={() => onChange(hotspots.filter((_, j) => j !== i))} aria-label="Remove hotspot" className="text-mute hover:text-danger"><Trash2 size={14} /></button>
              </div>
              <textarea className="field min-h-0 text-sm" rows={2} value={h.body} onChange={(e) => upd(i, 'body', e.target.value)} aria-label="Hotspot text" />
            </li>
          ))}
          {!hotspots.length && <p className="text-sm text-mute">No hotspots yet.</p>}
        </ol>
      </div>
    </Card>
  );
}

function InventoryLog({ productId }) {
  const [data] = useFetch('/admin/inventory', { product_id: productId });
  return (
    <Card title="Inventory history">
      <div className="max-h-72 overflow-y-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-mute"><th className="label py-1">When</th><th className="label">Variant</th><th className="label">Change</th><th className="label">After</th><th className="label">Reason</th></tr></thead>
          <tbody className="divide-y divide-line">
            {data?.movements.map((m) => (
              <tr key={m.id}>
                <td className="py-1.5 text-mute">{formatDate(m.created_at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                <td>{m.variant.color} {m.variant.size}</td>
                <td className={m.change > 0 ? 'text-neon' : 'text-danger'}>{m.change > 0 ? `+${m.change}` : m.change}</td>
                <td>{m.stock_after}</td>
                <td className="text-mute">{m.reason}{m.note ? ` · ${m.note}` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

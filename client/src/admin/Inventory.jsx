import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatDate } from '../lib/api.js';
import { useUi } from '../context/store.jsx';
import { PageHead, Card, useFetch, Table, SearchBox } from './kit.jsx';

const LOW = 5;

// Stock levels for every variant, quick restock/adjust (logged via moveStock on the server) and recent movements.
export default function Inventory() {
  const { toast } = useUi();
  const [q, setQ] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [data, reload, loading] = useFetch('/admin/stock', { q: q || undefined, low: lowOnly ? LOW : undefined });
  const [log, reloadLog] = useFetch('/admin/inventory');
  const [edits, setEdits] = useState({});

  const apply = async (v, reason) => {
    const change = Number(edits[v.id]);
    if (!Number.isInteger(change) || change === 0) return toast('Enter a whole number, e.g. 10 or -2', 'error');
    try {
      await api.post(`/admin/variants/${v.id}/stock`, { change, reason });
      toast(`${v.sku}: ${change > 0 ? '+' : ''}${change}`);
      setEdits((e) => ({ ...e, [v.id]: '' }));
      reload(); reloadLog();
    } catch (e) { toast(e.message, 'error'); }
  };

  const variants = data?.variants || [];
  const total = variants.reduce((s, v) => s + v.stock, 0);

  return (
    <>
      <PageHead title="Inventory">
        <SearchBox value={q} onChange={setQ} placeholder="Search product…" />
        <button onClick={() => setLowOnly(!lowOnly)} className={`chip h-11 px-4 ${lowOnly ? 'border-neon text-neon' : ''}`} aria-pressed={lowOnly}>Low stock (≤{LOW})</button>
      </PageHead>
      <p className="mb-4 text-sm text-mute">{variants.length} variants · {total} units in stock. Positive numbers add stock, negative remove it.</p>
      <Table head={['Product', 'Variant', 'SKU', 'In stock', 'Change']} loading={loading && !data} empty="No variants match.">
        {variants.map((v) => (
          <tr key={v.id}>
            <td className="px-4 py-3"><Link to={`/admin/products/${v.product.id}`} className="hover:text-neon">{v.product.name}</Link></td>
            <td className="whitespace-nowrap px-4 py-3"><span className="mr-2 inline-block size-3 border border-line align-middle" style={{ background: v.color_hex }} />{v.color} · {v.size}</td>
            <td className="px-4 py-3 font-mono text-xs text-mute">{v.sku}</td>
            <td className={`px-4 py-3 font-bold ${v.stock === 0 ? 'text-danger' : v.stock <= LOW ? 'text-warn' : ''}`}>{v.stock}</td>
            <td className="px-4 py-2">
              <div className="flex gap-1">
                <input type="number" step="1" inputMode="numeric" aria-label={`Stock change for ${v.sku}`} value={edits[v.id] ?? ''}
                  onChange={(e) => setEdits({ ...edits, [v.id]: e.target.value })} className="field h-9 min-h-0 w-20 px-2 py-1 text-sm" placeholder="±0" />
                <button onClick={() => apply(v, 'restock')} className="chip h-9 hover:border-neon">Restock</button>
                <button onClick={() => apply(v, 'adjustment')} className="chip h-9 hover:border-neon">Adjust</button>
              </div>
            </td>
          </tr>
        ))}
      </Table>

      <Card title="Recent stock movements" className="mt-8">
        <Table head={['When', 'SKU', 'Change', 'Reason', 'Note']} empty="No movements yet.">
          {(log?.movements || []).slice(0, 50).map((m) => (
            <tr key={m.id}>
              <td className="whitespace-nowrap px-4 py-2 text-mute">{formatDate(m.created_at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
              <td className="px-4 py-2 font-mono text-xs">{m.variant?.sku}</td>
              <td className={`px-4 py-2 font-bold ${m.change > 0 ? 'text-neon' : 'text-danger'}`}>{m.change > 0 ? '+' : ''}{m.change}</td>
              <td className="px-4 py-2 capitalize">{m.reason}</td>
              <td className="px-4 py-2 text-mute">{m.note || '—'}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}

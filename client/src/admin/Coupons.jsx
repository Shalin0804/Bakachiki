import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { api, inr, formatDate } from '../lib/api.js';
import { useUi } from '../context/store.jsx';
import { Field, Modal } from '../components/ui.jsx';
import { PageHead, useFetch, Table, Toggle } from './kit.jsx';

const BLANK = { code: '', description: '', type: 'percent', value: 10, min_order: 0, max_discount: '', starts_at: '', expires_at: '', usage_limit: '', per_user_limit: '', is_active: true };
const toLocal = (d) => (d ? new Date(new Date(d).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');

export default function Coupons() {
  const { toast } = useUi();
  const [data, reload, loading] = useFetch('/admin/coupons');
  const [edit, setEdit] = useState(null);
  const [errors, setErrors] = useState({});

  const save = async (e) => {
    e.preventDefault(); setErrors({});
    const body = { ...edit };
    ['id', 'used_count', 'created_at', 'updated_at'].forEach((k) => delete body[k]);
    ['starts_at', 'expires_at'].forEach((k) => { body[k] = body[k] ? new Date(body[k]).toISOString() : ''; });
    try { edit.id ? await api.put(`/admin/coupons/${edit.id}`, body) : await api.post('/admin/coupons', body); toast('Coupon saved'); setEdit(null); reload(); } catch (err) { setErrors(err.details || {}); toast(err.message, 'error'); }
  };
  const del = async (c) => {
    if (!window.confirm(`Delete coupon ${c.code}?`)) return;
    try { const { data: d } = await api.delete(`/admin/coupons/${c.id}`); toast(d.deactivated ? 'Coupon was used before — deactivated instead' : 'Coupon deleted'); reload(); } catch (err) { toast(err.message, 'error'); }
  };
  const bind = (k) => ({ value: edit?.[k] ?? '', onChange: (e) => setEdit({ ...edit, [k]: e.target.value }), error: errors[k] });
  const expired = (c) => c.expires_at && new Date(c.expires_at) < new Date();

  return (
    <>
      <PageHead title="Coupons"><button onClick={() => setEdit({ ...BLANK })} className="btn btn-solid min-h-11"><Plus size={16} />New coupon</button></PageHead>
      <Table head={['Code', 'Discount', 'Min order', 'Usage', 'Valid', 'Status', '']} loading={loading && !data}>
        {data?.coupons.map((c) => (
          <tr key={c.id} className="hover:bg-panel">
            <td className="px-4 py-3"><span className="font-mono font-bold text-neon">{c.code}</span><br /><span className="text-xs text-mute">{c.description}</span></td>
            <td className="px-4 py-3">{c.type === 'percent' ? `${c.value}%` : inr(c.value)}{c.max_discount ? <span className="text-xs text-mute"> (max {inr(c.max_discount)})</span> : ''}</td>
            <td className="px-4 py-3">{inr(c.min_order)}</td>
            <td className="px-4 py-3">{c.used_count}{c.usage_limit ? ` / ${c.usage_limit}` : ''}{c.per_user_limit ? <span className="text-xs text-mute"> · {c.per_user_limit}/customer</span> : ''}</td>
            <td className="whitespace-nowrap px-4 py-3 text-xs text-mute">{c.starts_at ? formatDate(c.starts_at) : 'Now'} → {c.expires_at ? formatDate(c.expires_at) : 'No expiry'}</td>
            <td className="px-4 py-3">{!c.is_active ? <span className="text-mute">Off</span> : expired(c) ? <span className="text-danger">Expired</span> : <span className="text-neon">Active</span>}</td>
            <td className="px-4 py-3">
              <div className="flex gap-1">
                <button onClick={() => setEdit({ ...c, max_discount: c.max_discount ?? '', usage_limit: c.usage_limit ?? '', per_user_limit: c.per_user_limit ?? '', starts_at: toLocal(c.starts_at), expires_at: toLocal(c.expires_at), description: c.description || '' })} aria-label={`Edit ${c.code}`} className="grid size-9 place-items-center hover:text-neon"><Pencil size={15} /></button>
                <button onClick={() => del(c)} aria-label={`Delete ${c.code}`} className="grid size-9 place-items-center text-mute hover:text-danger"><Trash2 size={15} /></button>
              </div>
            </td>
          </tr>
        ))}
      </Table>

      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?.id ? 'Edit coupon' : 'New coupon'}>
        {edit && (
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            <Field label="Code" {...bind('code')} required className="sm:col-span-2" />
            <Field label="Description" {...bind('description')} className="sm:col-span-2" />
            <Field label="Type" as="select" {...bind('type')}><option value="percent">Percentage</option><option value="fixed">Fixed amount (₹)</option></Field>
            <Field label={edit.type === 'percent' ? 'Percent off' : 'Amount off (₹)'} type="number" min="1" {...bind('value')} required />
            <Field label="Minimum order (₹)" type="number" min="0" {...bind('min_order')} />
            <Field label="Max discount (₹)" type="number" min="1" {...bind('max_discount')} hint="Blank = no cap" />
            <Field label="Starts" type="datetime-local" {...bind('starts_at')} />
            <Field label="Expires" type="datetime-local" {...bind('expires_at')} />
            <Field label="Total usage limit" type="number" min="1" {...bind('usage_limit')} hint="Blank = unlimited" />
            <Field label="Per-customer limit" type="number" min="1" {...bind('per_user_limit')} hint="Counted by email" />
            <div className="sm:col-span-2"><Toggle label="Active" checked={edit.is_active} onChange={(v) => setEdit({ ...edit, is_active: v })} /></div>
            <button className="btn btn-solid sm:col-span-2">Save coupon</button>
          </form>
        )}
      </Modal>
    </>
  );
}

import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { api, asset } from '../lib/api.js';
import { useUi } from '../context/store.jsx';
import { Field, Modal } from '../components/ui.jsx';
import { PageHead, Card, useFetch, ImageInput, Toggle } from './kit.jsx';

export default function Catalog() {
  return (
    <>
      <PageHead title="Categories & collections" />
      <div className="grid gap-6 xl:grid-cols-2">
        <Section path="categories" title="Categories" />
        <Section path="collections" title="Collections" />
      </div>
    </>
  );
}

function Section({ path, title }) {
  const { toast } = useUi();
  const [data, reload] = useFetch(`/admin/${path}`);
  const [products] = useFetch('/admin/products', { limit: 100 });
  const [edit, setEdit] = useState(null);
  const isCol = path === 'collections';

  const save = async (e) => {
    e.preventDefault();
    const body = { name: edit.name, slug: edit.slug || '', description: edit.description || '', image_url: edit.image_url || '', sort_order: Number(edit.sort_order) || 0 };
    if (isCol) Object.assign(body, { tagline: edit.tagline || '', is_active: edit.is_active !== false, product_ids: edit.product_ids || [] });
    try { edit.id ? await api.put(`/admin/${path}/${edit.id}`, body) : await api.post(`/admin/${path}`, body); toast('Saved'); setEdit(null); reload(); } catch (err) { toast(err.message, 'error'); }
  };
  const del = async (row) => {
    if (!window.confirm(`Delete “${row.name}”? Products stay, just unlinked.`)) return;
    try { await api.delete(`/admin/${path}/${row.id}`); reload(); } catch (err) { toast(err.message, 'error'); }
  };
  const rows = data?.[path] || [];

  return (
    <Card title={title} action={<button onClick={() => setEdit({ name: '', is_active: true, product_ids: [] })} className="chip hover:border-neon"><Plus size={13} />Add</button>}>
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3 py-3">
            {r.image_url ? <img src={asset(r.image_url)} alt="" className="size-12 border border-line object-cover" /> : <span className="size-12 border border-line" />}
            <div className="min-w-0 flex-1">
              <p className="font-bold">{r.name} {isCol && !r.is_active && <span className="text-xs text-mute">(hidden)</span>}</p>
              <p className="truncate text-xs text-mute">/{r.slug}{isCol && ` · ${r.products.length} products`}</p>
            </div>
            <button onClick={() => setEdit({ ...r, product_ids: r.products?.map((p) => p.id) })} aria-label={`Edit ${r.name}`} className="grid size-9 place-items-center hover:text-neon"><Pencil size={15} /></button>
            <button onClick={() => del(r)} aria-label={`Delete ${r.name}`} className="grid size-9 place-items-center text-mute hover:text-danger"><Trash2 size={15} /></button>
          </li>
        ))}
        {!rows.length && <li className="py-3 text-sm text-mute">None yet.</li>}
      </ul>
      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={`${edit?.id ? 'Edit' : 'New'} ${isCol ? 'collection' : 'category'}`}>
        {edit && (
          <form onSubmit={save} className="space-y-4">
            <Field label="Name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required />
            <Field label="Slug" value={edit.slug || ''} onChange={(e) => setEdit({ ...edit, slug: e.target.value })} hint="Blank = from name" />
            {isCol && <Field label="Tagline" value={edit.tagline || ''} onChange={(e) => setEdit({ ...edit, tagline: e.target.value })} />}
            <Field label="Description" as="textarea" rows={3} value={edit.description || ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
            <ImageInput label="Image" value={edit.image_url} onChange={(v) => setEdit({ ...edit, image_url: v })} />
            <Field label="Sort order" type="number" value={edit.sort_order ?? 0} onChange={(e) => setEdit({ ...edit, sort_order: e.target.value })} />
            {isCol && (
              <>
                <Toggle label="Visible on store" checked={edit.is_active !== false} onChange={(v) => setEdit({ ...edit, is_active: v })} />
                <fieldset>
                  <legend className="label mb-2 text-mute">Products in this collection</legend>
                  <div className="max-h-48 space-y-1 overflow-y-auto">
                    {products?.products.map((p) => (
                      <Toggle key={p.id} label={p.name} checked={edit.product_ids?.includes(p.id)} onChange={(on) => setEdit({ ...edit, product_ids: on ? [...(edit.product_ids || []), p.id] : edit.product_ids.filter((x) => x !== p.id) })} />
                    ))}
                  </div>
                </fieldset>
              </>
            )}
            <button className="btn btn-solid w-full">Save</button>
          </form>
        )}
      </Modal>
    </Card>
  );
}

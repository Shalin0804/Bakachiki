// Small building blocks shared by admin screens.
import { useEffect, useRef, useState } from 'react';
import { Upload, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { api, asset } from '../lib/api.js';
import { useUi } from '../context/store.jsx';
import { Spinner } from '../components/ui.jsx';

export const PageHead = ({ title, children }) => (
  <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
    <h1 className="display text-4xl sm:text-5xl">{title}</h1>
    <div className="flex flex-wrap gap-2">{children}</div>
  </div>
);

export const Card = ({ title, children, className = '', action }) => (
  <section className={`border border-line bg-panel p-5 ${className}`}>
    {(title || action) && <div className="mb-4 flex items-center justify-between gap-3"><h2 className="label text-mute">{title}</h2>{action}</div>}
    {children}
  </section>
);

/** Fetch helper: returns [data, reload, loading, error]. */
export function useFetch(url, params) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const key = JSON.stringify(params || {});
  const load = async () => {
    setState((s) => ({ ...s, loading: true }));
    try { const { data } = await api.get(url, { params }); setState({ data, loading: false, error: null }); } catch (e) { setState({ data: null, loading: false, error: e.message }); }
  };
  useEffect(() => { load(); }, [url, key]); // eslint-disable-line react-hooks/exhaustive-deps
  return [state.data, load, state.loading, state.error];
}

export function SearchBox({ value, onChange, placeholder = 'Search…' }) {
  const [v, setV] = useState(value || '');
  useEffect(() => { const t = setTimeout(() => v !== value && onChange(v), 300); return () => clearTimeout(t); }, [v]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <label className="relative block w-full sm:w-72">
      <span className="sr-only">{placeholder}</span>
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
      <input className="field h-11 min-h-0 pl-9 text-sm" placeholder={placeholder} value={v} onChange={(e) => setV(e.target.value)} />
    </label>
  );
}

export function Pager({ page, pages, onPage }) {
  if (!pages || pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-end gap-2 text-sm">
      <button className="grid size-9 place-items-center border border-line disabled:opacity-30" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button>
      <span className="text-mute">Page {page} of {pages}</span>
      <button className="grid size-9 place-items-center border border-line disabled:opacity-30" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight size={16} /></button>
    </div>
  );
}

export function Table({ head, children, empty = 'Nothing here yet.', loading }) {
  return (
    <div className="overflow-x-auto border border-line">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-panel"><tr>{head.map((h) => <th key={h} scope="col" className="label whitespace-nowrap px-4 py-3 text-mute">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
      {loading && <div className="grid h-24 place-items-center"><Spinner /></div>}
      {!loading && (!children || (Array.isArray(children) && !children.length)) && <p className="p-6 text-center text-mute">{empty}</p>}
    </div>
  );
}

/** Image URL field with upload button (stores files via /admin/upload). */
export function ImageInput({ label, value, onChange }) {
  const { toast } = useUi();
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    const fd = new FormData(); fd.append('file', file);
    try { const { data } = await api.post('/admin/upload', fd); onChange(data.url); toast('Uploaded'); } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  return (
    <div>
      <span className="label mb-2 block text-mute">{label}</span>
      <div className="flex gap-2">
        {value && <img src={asset(value)} alt="" className="size-11 shrink-0 border border-line object-cover" />}
        <input className="field h-11 min-h-0 text-sm" value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder="/uploads/… or https://…" aria-label={`${label} URL`} />
        <button type="button" onClick={() => input.current.click()} className="grid h-11 w-12 shrink-0 place-items-center border border-line hover:border-neon" aria-label={`Upload ${label}`}>{busy ? <Spinner /> : <Upload size={16} />}</button>
        <input ref={input} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files[0])} />
      </div>
    </div>
  );
}

export const Toggle = ({ label, checked, onChange }) => (
  <label className="flex cursor-pointer items-center justify-between gap-3 border border-line px-3 py-2.5 text-sm">
    {label}
    <input type="checkbox" className="size-4 accent-[#39D353]" checked={Boolean(checked)} onChange={(e) => onChange(e.target.checked)} />
  </label>
);

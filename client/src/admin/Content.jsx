// Website content editor. Each settings section is edited with fields derived from its shape,
// so new keys added to DEFAULT_SETTINGS on the server show up here automatically.
import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { useSettings, useUi } from '../context/store.jsx';
import { Field, PageLoader } from '../components/ui.jsx';
import { PageHead, Card, ImageInput, Toggle } from './kit.jsx';

const SECTIONS = [
  ['hero', 'Homepage hero'], ['announcement', 'Announcement bar'], ['marquee', 'Scrolling banner'], ['promo', 'Promotional section'],
  ['about', 'About us'], ['contact', 'Contact details'], ['store', 'Shipping & payments'], ['size_guide', 'Size guide'], ['seo', 'SEO defaults'],
];
const isImageKey = (k) => /(_url|^image|og_image)$/.test(k);
const human = (k) => k.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

function AutoField({ name, value, onChange }) {
  if (typeof value === 'boolean') return <Toggle label={human(name)} checked={value} onChange={onChange} />;
  if (typeof value === 'number') return <Field label={human(name)} type="number" value={value} onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))} />;
  if (typeof value === 'string') {
    if (isImageKey(name)) return <ImageInput label={human(name)} value={value} onChange={onChange} />;
    const long = value.length > 80 || ['body', 'description', 'subtitle', 'note'].includes(name);
    return <Field label={human(name)} as={long ? 'textarea' : 'input'} rows={long ? 4 : undefined} value={value} onChange={(e) => onChange(e.target.value)} />;
  }
  if (Array.isArray(value)) {
    const sample = value[0];
    if (typeof sample === 'string' || value.length === 0) {
      return (
        <fieldset className="space-y-2">
          <legend className="label mb-2 text-mute">{human(name)}</legend>
          {value.map((v, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1">{name === 'images' ? <ImageInput label={`Image ${i + 1}`} value={v} onChange={(x) => onChange(value.map((y, j) => (j === i ? x : y)))} /> : <input className="field h-11 min-h-0" value={v} onChange={(e) => onChange(value.map((y, j) => (j === i ? e.target.value : y)))} aria-label={`${human(name)} ${i + 1}`} />}</div>
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remove" className="grid size-11 place-items-center text-mute hover:text-danger"><Trash2 size={15} /></button>
            </div>
          ))}
          <button type="button" onClick={() => onChange([...value, ''])} className="chip hover:border-neon"><Plus size={13} />Add</button>
        </fieldset>
      );
    }
    const blank = Object.fromEntries(Object.entries(sample).map(([k, v]) => [k, typeof v === 'number' ? 0 : '']));
    return (
      <fieldset>
        <legend className="label mb-2 text-mute">{human(name)}</legend>
        <div className="space-y-3">
          {value.map((row, i) => (
            <div key={i} className="grid items-end gap-2 border border-line p-3 sm:grid-cols-[repeat(auto-fit,minmax(110px,1fr))_auto]">
              {Object.keys(sample).map((k) => <AutoField key={k} name={k} value={row[k]} onChange={(x) => onChange(value.map((r, j) => (j === i ? { ...r, [k]: x } : r)))} />)}
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remove row" className="grid size-11 place-items-center text-mute hover:text-danger"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => onChange([...value, blank])} className="chip mt-3 hover:border-neon"><Plus size={13} />Add row</button>
      </fieldset>
    );
  }
  if (value && typeof value === 'object') {
    return (
      <fieldset className="border border-line p-3">
        <legend className="label px-1 text-mute">{human(name)}</legend>
        <div className="grid gap-3 sm:grid-cols-2">{Object.entries(value).map(([k, v]) => <AutoField key={k} name={k} value={v} onChange={(x) => onChange({ ...value, [k]: x })} />)}</div>
      </fieldset>
    );
  }
  return null;
}

export default function Content() {
  const { toast } = useUi();
  const { reload: reloadPublic } = useSettings();
  const [settings, setSettings] = useState(null);
  const [tab, setTab] = useState('hero');
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get('/admin/settings').then(({ data }) => setSettings(data.settings)).catch((e) => toast(e.message, 'error')); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!settings) return <PageLoader />;

  const section = settings[tab];
  const save = async () => {
    setBusy(true);
    try { const { data } = await api.put(`/admin/settings/${tab}`, section); setSettings({ ...settings, [tab]: { ...section, ...data.value } }); reloadPublic(); toast('Published to the store'); } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHead title="Website content"><button onClick={save} disabled={busy} className="btn btn-solid min-h-11">{busy ? 'Saving…' : 'Save & publish'}</button></PageHead>
      <div className="grid gap-6 lg:grid-cols-4">
        <nav aria-label="Content sections" className="scrollbar-none flex gap-1 overflow-x-auto lg:flex-col">
          {SECTIONS.map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} aria-current={tab === k} className={`whitespace-nowrap px-3 py-2.5 text-left text-sm ${tab === k ? 'bg-neon font-bold text-ink' : 'border border-line hover:border-mute lg:border-0'}`}>{label}</button>
          ))}
        </nav>
        <Card title={SECTIONS.find(([k]) => k === tab)[1]} className="lg:col-span-3">
          <div className="space-y-4">
            {Object.entries(section).map(([k, v]) => <AutoField key={`${tab}.${k}`} name={k} value={v} onChange={(x) => setSettings({ ...settings, [tab]: { ...section, [k]: x } })} />)}
          </div>
          {tab === 'store' && <p className="mt-4 text-xs text-mute">Online payments turn on automatically when Razorpay keys are set in the server .env. COD max order 0 = no limit.</p>}
        </Card>
      </div>
    </>
  );
}

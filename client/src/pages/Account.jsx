import { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { LogOut, Plus, Pencil, Trash2, Star } from 'lucide-react';
import { useAuth, useUi } from '../context/store.jsx';
import { api, asset, inr, formatDate } from '../lib/api.js';
import { useSeo } from '../lib/seo.js';
import { Page, Field, Modal, Empty, Spinner, StatusPill } from '../components/ui.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { OrderDetail } from './OrderView.jsx';
import { STATES } from './Checkout.jsx';

const TABS = [['', 'Profile'], ['orders', 'Orders'], ['wishlist', 'Wishlist'], ['addresses', 'Addresses']];

export default function Account() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  useSeo({ title: 'My account', noindex: true });
  return (
    <Page className="mx-auto max-w-[1400px] px-4 pt-28 sm:px-8 lg:pt-32">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <p className="label text-neon">My account</p>
          <h1 className="display mt-2 text-5xl sm:text-7xl">Hey, {user.name.split(' ')[0]}</h1>
        </div>
        <div className="flex gap-2">
          {user.role === 'admin' && <Link to="/admin" className="btn btn-ghost min-h-11">Admin</Link>}
          <button onClick={() => { logout(); navigate('/'); }} className="btn btn-ghost min-h-11"><LogOut size={15} />Log out</button>
        </div>
      </div>
      <nav aria-label="Account" className="scrollbar-none -mx-4 overflow-x-auto px-4">
        <ul className="flex gap-1 border-b border-line">
          {TABS.map(([to, label]) => (
            <li key={label}>
              <NavLink end to={`/account${to ? `/${to}` : ''}`} className={({ isActive }) => `block whitespace-nowrap border-b-2 px-4 py-4 text-xs font-bold uppercase tracking-[0.16em] ${isActive ? 'border-neon text-neon' : 'border-transparent text-mute hover:text-paper'}`}>{label}</NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="py-10">
        <Routes>
          <Route index element={<Profile />} />
          <Route path="orders" element={<Orders />} />
          <Route path="orders/:number" element={<AccountOrder />} />
          <Route path="wishlist" element={<Wishlist />} />
          <Route path="addresses" element={<Addresses />} />
        </Routes>
      </div>
    </Page>
  );
}

function Profile() {
  const { user, setUser } = useAuth();
  const { toast } = useUi();
  const [form, setForm] = useState({ name: user.name, phone: user.phone || '' });
  const [pw, setPw] = useState({ current_password: '', new_password: '' });
  const [errors, setErrors] = useState({});
  const save = async (e) => {
    e.preventDefault(); setErrors({});
    try { const { data } = await api.patch('/account/profile', form); setUser({ ...user, ...data.user }); toast('Profile saved'); } catch (err) { setErrors(err.details || {}); toast(err.message, 'error'); }
  };
  const changePw = async (e) => {
    e.preventDefault(); setErrors({});
    try { await api.post('/account/password', pw); setPw({ current_password: '', new_password: '' }); toast('Password updated'); } catch (err) { setErrors(err.details || {}); toast(err.message, 'error'); }
  };
  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <form onSubmit={save} className="space-y-4 border border-line p-6">
        <h2 className="display text-3xl">Details</h2>
        <Field label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} required />
        <Field label="Email" value={user.email} disabled hint="Contact us to change your email" />
        <Field label="Mobile" type="tel" maxLength={10} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} error={errors.phone} />
        <button className="btn btn-solid">Save</button>
      </form>
      <form onSubmit={changePw} className="space-y-4 border border-line p-6">
        <h2 className="display text-3xl">Password</h2>
        <Field label="Current password" type="password" autoComplete="current-password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} required />
        <Field label="New password" type="password" autoComplete="new-password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} error={errors.new_password} hint="At least 8 characters" required />
        <button className="btn btn-ghost">Update password</button>
      </form>
    </div>
  );
}

function Orders() {
  const [orders, setOrders] = useState(null);
  useEffect(() => { api.get('/orders/mine').then(({ data }) => setOrders(data.orders)).catch(() => setOrders([])); }, []);
  if (!orders) return <Spinner />;
  if (!orders.length) return <Empty title="No orders yet" hindi="बाकाचिकी" action={<Link to="/shop" className="btn btn-solid">Shop the drop</Link>} />;
  return (
    <ul className="divide-y divide-line border-y border-line">
      {orders.map((o) => (
        <li key={o.id}>
          <Link to={`/account/orders/${o.order_number}`} className="group flex flex-wrap items-center gap-4 py-5">
            <div className="flex -space-x-4">
              {o.items.slice(0, 3).map((i) => <img key={i.id} src={asset(i.image_url)} alt="" className="aspect-[5/6] w-14 border border-line bg-panel object-cover" />)}
            </div>
            <div className="min-w-40 flex-1">
              <p className="font-bold group-hover:text-neon">{o.order_number}</p>
              <p className="text-sm text-mute">{formatDate(o.created_at)} · {o.items.reduce((n, i) => n + i.quantity, 0)} items</p>
            </div>
            <div className="flex gap-2"><StatusPill value={o.status} /><StatusPill value={o.payment_status} /></div>
            <p className="w-24 text-right font-bold">{inr(o.total)}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function AccountOrder() {
  const { number } = useParams();
  return <><Link to="/account/orders" className="label mb-6 inline-block text-mute hover:text-neon">← All orders</Link><OrderDetail number={number} /></>;
}

function Wishlist() {
  const { wishlist } = useAuth();
  if (!wishlist.length) return <Empty title="Wishlist is empty" hindi="बाकाचिकी" action={<Link to="/shop" className="btn btn-solid">Find something</Link>}>Tap the heart on any piece to save it here.</Empty>;
  return <div className="grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-5 lg:grid-cols-4">{wishlist.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}</div>;
}

const BLANK = { label: 'Home', name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '', is_default: false };

function Addresses() {
  const { toast } = useUi();
  const [list, setList] = useState(null);
  const [edit, setEdit] = useState(null);
  const [errors, setErrors] = useState({});
  useEffect(() => { api.get('/account/addresses').then(({ data }) => setList(data.addresses)).catch(() => setList([])); }, []);

  const save = async (e) => {
    e.preventDefault(); setErrors({});
    const body = { ...edit }; delete body.id;
    ['user_id', 'created_at', 'updated_at'].forEach((k) => delete body[k]);
    try {
      const { data } = edit.id ? await api.put(`/account/addresses/${edit.id}`, body) : await api.post('/account/addresses', body);
      setList(data.addresses); setEdit(null); toast('Address saved');
    } catch (err) { setErrors(err.details || {}); toast(err.message, 'error'); }
  };
  const del = async (id) => {
    if (!window.confirm('Delete this address?')) return;
    try { setList((await api.delete(`/account/addresses/${id}`)).data.addresses); } catch (err) { toast(err.message, 'error'); }
  };
  const bind = (k) => ({ value: edit?.[k] ?? '', onChange: (e) => setEdit({ ...edit, [k]: e.target.value }), error: errors[k] });

  if (!list) return <Spinner />;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((a) => (
          <div key={a.id} className={`flex flex-col border p-5 ${a.is_default ? 'border-neon' : 'border-line'}`}>
            <p className="label flex items-center justify-between text-mute">{a.label}{a.is_default && <span className="flex items-center gap-1 text-neon"><Star size={12} className="fill-neon" />Default</span>}</p>
            <p className="mt-3 font-bold">{a.name}</p>
            <p className="text-sm text-mute">{a.line1}{a.line2 && `, ${a.line2}`}<br />{a.city}, {a.state} {a.pincode}<br />{a.phone}</p>
            <div className="mt-auto flex gap-4 pt-4">
              <button onClick={() => setEdit({ ...a, line2: a.line2 || '' })} className="label inline-flex items-center gap-1 hover:text-neon"><Pencil size={13} />Edit</button>
              <button onClick={() => del(a.id)} className="label inline-flex items-center gap-1 text-mute hover:text-danger"><Trash2 size={13} />Delete</button>
            </div>
          </div>
        ))}
        <button onClick={() => setEdit({ ...BLANK })} className="grid min-h-48 place-items-center border border-dashed border-line text-mute transition hover:border-neon hover:text-neon">
          <span className="flex flex-col items-center gap-2"><Plus />Add address</span>
        </button>
      </div>
      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?.id ? 'Edit address' : 'New address'}>
        {edit && (
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            <Field label="Label" {...bind('label')} placeholder="Home, Work…" />
            <Field label="Full name" {...bind('name')} required />
            <Field label="Mobile" type="tel" maxLength={10} {...bind('phone')} required className="sm:col-span-2" />
            <Field label="Address line 1" {...bind('line1')} required className="sm:col-span-2" />
            <Field label="Address line 2" {...bind('line2')} className="sm:col-span-2" />
            <Field label="City" {...bind('city')} required />
            <Field label="State" as="select" {...bind('state')} required><option value="">Select</option>{STATES.map((s) => <option key={s}>{s}</option>)}</Field>
            <Field label="Pincode" inputMode="numeric" maxLength={6} {...bind('pincode')} required />
            <label className="flex items-center gap-3 self-end pb-3 text-sm"><input type="checkbox" className="size-4 accent-[#39D353]" checked={Boolean(edit.is_default)} onChange={(e) => setEdit({ ...edit, is_default: e.target.checked })} />Default address</label>
            <button className="btn btn-solid sm:col-span-2">Save address</button>
          </form>
        )}
      </Modal>
    </>
  );
}

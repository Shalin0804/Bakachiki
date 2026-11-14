import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, CreditCard, Banknote, Check } from 'lucide-react';
import { useAuth, useCart, useSettings, useUi } from '../context/store.jsx';
import { api, asset, inr } from '../lib/api.js';
import { useSeo } from '../lib/seo.js';
import { payWithRazorpay } from '../lib/razorpay.js';
import { Page, Field, Empty, Spinner } from '../components/ui.jsx';
import { Summary, getCoupon, setCoupon } from './Cart.jsx';

export const STATES = ['Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'];
const EMPTY = { email: '', name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '' };

export const rememberOrderEmail = (num, email) => { try { sessionStorage.setItem(`bk_order_${num}`, email); } catch { /* ignore */ } };

export default function Checkout() {
  const { cart, refreshCart, reset } = useCart();
  const { user } = useAuth();
  const { payments, settings } = useSettings();
  const { toast } = useUi();
  const navigate = useNavigate();
  const [form, setForm] = useState({ ...EMPTY, email: user?.email || '', name: user?.name || '', phone: user?.phone || '' });
  const [addresses, setAddresses] = useState([]);
  const [method, setMethod] = useState(payments.razorpay ? 'razorpay' : 'cod');
  const [save, setSave] = useState(true);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useSeo({ title: 'Checkout', noindex: true });

  useEffect(() => { refreshCart(getCoupon()).finally(() => setLoaded(true)); }, [refreshCart]);
  useEffect(() => {
    if (!user) return;
    api.get('/account/addresses').then(({ data }) => {
      setAddresses(data.addresses);
      const def = data.addresses.find((a) => a.is_default);
      if (def) pickAddress(def);
    }).catch(() => {});
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickAddress = (a) => setForm((f) => ({ ...f, name: a.name, phone: a.phone, line1: a.line1, line2: a.line2 || '', city: a.city, state: a.state, pincode: a.pincode }));
  const bind = (k) => ({ value: form[k], onChange: (e) => { setForm({ ...form, [k]: e.target.value }); setErrors({ ...errors, [k]: undefined }); }, error: errors[k] });

  const codAllowed = payments.cod && (!settings?.store.cod_max_order || cart.totals.total <= settings.store.cod_max_order);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErrors({});
    try {
      const { data } = await api.post('/orders', { ...form, payment_method: method, coupon_code: cart.coupon?.code || '', save_address: Boolean(user && save) });
      const { order, razorpay } = data;
      rememberOrderEmail(order.order_number, order.email);
      setCoupon('');
      reset();
      const to = `/order/${order.order_number}`;
      if (method === 'razorpay') {
        if (!razorpay) { toast('Payment window failed to open — retry from your order page', 'error'); navigate(to); return; }
        try {
          const result = await payWithRazorpay(razorpay, { orderNumber: order.order_number, email: order.email });
          if (result.dismissed) toast('Payment not completed — you can retry below', 'info');
        } catch (err) { toast(err.message, 'error'); }
      }
      navigate(to, { state: { placed: true } });
    } catch (err) {
      if (err.details) setErrors(err.details);
      toast(err.message, 'error');
      if (err.status === 409) refreshCart(getCoupon());
    } finally { setBusy(false); }
  };

  if (!loaded) return <div className="grid min-h-[70vh] place-items-center"><Spinner /></div>;
  if (!cart.items.length) return <Page className="px-4 pt-36"><Empty title="Nothing to check out" hindi="बाकाचिकी" action={<Link to="/shop" className="btn btn-solid">Shop the drop</Link>} /></Page>;

  return (
    <Page className="mx-auto max-w-[1400px] px-4 pt-28 sm:px-8 lg:pt-32">
      <h1 className="display text-6xl sm:text-8xl">Checkout</h1>
      <p className="mt-2 flex items-center gap-2 text-sm text-mute"><Lock size={14} className="text-neon" />Secure checkout. {!user && <>Have an account? <Link to="/login?next=/checkout" className="text-neon underline">Log in</Link></>}</p>

      <form onSubmit={submit} className="mt-10 grid gap-10 lg:grid-cols-12" noValidate>
        <div className="space-y-10 lg:col-span-7">
          <section aria-labelledby="contact-h">
            <h2 id="contact-h" className="label mb-4 text-neon">01 · Contact</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email" type="email" autoComplete="email" required {...bind('email')} className="sm:col-span-2" />
              <Field label="Full name" autoComplete="name" required {...bind('name')} />
              <Field label="Mobile number" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} placeholder="10-digit mobile" required {...bind('phone')} />
            </div>
          </section>

          <section aria-labelledby="ship-h">
            <h2 id="ship-h" className="label mb-4 text-neon">02 · Shipping address</h2>
            {addresses.length > 0 && (
              <div className="mb-5 grid gap-2 sm:grid-cols-2">
                {addresses.map((a) => {
                  const on = form.line1 === a.line1 && form.pincode === a.pincode;
                  return (
                    <button type="button" key={a.id} onClick={() => pickAddress(a)} aria-pressed={on} className={`border p-3 text-left text-sm transition ${on ? 'border-neon' : 'border-line hover:border-mute'}`}>
                      <span className="label flex items-center justify-between text-mute">{a.label}{on && <Check size={14} className="text-neon" />}</span>
                      <span className="mt-1 block">{a.line1}, {a.city} {a.pincode}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Address line 1" autoComplete="address-line1" required {...bind('line1')} className="sm:col-span-2" />
              <Field label="Address line 2 (optional)" autoComplete="address-line2" {...bind('line2')} className="sm:col-span-2" />
              <Field label="City" autoComplete="address-level2" required {...bind('city')} />
              <Field label="State" as="select" autoComplete="address-level1" required {...bind('state')}>
                <option value="">Select state</option>
                {STATES.map((s) => <option key={s}>{s}</option>)}
              </Field>
              <Field label="Pincode" inputMode="numeric" autoComplete="postal-code" maxLength={6} required {...bind('pincode')} />
            </div>
            {user && <label className="mt-4 flex items-center gap-3 text-sm"><input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} className="size-4 accent-[#39D353]" />Save this address to my account</label>}
          </section>

          <section aria-labelledby="pay-h">
            <h2 id="pay-h" className="label mb-4 text-neon">03 · Payment</h2>
            <div className="grid gap-3" role="radiogroup" aria-labelledby="pay-h">
              {payments.razorpay && <PayOption on={method === 'razorpay'} onClick={() => setMethod('razorpay')} icon={CreditCard} title="Pay online" sub="UPI, cards, netbanking & wallets via Razorpay" />}
              {payments.cod && <PayOption on={method === 'cod'} disabled={!codAllowed} onClick={() => setMethod('cod')} icon={Banknote} title="Cash on Delivery" sub={codAllowed ? 'Pay when your order arrives' : `Available on orders up to ${inr(settings?.store.cod_max_order)}`} />}
              {!payments.razorpay && !payments.cod && <p className="text-danger">Checkout is paused right now. Please contact us.</p>}
            </div>
          </section>
        </div>

        <aside className="lg:col-span-5">
          <div className="sticky top-28 space-y-6 border border-line bg-panel p-6">
            <h2 className="display text-3xl">Your order</h2>
            <ul className="max-h-72 space-y-4 overflow-y-auto pr-1">
              {cart.items.map((i) => (
                <li key={i.id} className="flex gap-3">
                  <div className="relative">
                    <img src={asset(i.product.image)} alt="" className="aspect-[5/6] w-16 border border-line object-cover" />
                    <span className="absolute -right-2 -top-2 grid size-5 place-items-center rounded-full bg-neon text-[0.65rem] font-bold text-ink">{i.quantity}</span>
                  </div>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="truncate font-bold">{i.product.name}</p>
                    <p className="text-mute">{i.color} · {i.size}</p>
                  </div>
                  <p className="text-sm font-bold">{inr(i.unit_price * i.quantity)}</p>
                </li>
              ))}
            </ul>
            <Summary cart={cart} />
            <button disabled={busy || (method === 'cod' && !codAllowed) || (!payments.razorpay && !payments.cod)} className="btn btn-solid w-full">
              {busy ? 'Placing order…' : method === 'razorpay' ? `Pay ${inr(cart.totals.total)}` : `Place order · ${inr(cart.totals.total)}`}
            </button>
            <p className="text-center text-xs text-mute">By placing this order you agree to our {settings?.store.return_days}-day return policy.</p>
          </div>
        </aside>
      </form>
    </Page>
  );
}

function PayOption({ on, onClick, icon: Icon, title, sub, disabled }) {
  return (
    <button type="button" role="radio" aria-checked={on} disabled={disabled} onClick={onClick}
      className={`flex items-center gap-4 border p-4 text-left transition disabled:opacity-40 ${on ? 'border-neon glow-green' : 'border-line hover:border-mute'}`}>
      <span className={`grid size-5 place-items-center rounded-full border-2 ${on ? 'border-neon' : 'border-line'}`}>{on && <span className="size-2.5 rounded-full bg-neon" />}</span>
      <Icon className={on ? 'text-neon' : 'text-mute'} />
      <span><span className="block font-bold">{title}</span><span className="text-sm text-mute">{sub}</span></span>
    </button>
  );
}

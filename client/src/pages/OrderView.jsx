import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Package, Truck, ExternalLink, CreditCard } from 'lucide-react';
import { api, asset, inr, formatDate } from '../lib/api.js';
import { useSeo } from '../lib/seo.js';
import { payWithRazorpay } from '../lib/razorpay.js';
import { useUi } from '../context/store.jsx';
import { Page, Field, Spinner, StatusPill } from '../components/ui.jsx';
import { rememberOrderEmail } from './Checkout.jsx';

const STEPS = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];
const recallEmail = (num) => { try { return sessionStorage.getItem(`bk_order_${num}`) || ''; } catch { return ''; } };

export function OrderDetail({ number, emailHint = '', placed = false }) {
  const { toast } = useUi();
  const [order, setOrder] = useState(null);
  const [email, setEmail] = useState(emailHint || recallEmail(number));
  const [state, setState] = useState('loading'); // loading | ok | locked
  const [paying, setPaying] = useState(false);

  const load = useCallback(async (mail) => {
    setState('loading');
    try {
      const { data } = await api.get(`/orders/${number}`, { params: mail ? { email: mail } : {} });
      setOrder(data.order); setState('ok');
      if (mail) rememberOrderEmail(number, mail);
    } catch { setState('locked'); }
  }, [number]);
  useEffect(() => { load(email); }, [number]); // eslint-disable-line react-hooks/exhaustive-deps

  const retryPay = async () => {
    setPaying(true);
    try {
      const { data } = await api.post(`/orders/${number}/pay`, null, { params: { email: order.email } });
      const res = await payWithRazorpay(data.razorpay, { orderNumber: number, email: order.email });
      if (!res.dismissed) { toast('Payment received — thank you!'); setOrder(res); }
    } catch (e) { toast(e.message, 'error'); } finally { setPaying(false); }
  };

  if (state === 'loading') return <div className="grid h-72 place-items-center"><Spinner /></div>;
  if (state === 'locked') {
    return (
      <form onSubmit={(e) => { e.preventDefault(); load(email.trim()); }} className="mx-auto max-w-md space-y-4 border border-line p-6">
        <h2 className="display text-3xl">Track order {number}</h2>
        <p className="text-sm text-mute">Enter the email used at checkout to view this order.</p>
        <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <button className="btn btn-solid w-full">View order</button>
      </form>
    );
  }

  const cancelled = order.status === 'cancelled';
  const step = STEPS.indexOf(order.status);
  const unpaidOnline = order.payment_method === 'razorpay' && order.payment_status !== 'paid' && !cancelled;

  return (
    <div>
      {placed && !unpaidOnline && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10 border border-neon bg-neon/5 p-6 text-center sm:p-10">
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2 }} className="mx-auto grid size-16 place-items-center rounded-full bg-neon text-ink"><Check size={32} strokeWidth={3} /></motion.span>
          <p className="display mt-5 text-5xl sm:text-6xl">Order locked in</p>
          <p className="hindi mt-1 text-4xl text-green">बाकाचिकी</p>
          <p className="mt-3 text-mute">Confirmation for <b className="text-paper">{order.email}</b>. We’ll update you as it moves.</p>
        </motion.div>
      )}

      {unpaidOnline && (
        <div className="mb-8 flex flex-col items-start justify-between gap-4 border border-warn p-5 sm:flex-row sm:items-center">
          <div><p className="font-bold text-warn">Payment pending</p><p className="text-sm text-mute">Your items are held for 30 minutes. Complete payment to confirm the order.</p></div>
          <button onClick={retryPay} disabled={paying} className="btn btn-solid"><CreditCard size={16} />{paying ? 'Opening…' : `Pay ${inr(order.total)}`}</button>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <p className="label text-mute">Order</p>
          <h2 className="display text-4xl sm:text-5xl">{order.order_number}</h2>
          <p className="mt-1 text-sm text-mute">Placed {formatDate(order.created_at, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <div className="flex gap-2"><StatusPill value={order.status} /><StatusPill value={order.payment_status} /></div>
      </div>

      {!cancelled ? (
        <ol className="my-10 grid grid-cols-5 gap-1" aria-label="Order progress">
          {STEPS.map((s, i) => (
            <li key={s} className="text-center">
              <div className={`h-1.5 ${i <= step ? 'bg-neon' : 'bg-line'}`} />
              <p className={`label mt-3 text-[0.6rem] sm:text-[0.7rem] ${i <= step ? 'text-neon' : 'text-mute'}`}>{s}</p>
            </li>
          ))}
        </ol>
      ) : <p className="my-8 border border-danger/50 p-4 text-danger">This order was cancelled.{order.payment_status === 'paid' ? ' Your refund will be processed to the original payment method.' : ''}</p>}

      {order.tracking_number && (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border border-line p-4">
          <p className="flex items-center gap-3"><Truck className="text-neon" /><span><span className="label block text-mute">{order.tracking_carrier || 'Courier'}</span>{order.tracking_number}</span></p>
          {order.tracking_url && <a href={order.tracking_url} target="_blank" rel="noreferrer" className="btn btn-ghost min-h-10">Track shipment<ExternalLink size={14} /></a>}
        </div>
      )}

      <div className="grid gap-10 lg:grid-cols-12">
        <ul className="divide-y divide-line border-y border-line lg:col-span-7">
          {order.items.map((i) => (
            <li key={i.id} className="flex gap-4 py-4">
              {i.image_url ? <img src={asset(i.image_url)} alt="" className="aspect-[5/6] w-20 border border-line object-cover" /> : <span className="grid aspect-[5/6] w-20 place-items-center border border-line"><Package className="text-mute" /></span>}
              <div className="flex-1 text-sm">
                <p className="font-bold uppercase">{i.name}</p>
                <p className="text-mute">{i.color} · {i.size} · Qty {i.quantity}</p>
              </div>
              <p className="font-bold">{inr(i.unit_price * i.quantity)}</p>
            </li>
          ))}
        </ul>
        <div className="space-y-6 lg:col-span-5">
          <dl className="space-y-2 border border-line p-5 text-sm">
            <div className="flex justify-between"><dt className="text-mute">Subtotal</dt><dd>{inr(order.subtotal)}</dd></div>
            {order.discount > 0 && <div className="flex justify-between"><dt className="text-mute">Discount {order.coupon_code && `(${order.coupon_code})`}</dt><dd className="text-neon">− {inr(order.discount)}</dd></div>}
            <div className="flex justify-between"><dt className="text-mute">Shipping</dt><dd>{order.shipping ? inr(order.shipping) : 'FREE'}</dd></div>
            <div className="flex justify-between border-t border-line pt-3"><dt className="label">Total</dt><dd className="display text-3xl">{inr(order.total)}</dd></div>
            <div className="flex justify-between pt-1"><dt className="text-mute">Payment</dt><dd>{order.payment_method === 'cod' ? 'Cash on Delivery' : 'Online (Razorpay)'}</dd></div>
          </dl>
          <address className="border border-line p-5 text-sm not-italic">
            <p className="label mb-2 text-mute">Shipping to</p>
            <p className="font-bold">{order.name}</p>
            <p>{order.line1}{order.line2 && `, ${order.line2}`}</p>
            <p>{order.city}, {order.state} {order.pincode}</p>
            <p className="mt-1 text-mute">{order.phone}</p>
          </address>
        </div>
      </div>
    </div>
  );
}

export default function OrderView() {
  const { number } = useParams();
  const [sp] = useSearchParams();
  const location = useLocation();
  useSeo({ title: `Order ${number}`, noindex: true });
  return (
    <Page className="mx-auto max-w-6xl px-4 pt-28 sm:px-8 lg:pt-32">
      <OrderDetail number={number} emailHint={sp.get('email') || ''} placed={Boolean(location.state?.placed)} />
      <div className="mt-12 flex flex-wrap gap-3"><Link to="/shop" className="btn btn-ghost">Keep shopping</Link></div>
    </Page>
  );
}

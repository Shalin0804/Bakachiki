import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Printer, Mail, Phone } from 'lucide-react';
import { api, asset, inr, formatDate } from '../lib/api.js';
import { useSettings, useUi } from '../context/store.jsx';
import { Field, PageLoader, StatusPill } from '../components/ui.jsx';
import { PageHead, Card, useFetch, Table, SearchBox, Pager } from './kit.jsx';

const STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
const PAY = ['pending', 'paid', 'failed', 'refunded'];
const when = (d) => formatDate(d, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function OrderList() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [pay, setPay] = useState('');
  const [page, setPage] = useState(1);
  const [data, , loading] = useFetch('/admin/orders', { q, status, payment_status: pay, page });
  return (
    <>
      <PageHead title="Orders">
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Order no, name, email, phone" />
        <select className="field h-11 min-h-0 w-auto py-0 text-sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter by status"><option value="">All statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        <select className="field h-11 min-h-0 w-auto py-0 text-sm" value={pay} onChange={(e) => { setPay(e.target.value); setPage(1); }} aria-label="Filter by payment"><option value="">All payments</option>{PAY.map((s) => <option key={s}>{s}</option>)}</select>
      </PageHead>
      <Table head={['Order', 'Date', 'Customer', 'Items', 'Total', 'Payment', 'Status']} loading={loading && !data}>
        {data?.orders.map((o) => (
          <tr key={o.id} className="hover:bg-panel">
            <td className="px-4 py-3"><Link to={`/admin/orders/${o.id}`} className="font-bold text-neon hover:underline">{o.order_number}</Link></td>
            <td className="whitespace-nowrap px-4 py-3 text-mute">{when(o.created_at)}</td>
            <td className="px-4 py-3">{o.name}<br /><span className="text-xs text-mute">{o.email}</span></td>
            <td className="px-4 py-3">{o.item_count}</td>
            <td className="px-4 py-3 font-bold">{inr(o.total)}</td>
            <td className="px-4 py-3"><StatusPill value={o.payment_status} /><br /><span className="text-xs text-mute">{o.payment_method.toUpperCase()}</span></td>
            <td className="px-4 py-3"><StatusPill value={o.status} /></td>
          </tr>
        ))}
      </Table>
      <Pager page={page} pages={data?.pages} onPage={setPage} />
    </>
  );
}

export function OrderDetail() {
  const { id } = useParams();
  const { toast } = useUi();
  const [order, setOrder] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.get(`/admin/orders/${id}`).then(({ data }) => { setOrder(data.order); setForm(pick(data.order)); }).catch((e) => toast(e.message, 'error'));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (o) => ({ status: o.status, payment_status: o.payment_status, tracking_carrier: o.tracking_carrier || '', tracking_number: o.tracking_number || '', tracking_url: o.tracking_url || '', admin_note: o.admin_note || '' });

  if (!order) return <PageLoader />;
  const save = async (e) => {
    e.preventDefault();
    if (form.status === 'cancelled' && order.status !== 'cancelled' && !window.confirm('Cancel this order? Stock will be returned and coupon usage reversed. This cannot be undone.')) return;
    setBusy(true);
    const body = { ...form };
    if (body.status === order.status) delete body.status;
    if (body.payment_status === order.payment_status) delete body.payment_status;
    try { const { data } = await api.patch(`/admin/orders/${id}`, body); setOrder(data.order); setForm(pick(data.order)); toast('Order updated'); } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  };
  const bind = (k) => ({ value: form[k], onChange: (e) => setForm({ ...form, [k]: e.target.value }) });
  const canMarkPaid = order.payment_method === 'cod' || order.payment_status === 'paid';

  return (
    <>
      <PageHead title={order.order_number}>
        <StatusPill value={order.status} /><StatusPill value={order.payment_status} />
        <Link to={`/admin/orders/${order.id}/invoice`} target="_blank" className="btn btn-ghost min-h-11"><Printer size={15} />Invoice</Link>
      </PageHead>
      <p className="-mt-6 mb-8 text-sm text-mute">Placed {when(order.created_at)} · {order.payment_method === 'cod' ? 'Cash on Delivery' : 'Razorpay'}</p>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Items">
            <ul className="divide-y divide-line">
              {order.items.map((i) => (
                <li key={i.id} className="flex items-center gap-4 py-3">
                  {i.image_url && <img src={asset(i.image_url)} alt="" className="size-14 border border-line object-cover" />}
                  <div className="flex-1 text-sm">
                    <p className="font-bold">{i.product_id ? <Link to={`/admin/products/${i.product_id}`} className="hover:text-neon">{i.name}</Link> : i.name}</p>
                    <p className="text-mute">{i.color} · {i.size} · <span className="font-mono text-xs">{i.sku}</span></p>
                  </div>
                  <p className="text-sm">{inr(i.unit_price)} × {i.quantity}</p>
                  <p className="w-20 text-right font-bold">{inr(i.unit_price * i.quantity)}</p>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-1 border-t border-line pt-4 text-sm">
              <div className="flex justify-between"><dt className="text-mute">Subtotal</dt><dd>{inr(order.subtotal)}</dd></div>
              {order.discount > 0 && <div className="flex justify-between"><dt className="text-mute">Discount ({order.coupon_code})</dt><dd>− {inr(order.discount)}</dd></div>}
              <div className="flex justify-between"><dt className="text-mute">Shipping</dt><dd>{inr(order.shipping)}</dd></div>
              <div className="flex justify-between text-lg font-bold"><dt>Total</dt><dd>{inr(order.total)}</dd></div>
            </dl>
          </Card>
          <Card title="Payments">
            {!order.payments.length ? <p className="text-sm text-mute">No payment attempts.</p> : (
              <ul className="space-y-2 text-sm">
                {order.payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 border border-line p-3">
                    <span>{p.provider.toUpperCase()} {p.provider_order_id && <span className="font-mono text-xs text-mute">{p.provider_order_id}</span>} {p.provider_payment_id && <span className="font-mono text-xs text-neon">{p.provider_payment_id}</span>}</span>
                    <span className="flex items-center gap-3">{inr(p.amount)}<StatusPill value={p.status} /></span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div className="space-y-6">
          <form onSubmit={save}>
            <Card title="Fulfilment">
              <div className="space-y-4">
                <Field label="Order status" as="select" {...bind('status')} disabled={order.status === 'cancelled'}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</Field>
                <Field label="Payment status" as="select" {...bind('payment_status')} hint={order.payment_method === 'razorpay' ? 'Online payments become “paid” only after Razorpay verification.' : 'Mark paid once cash is collected.'}>
                  {PAY.map((s) => <option key={s} disabled={s === 'paid' && !canMarkPaid}>{s}</option>)}
                </Field>
                <Field label="Courier" {...bind('tracking_carrier')} placeholder="Delhivery, Blue Dart…" />
                <Field label="Tracking number" {...bind('tracking_number')} />
                <Field label="Tracking URL" type="url" {...bind('tracking_url')} />
                <Field label="Internal note" as="textarea" rows={3} {...bind('admin_note')} />
                <button disabled={busy} className="btn btn-solid w-full">{busy ? 'Saving…' : 'Update order'}</button>
              </div>
            </Card>
          </form>
          <Card title="Customer">
            <p className="font-bold">{order.name}</p>
            <p className="mt-2 flex items-center gap-2 text-sm"><Mail size={14} className="text-neon" /><a href={`mailto:${order.email}`} className="hover:underline">{order.email}</a></p>
            <p className="mt-1 flex items-center gap-2 text-sm"><Phone size={14} className="text-neon" /><a href={`tel:${order.phone}`}>{order.phone}</a></p>
            <address className="mt-3 text-sm not-italic text-mute">{order.line1}{order.line2 && `, ${order.line2}`}<br />{order.city}, {order.state} {order.pincode}</address>
            {order.user ? <Link to={`/admin/customers/${order.user.id}`} className="label mt-4 inline-block text-neon">View customer →</Link> : <p className="label mt-4 text-mute">Guest checkout</p>}
          </Card>
        </div>
      </div>
    </>
  );
}

export function Invoice() {
  const { id } = useParams();
  const { settings } = useSettings();
  const [data] = useFetch(`/admin/orders/${id}`);
  useEffect(() => { if (data) setTimeout(() => window.print(), 400); }, [data]);
  if (!data) return <PageLoader />;
  const o = data.order;
  const c = settings?.contact || {};
  return (
    <div className="min-h-dvh bg-white p-8 text-black">
      <div className="mx-auto max-w-3xl">
        <div className="no-print mb-6 flex gap-2"><button onClick={() => window.print()} className="border border-black px-4 py-2 text-sm font-bold">Print</button></div>
        <div className="flex justify-between border-b-2 border-black pb-6">
          <div><p className="display text-4xl">BAKA<span className="text-[#168A32]">CHIKI</span></p><p className="mt-1 text-sm">{c.address}<br />{c.email} · {c.phone}</p></div>
          <div className="text-right text-sm"><p className="display text-3xl">Invoice</p><p>#{o.order_number}</p><p>{formatDate(o.created_at)}</p><p className="mt-1 uppercase">{o.payment_method} · {o.payment_status}</p></div>
        </div>
        <div className="mt-6 text-sm"><p className="font-bold uppercase">Bill / ship to</p><p>{o.name}<br />{o.line1}{o.line2 && `, ${o.line2}`}<br />{o.city}, {o.state} {o.pincode}<br />{o.phone} · {o.email}</p></div>
        <table className="mt-8 w-full text-left text-sm">
          <thead><tr className="border-b-2 border-black"><th className="py-2">Item</th><th>SKU</th><th className="text-right">Qty</th><th className="text-right">Rate</th><th className="text-right">Amount</th></tr></thead>
          <tbody>{o.items.map((i) => <tr key={i.id} className="border-b border-gray-300"><td className="py-2">{i.name}<br /><span className="text-xs text-gray-600">{i.color} · {i.size}</span></td><td className="font-mono text-xs">{i.sku}</td><td className="text-right">{i.quantity}</td><td className="text-right">{inr(i.unit_price)}</td><td className="text-right">{inr(i.unit_price * i.quantity)}</td></tr>)}</tbody>
        </table>
        <dl className="ml-auto mt-6 w-64 space-y-1 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{inr(o.subtotal)}</dd></div>
          {o.discount > 0 && <div className="flex justify-between"><dt>Discount ({o.coupon_code})</dt><dd>− {inr(o.discount)}</dd></div>}
          <div className="flex justify-between"><dt>Shipping</dt><dd>{inr(o.shipping)}</dd></div>
          <div className="flex justify-between border-t-2 border-black pt-2 text-lg font-bold"><dt>Total</dt><dd>{inr(o.total)}</dd></div>
        </dl>
        <p className="mt-12 text-center text-xs text-gray-600">Prices are inclusive of applicable taxes. Thank you for wearing BAKACHIKI.</p>
      </div>
    </div>
  );
}

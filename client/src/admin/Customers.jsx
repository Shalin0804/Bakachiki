import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { inr, formatDate } from '../lib/api.js';
import { PageLoader, StatusPill } from '../components/ui.jsx';
import { PageHead, Card, useFetch, Table, SearchBox, Pager } from './kit.jsx';

export function CustomerList() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, , loading] = useFetch('/admin/customers', { q, page });
  return (
    <>
      <PageHead title="Customers"><SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Name, email or phone" /></PageHead>
      <Table head={['Name', 'Email', 'Phone', 'Orders', 'Total spent', 'Joined']} loading={loading && !data}>
        {data?.customers.map((c) => (
          <tr key={c.id} className="hover:bg-panel">
            <td className="px-4 py-3"><Link to={`/admin/customers/${c.id}`} className="font-bold hover:text-neon">{c.name}</Link></td>
            <td className="px-4 py-3 text-mute">{c.email}</td>
            <td className="px-4 py-3 text-mute">{c.phone || '—'}</td>
            <td className="px-4 py-3">{c.order_count}</td>
            <td className="px-4 py-3 font-bold">{inr(c.total_spent)}</td>
            <td className="px-4 py-3 text-mute">{formatDate(c.created_at)}</td>
          </tr>
        ))}
      </Table>
      <Pager page={page} pages={data?.pages} onPage={setPage} />
    </>
  );
}

export function CustomerDetail() {
  const { id } = useParams();
  const [data, , loading, error] = useFetch(`/admin/customers/${id}`);
  if (loading && !data) return <PageLoader />;
  if (error) return <p className="text-danger">{error}</p>;
  const { customer: c, orders } = data;
  const spent = orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0);
  return (
    <>
      <PageHead title={c.name} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card title="Information">
            <dl className="space-y-2 text-sm">
              <div><dt className="text-mute">Email</dt><dd><a href={`mailto:${c.email}`} className="hover:text-neon">{c.email}</a></dd></div>
              <div><dt className="text-mute">Phone</dt><dd>{c.phone || '—'}</dd></div>
              <div><dt className="text-mute">Joined</dt><dd>{formatDate(c.created_at)}</dd></div>
              <div><dt className="text-mute">Lifetime spend</dt><dd className="display text-3xl text-neon">{inr(spent)}</dd></div>
            </dl>
          </Card>
          <Card title="Saved addresses">
            {!c.addresses.length ? <p className="text-sm text-mute">None saved.</p> : c.addresses.map((a) => (
              <address key={a.id} className="mb-3 border-b border-line pb-3 text-sm not-italic last:border-0">
                <p className="label text-mute">{a.label}{a.is_default && ' · default'}</p>{a.name}, {a.phone}<br />{a.line1}{a.line2 && `, ${a.line2}`}<br />{a.city}, {a.state} {a.pincode}
              </address>
            ))}
          </Card>
        </div>
        <div className="lg:col-span-2">
          <h2 className="label mb-3 text-mute">Order history ({orders.length})</h2>
          <Table head={['Order', 'Date', 'Items', 'Total', 'Payment', 'Status']} empty="No orders yet.">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-panel">
                <td className="px-4 py-3"><Link to={`/admin/orders/${o.id}`} className="font-bold text-neon hover:underline">{o.order_number}</Link></td>
                <td className="px-4 py-3 text-mute">{formatDate(o.created_at)}</td>
                <td className="px-4 py-3">{o.items.reduce((n, i) => n + i.quantity, 0)}</td>
                <td className="px-4 py-3">{inr(o.total)}</td>
                <td className="px-4 py-3"><StatusPill value={o.payment_status} /></td>
                <td className="px-4 py-3"><StatusPill value={o.status} /></td>
              </tr>
            ))}
          </Table>
        </div>
      </div>
    </>
  );
}

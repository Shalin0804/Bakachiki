import { useState } from 'react';
import { Link } from 'react-router-dom';
import { IndianRupee, ShoppingCart, Shirt, Users, Clock, AlertTriangle } from 'lucide-react';
import { inr, formatDate } from '../lib/api.js';
import { StatusPill, PageLoader } from '../components/ui.jsx';
import { PageHead, Card, useFetch, Table } from './kit.jsx';

export default function Dashboard() {
  const [data, , loading, error] = useFetch('/admin/stats');
  if (loading && !data) return <PageLoader />;
  if (error) return <p className="text-danger">{error}</p>;
  const t = data.totals;
  const tiles = [
    ['Total revenue', inr(t.revenue), IndianRupee, 'Paid orders'], ['Total orders', t.orders, ShoppingCart], ['Products', t.products, Shirt],
    ['Customers', t.customers, Users], ['Pending orders', t.pending_orders, Clock, 'Pending · confirmed · processing'],
  ];
  return (
    <>
      <PageHead title="Dashboard"><Link to="/admin/products/new" className="btn btn-solid min-h-11">Add product</Link></PageHead>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {tiles.map(([label, value, Icon, sub]) => (
          <div key={label} className="border border-line bg-panel p-4">
            <p className="label flex items-center gap-2 text-mute"><Icon size={14} className="text-neon" />{label}</p>
            <p className="display mt-3 text-3xl sm:text-4xl">{value}</p>
            {sub && <p className="mt-1 text-xs text-mute">{sub}</p>}
          </div>
        ))}
      </div>

      <Card title="Sales overview · last 30 days (excl. cancelled)" className="mt-6"><SalesChart sales={data.sales} /></Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="label mb-3 text-mute">Recent orders</h2>
          <Table head={['Order', 'Customer', 'Total', 'Status', 'Payment', 'Date']} empty="No orders yet.">
            {data.recent_orders.map((o) => (
              <tr key={o.id} className="hover:bg-panel">
                <td className="px-4 py-3"><Link to={`/admin/orders/${o.id}`} className="font-bold text-neon hover:underline">{o.order_number}</Link></td>
                <td className="px-4 py-3">{o.name}</td>
                <td className="px-4 py-3">{inr(o.total)}</td>
                <td className="px-4 py-3"><StatusPill value={o.status} /></td>
                <td className="px-4 py-3"><StatusPill value={o.payment_status} /> <span className="text-xs text-mute">{o.payment_method.toUpperCase()}</span></td>
                <td className="whitespace-nowrap px-4 py-3 text-mute">{formatDate(o.created_at)}</td>
              </tr>
            ))}
          </Table>
        </div>
        <div className="space-y-6">
          <Card title="Orders by status">
            <ul className="space-y-2 text-sm">
              {Object.entries(data.by_status).map(([s, n]) => <li key={s} className="flex justify-between"><StatusPill value={s} /><span className="font-bold">{n}</span></li>)}
              {!Object.keys(data.by_status).length && <li className="text-mute">No orders yet.</li>}
            </ul>
          </Card>
          <Card title="Low stock (≤ 5)">
            <ul className="space-y-2 text-sm">
              {data.low_stock.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2">
                  <Link to={`/admin/products/${v.product?.id}`} className="truncate hover:text-neon"><AlertTriangle size={13} className="mr-1 inline text-warn" />{v.product?.name} · {v.color} {v.size}</Link>
                  <span className={`font-bold ${v.stock ? 'text-warn' : 'text-danger'}`}>{v.stock}</span>
                </li>
              ))}
              {!data.low_stock.length && <li className="text-mute">All variants well stocked.</li>}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

/** Single-series daily revenue bars with hover tooltip and a screen-reader table. */
function SalesChart({ sales }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...sales.map((d) => d.total));
  const W = 900; const H = 220; const pad = { l: 56, b: 26, t: 10 };
  const bw = (W - pad.l) / sales.length;
  const ticks = [0, 0.5, 1].map((k) => Math.round(max * k));
  const y = (v) => H - pad.b - ((H - pad.b - pad.t) * v) / max;
  const total = sales.reduce((s, d) => s + d.total, 0);
  const h = hover != null ? sales[hover] : null;
  return (
    <div>
      <p className="mb-3 text-sm text-mute">30-day total <b className="text-paper">{inr(total)}</b> · {sales.reduce((s, d) => s + d.orders, 0)} orders</p>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Daily revenue bar chart for the last 30 days" onMouseLeave={() => setHover(null)}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={pad.l} x2={W} y1={y(v)} y2={y(v)} stroke="#252B25" strokeWidth="1" />
              <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#A5A5A5">{v >= 1000 ? `₹${(v / 1000).toFixed(1)}k` : `₹${v}`}</text>
            </g>
          ))}
          {sales.map((d, i) => {
            const x = pad.l + i * bw + 1; const w = Math.max(2, bw - 2); const top = y(d.total); const bh = H - pad.b - top;
            return (
              <g key={d.day} onMouseEnter={() => setHover(i)}>
                <rect x={pad.l + i * bw} y={pad.t} width={bw} height={H - pad.b - pad.t} fill="transparent" />
                {d.total > 0 && <path d={`M${x},${H - pad.b} V${top + Math.min(4, bh)} q0,-${Math.min(4, bh)} ${Math.min(4, w / 2)},-${Math.min(4, bh)} H${x + w - Math.min(4, w / 2)} q${Math.min(4, w / 2)},0 ${Math.min(4, w / 2)},${Math.min(4, bh)} V${H - pad.b} Z`} fill={hover === i ? '#39D353' : '#168A32'} />}
                {i % 5 === 0 && <text x={x + w / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#A5A5A5">{d.day.slice(8)}/{d.day.slice(5, 7)}</text>}
              </g>
            );
          })}
        </svg>
        {h && (
          <div className="pointer-events-none absolute top-0 border border-line bg-ink px-3 py-2 text-xs shadow-xl" style={{ left: `clamp(0px, calc(${((pad.l + hover * bw) / W) * 100}% - 60px), calc(100% - 140px))` }}>
            <p className="text-mute">{formatDate(h.day)}</p>
            <p className="font-bold">{inr(h.total)}</p>
            <p className="text-mute">{h.orders} order{h.orders === 1 ? '' : 's'}</p>
          </div>
        )}
      </div>
      <table className="sr-only"><caption>Daily revenue</caption><thead><tr><th>Day</th><th>Revenue</th><th>Orders</th></tr></thead>
        <tbody>{sales.map((d) => <tr key={d.day}><td>{d.day}</td><td>{d.total}</td><td>{d.orders}</td></tr>)}</tbody></table>
    </div>
  );
}

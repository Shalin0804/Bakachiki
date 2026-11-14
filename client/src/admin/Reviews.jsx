import { Trash2, Eye, EyeOff } from 'lucide-react';
import { api, formatDate } from '../lib/api.js';
import { useUi } from '../context/store.jsx';
import { Stars } from '../components/ui.jsx';
import { PageHead, useFetch, Table } from './kit.jsx';

export default function Reviews() {
  const { toast } = useUi();
  const [data, reload, loading] = useFetch('/admin/reviews');
  const act = async (fn) => { try { await fn(); reload(); } catch (e) { toast(e.message, 'error'); } };
  return (
    <>
      <PageHead title="Reviews" />
      <Table head={['Product', 'Customer', 'Rating', 'Review', 'Date', 'Visible', '']} loading={loading && !data} empty="No reviews yet.">
        {data?.reviews.map((r) => (
          <tr key={r.id} className="align-top hover:bg-panel">
            <td className="px-4 py-3"><a href={`/product/${r.product?.slug}`} target="_blank" rel="noreferrer" className="hover:text-neon">{r.product?.name}</a></td>
            <td className="px-4 py-3">{r.user?.name}<br /><span className="text-xs text-mute">{r.user?.email}</span></td>
            <td className="px-4 py-3"><Stars value={r.rating} /></td>
            <td className="max-w-sm px-4 py-3"><p className="font-bold">{r.title}</p><p className="text-mute">{r.body}</p></td>
            <td className="whitespace-nowrap px-4 py-3 text-mute">{formatDate(r.created_at)}</td>
            <td className="px-4 py-3">{r.is_approved ? <span className="text-neon">Yes</span> : <span className="text-mute">Hidden</span>}</td>
            <td className="px-4 py-3">
              <div className="flex gap-1">
                <button onClick={() => act(() => api.patch(`/admin/reviews/${r.id}`, { is_approved: !r.is_approved }))} aria-label={r.is_approved ? 'Hide review' : 'Show review'} className="grid size-9 place-items-center hover:text-neon">{r.is_approved ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                <button onClick={() => window.confirm('Delete this review?') && act(() => api.delete(`/admin/reviews/${r.id}`))} aria-label="Delete review" className="grid size-9 place-items-center text-mute hover:text-danger"><Trash2 size={15} /></button>
              </div>
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}

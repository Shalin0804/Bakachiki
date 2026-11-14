import { useState } from 'react';
import { api, formatDate } from '../lib/api.js';
import { useUi } from '../context/store.jsx';
import { Field, Modal } from '../components/ui.jsx';
import { PageHead, Card, useFetch, Table } from './kit.jsx';
import { useAdmin } from './AdminApp.jsx';

const ROLE_LABEL = { admin: 'Admin', super_admin: 'Super admin' };
const blank = { name: '', email: '', password: '', role: 'admin' };

// Super admin only (the server enforces this too): create staff, change roles, deactivate, reset passwords.
export function Staff() {
  const { user: me } = useAdmin();
  const { toast } = useUi();
  const [data, reload, loading] = useFetch('/admin/staff');
  const [form, setForm] = useState(null);
  const [reset, setReset] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const run = async (fn, done) => {
    setBusy(true); setErrors({});
    try { await fn(); toast(done); reload(); return true; } catch (e) { setErrors(e.details || {}); toast(e.message, 'error'); return false; } finally { setBusy(false); }
  };
  const patch = (u, body, done) => run(() => api.patch(`/admin/staff/${u.id}`, body), done);

  return (
    <>
      <PageHead title="Staff & roles">
        <button className="btn btn-solid min-h-11" onClick={() => { setErrors({}); setForm(blank); }}>Add staff member</button>
      </PageHead>
      <p className="mb-4 max-w-2xl text-sm text-mute">Admins run the store. Super admins can also add, remove and promote staff. Nobody can sign up as staff from the website, and staff sign in only at /admin/login.</p>
      <Table head={['Name', 'Email', 'Role', 'Status', 'Added', '']} loading={loading && !data}>
        {(data?.staff || []).map((u) => {
          const self = u.id === me.id;
          return (
            <tr key={u.id} className={u.is_active ? '' : 'opacity-60'}>
              <td className="px-4 py-3 font-medium">{u.name}{self && <span className="ml-2 text-xs text-neon">(you)</span>}</td>
              <td className="px-4 py-3 text-mute">{u.email}</td>
              <td className="px-4 py-3">
                <select aria-label={`Role for ${u.email}`} className="field h-9 min-h-0 w-36 py-1 text-sm" value={u.role} disabled={self || busy}
                  onChange={(e) => patch(u, { role: e.target.value }, `${u.name} is now ${ROLE_LABEL[e.target.value]}`)}>
                  {Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </td>
              <td className={`px-4 py-3 text-xs font-bold uppercase tracking-wider ${u.is_active ? 'text-neon' : 'text-danger'}`}>{u.is_active ? 'Active' : 'Disabled'}</td>
              <td className="whitespace-nowrap px-4 py-3 text-mute">{formatDate(u.created_at)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-right">
                <button className="chip mr-1 h-9 hover:border-neon" onClick={() => { setErrors({}); setReset({ user: u, password: '' }); }}>Reset password</button>
                {!self && (
                  <button className="chip h-9 hover:border-neon" disabled={busy} onClick={() => patch(u, { is_active: !u.is_active }, u.is_active ? `${u.name} disabled` : `${u.name} re-enabled`)}>
                    {u.is_active ? 'Disable' : 'Enable'}
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </Table>

      <Modal open={Boolean(form)} onClose={() => setForm(null)} title="Add staff member">
        {form && (
          <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); if (await run(() => api.post('/admin/staff', form), `${form.name} added`)) setForm(null); }}>
            <Field label="Name" required value={form.name} error={errors.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Field label="Email" type="email" required autoComplete="off" value={form.email} error={errors.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Field label="Temporary password" type="password" required autoComplete="new-password" hint="At least 8 characters. Share it privately; they can change it after signing in." value={form.password} error={errors.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <Field label="Role" as="select" value={form.role} error={errors.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Field>
            <button className="btn btn-solid w-full" disabled={busy}>{busy ? 'Saving…' : 'Create account'}</button>
          </form>
        )}
      </Modal>

      <Modal open={Boolean(reset)} onClose={() => setReset(null)} title={reset ? `Reset password — ${reset.user.name}` : ''}>
        {reset && (
          <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); if (await patch(reset.user, { password: reset.password }, 'Password reset')) setReset(null); }}>
            <Field label="New password" type="password" required autoComplete="new-password" value={reset.password} error={errors.password} onChange={(e) => setReset({ ...reset, password: e.target.value })} />
            <button className="btn btn-solid w-full" disabled={busy}>{busy ? 'Saving…' : 'Set password'}</button>
          </form>
        )}
      </Modal>
    </>
  );
}

export function MyPassword() {
  const { toast } = useUi();
  const [form, setForm] = useState({ current_password: '', new_password: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErrors({});
    try { await api.post('/auth/admin/password', form); toast('Password updated'); setForm({ current_password: '', new_password: '' }); } catch (err) { setErrors(err.details || {}); toast(err.message, 'error'); } finally { setBusy(false); }
  };
  return (
    <>
      <PageHead title="Change password" />
      <Card className="max-w-md">
        <form className="space-y-4" onSubmit={submit}>
          <Field label="Current password" type="password" autoComplete="current-password" required value={form.current_password} error={errors.current_password} onChange={(e) => setForm({ ...form, current_password: e.target.value })} />
          <Field label="New password" type="password" autoComplete="new-password" required hint="At least 8 characters." value={form.new_password} error={errors.new_password} onChange={(e) => setForm({ ...form, new_password: e.target.value })} />
          <button className="btn btn-solid w-full" disabled={busy}>{busy ? 'Saving…' : 'Update password'}</button>
        </form>
      </Card>
    </>
  );
}

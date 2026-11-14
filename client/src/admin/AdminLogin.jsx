import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Lock, ArrowRight, ExternalLink } from 'lucide-react';
import { useSeo } from '../lib/seo.js';
import { Field } from '../components/ui.jsx';
import { useAdmin } from './AdminApp.jsx';

// Staff-only sign-in. No sign-up or password reset here: accounts are created by a super admin.
export default function AdminLogin() {
  const { user, login } = useAdmin();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useSeo({ title: 'Admin sign in', noindex: true });

  // Only follow in-panel redirects, never an arbitrary URL from the query string.
  const next = params.get('next');
  const target = next && next.startsWith('/admin/') && !next.startsWith('/admin/login') ? next : '/admin/dashboard';
  if (user) return <Navigate to={target} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await login(form); navigate(target, { replace: true }); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <main className="grain relative isolate grid min-h-dvh overflow-hidden bg-ink lg:grid-cols-[1.15fr_1fr]">
      {/* brand side */}
      <section aria-hidden="true" className="relative hidden overflow-hidden border-r border-line lg:block">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(37,43,37,.45)_1px,transparent_1px),linear-gradient(to_bottom,rgba(37,43,37,.45)_1px,transparent_1px)] bg-[size:64px_64px]" />
        <div className="absolute -left-24 bottom-[-20%] size-[70vmin] rounded-full bg-green/30 blur-[120px]" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <p className="label flex items-center gap-2 text-neon"><span className="size-2 animate-pulse rounded-full bg-neon" />Control room · Staff only</p>
          <div>
            <motion.p initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.2, 0.9, 0.1, 1] }}
              className="hindi text-[9vw] leading-none text-green">बाकाचिकी</motion.p>
            <motion.p initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15, duration: 0.9, ease: [0.2, 0.9, 0.1, 1] }}
              className="display outline-text -ml-1 text-[11vw] leading-[0.85]">BAKACHIKI</motion.p>
            <p className="display mt-2 text-4xl text-paper/90">ADMIN CONSOLE</p>
          </div>
          <p className="max-w-sm text-sm text-mute">Products, orders, stock and the storefront — all from here. Every action is tied to your account.</p>
        </div>
      </section>

      {/* form side */}
      <section className="relative flex flex-col justify-center px-5 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-10 lg:hidden">
            <p className="hindi text-5xl leading-none text-green" aria-hidden="true">बाकाचिकी</p>
            <p className="display text-5xl">BAKA<span className="text-neon">CHIKI</span></p>
            <p className="label mt-2 text-mute">Admin console</p>
          </div>

          <div className="mb-8 flex items-center gap-3">
            <span className="grid size-11 place-items-center border border-neon/50 bg-green/15 text-neon"><Lock size={18} /></span>
            <div>
              <h1 className="display text-4xl">Staff sign in</h1>
              <p className="text-sm text-mute">Use the account your super admin gave you.</p>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-5 border border-line bg-panel p-6 sm:p-8" noValidate>
            {error && <p role="alert" className="border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
            <Field label="Work email" type="email" autoComplete="username" required autoFocus value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <div className="relative">
              <Field label="Password" type={show ? 'text' : 'password'} autoComplete="current-password" required value={form.password} style={{ paddingRight: '3rem' }}
                onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}
                className="absolute bottom-0 right-0 grid h-12 w-12 place-items-center text-mute hover:text-neon">
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <button className="btn btn-solid w-full" disabled={busy || !form.email || !form.password}>
              {busy ? 'Signing in…' : <>Enter console<ArrowRight size={16} /></>}
            </button>
            <p className="text-xs text-mute">Forgot your password? Ask a super admin to reset it from <span className="text-paper">Staff &amp; roles</span>.</p>
          </form>

          <Link to="/" className="mt-8 inline-flex items-center gap-2 text-sm text-mute hover:text-neon"><ExternalLink size={14} />Back to the store</Link>
        </div>
      </section>
    </main>
  );
}

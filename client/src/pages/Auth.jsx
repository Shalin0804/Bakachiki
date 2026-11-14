import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth, useUi } from '../context/store.jsx';
import { api } from '../lib/api.js';
import { useSeo } from '../lib/seo.js';
import { Page, Field, MaskText } from '../components/ui.jsx';

const COPY = {
  login: { title: 'Welcome back', hindi: 'फिर से', cta: 'Log in' },
  register: { title: 'Join the gang', hindi: 'स्वागत है', cta: 'Create account' },
  forgot: { title: 'Forgot password', hindi: 'भूल गए?', cta: 'Send reset link' },
  reset: { title: 'New password', hindi: 'नया', cta: 'Set password' },
};

export default function Auth({ mode }) {
  const { login, register, startSession } = useAuth();
  const { toast } = useUi();
  const navigate = useNavigate();
  const { token } = useParams();
  const [sp] = useSearchParams();
  const next = sp.get('next')?.startsWith('/') ? sp.get('next') : null;
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState('');
  const [show, setShow] = useState(false);
  const c = COPY[mode];
  useSeo({ title: c.title, noindex: true });

  const bind = (k) => ({ value: form[k], onChange: (e) => { setForm({ ...form, [k]: e.target.value }); setErrors({ ...errors, [k]: undefined }); }, error: errors[k] });

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErrors({});
    try {
      if (mode === 'login' || mode === 'register') {
        const u = mode === 'login' ? await login({ email: form.email, password: form.password }) : await register(form);
        toast(mode === 'login' ? `Hey ${u.name.split(' ')[0]}!` : 'Account created — welcome to BAKACHIKI');
        navigate(next || (u.role === 'admin' ? '/admin' : '/account'), { replace: true });
      } else if (mode === 'forgot') {
        const { data } = await api.post('/auth/forgot-password', { email: form.email });
        setSent(data.message);
      } else {
        const { data } = await api.post('/auth/reset-password', { token, password: form.password });
        await startSession(data);
        toast('Password updated');
        navigate('/account', { replace: true });
      }
    } catch (err) {
      if (err.details) setErrors(err.details);
      toast(err.message, 'error');
    } finally { setBusy(false); }
  };

  const passwordField = (
    <div className="relative">
      <Field label={mode === 'reset' ? 'New password' : 'Password'} type={show ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={mode === 'login' ? 1 : 8} {...bind('password')} hint={mode !== 'login' ? 'At least 8 characters' : undefined} />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-3 top-9 grid size-8 place-items-center text-mute hover:text-neon">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
    </div>
  );

  return (
    <Page className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden border-r border-line bg-panel lg:block">
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_30%_70%,rgba(57,211,83,.25),transparent_55%)]" />
        <div className="absolute inset-0 flex flex-col justify-end p-12">
          <p className="hindi text-[11rem] leading-none text-green">{c.hindi}</p>
          <p className="display text-8xl">BAKA<span className="outline-text">CHIKI</span></p>
        </div>
      </div>
      <div className="flex items-center justify-center px-5 pb-16 pt-32">
        <div className="w-full max-w-md">
          <MaskText as="h1" lines={[c.title]} className="display text-5xl sm:text-6xl" inView={false} />
          {sent ? (
            <div className="mt-8 border border-neon p-5"><p>{sent}</p><p className="mt-2 text-sm text-mute">Check your inbox (and spam). The link works for one hour.</p></div>
          ) : (
            <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
              {mode === 'register' && <Field label="Name" autoComplete="name" required {...bind('name')} />}
              {mode !== 'reset' && <Field label="Email" type="email" autoComplete="email" required {...bind('email')} />}
              {mode === 'register' && <Field label="Mobile (optional)" type="tel" inputMode="numeric" maxLength={10} autoComplete="tel-national" {...bind('phone')} />}
              {(mode === 'login' || mode === 'register' || mode === 'reset') && passwordField}
              {mode === 'login' && <Link to="/forgot-password" className="label block text-right text-mute hover:text-neon">Forgot password?</Link>}
              <button disabled={busy} className="btn btn-solid w-full">{busy ? 'One sec…' : c.cta}</button>
            </form>
          )}
          <p className="mt-8 text-sm text-mute">
            {mode === 'login' && <>New here? <Link to={`/register${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="text-neon underline">Create an account</Link></>}
            {mode === 'register' && <>Already have an account? <Link to={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="text-neon underline">Log in</Link></>}
            {(mode === 'forgot' || mode === 'reset') && <Link to="/login" className="text-neon underline">Back to log in</Link>}
          </p>
        </div>
      </div>
    </Page>
  );
}

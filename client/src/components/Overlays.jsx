// App-wide overlays: intro loader, fly-to-bag image, toasts, desktop cursor.
import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useSpring } from 'framer-motion';
import { CheckCircle2, Info, AlertTriangle } from 'lucide-react';
import { useUi } from '../context/store.jsx';
import { asset } from '../lib/api.js';

/** Green logo reveal, shown once per browser session. */
export function Loader({ ready }) {
  const [seen] = useState(() => { try { return sessionStorage.getItem('bk_intro') === '1'; } catch { return true; } });
  const [minDone, setMinDone] = useState(seen);
  useEffect(() => {
    if (seen) return undefined;
    const t = setTimeout(() => { setMinDone(true); try { sessionStorage.setItem('bk_intro', '1'); } catch { /* ignore */ } }, 1700);
    return () => clearTimeout(t);
  }, [seen]);
  const show = !(ready && minDone);
  return (
    <AnimatePresence>
      {show && (
        <motion.div className="fixed inset-0 z-[100] grid place-items-center bg-ink" exit={{ clipPath: 'inset(0 0 100% 0)' }} transition={{ duration: 0.8, ease: [0.7, 0, 0.2, 1] }} aria-label="Loading BAKACHIKI" role="status">
          <div className="text-center">
            <div className="display flex overflow-hidden text-6xl sm:text-8xl">
              {'BAKACHIKI'.split('').map((ch, i) => (
                <motion.span key={i} initial={{ y: '110%' }} animate={{ y: 0, color: i >= 4 ? '#39D353' : '#FFFFFF' }} transition={{ delay: 0.08 * i, duration: 0.6, ease: [0.2, 0.9, 0.1, 1] }}>{ch}</motion.span>
              ))}
            </div>
            <motion.p className="hindi mt-2 text-4xl text-green" initial={{ opacity: 0, letterSpacing: '0.6em' }} animate={{ opacity: 1, letterSpacing: '0.05em' }} transition={{ delay: 0.75, duration: 0.8 }}>बाकाचिकी</motion.p>
            <motion.div className="mx-auto mt-6 h-0.5 bg-neon" initial={{ width: 0 }} animate={{ width: 220 }} transition={{ delay: 0.3, duration: 1.3, ease: 'easeInOut' }} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function FlyToBag() {
  const { flyer, landed } = useUi();
  if (!flyer) return null;
  const { from, to, src, id } = flyer;
  const size = Math.min(from.width, 160);
  return (
    <motion.img
      key={id} src={asset(src)} alt="" aria-hidden="true"
      className="pointer-events-none fixed z-[95] border-2 border-neon object-cover shadow-[0_0_40px_rgba(57,211,83,.6)]"
      style={{ width: size, height: size * 1.2, left: 0, top: 0 }}
      initial={{ x: from.left + from.width / 2 - size / 2, y: from.top + from.height / 2 - size * 0.6, scale: 1, opacity: 1, rotate: 0 }}
      animate={{ x: [null, (from.left + to.left) / 2, to.left + to.width / 2 - size / 2], y: [null, Math.min(from.top, to.top) - 120, to.top + to.height / 2 - size * 0.6], scale: [1, 0.6, 0.08], opacity: [1, 1, 0.3], rotate: [0, -12, 8] }}
      transition={{ duration: 0.85, ease: [0.5, 0, 0.3, 1] }}
      onAnimationComplete={landed}
    />
  );
}

export function Toasts() {
  const { toasts } = useUi();
  const icon = { ok: CheckCircle2, info: Info, error: AlertTriangle };
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[96] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end sm:px-6" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = icon[t.tone] || CheckCircle2;
          return (
            <motion.div key={t.id} layout initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ x: 60, opacity: 0 }}
              className={`pointer-events-auto flex items-center gap-3 border bg-panel px-4 py-3 text-sm shadow-2xl ${t.tone === 'error' ? 'border-danger' : 'border-neon'}`}>
              <Icon size={18} className={t.tone === 'error' ? 'text-danger' : 'text-neon'} />{t.message}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/** Desktop-only cursor ring that grows over interactive elements. Native cursor stays visible for usability. */
export function Cursor() {
  const [enabled] = useState(() => window.matchMedia('(hover: hover) and (pointer: fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [hover, setHover] = useState(false);
  const x = useMotionValue(-100); const y = useMotionValue(-100);
  const sx = useSpring(x, { stiffness: 500, damping: 40 }); const sy = useSpring(y, { stiffness: 500, damping: 40 });
  useEffect(() => {
    if (!enabled) return undefined;
    const move = (e) => { x.set(e.clientX); y.set(e.clientY); setHover(Boolean(e.target.closest?.('a,button,[role="button"],input,select,textarea,label'))); };
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }, [enabled, x, y]);
  if (!enabled) return null;
  return (
    <motion.div aria-hidden="true" className="pointer-events-none fixed left-0 top-0 z-[99] rounded-full border border-neon mix-blend-difference"
      style={{ x: sx, y: sy, translateX: '-50%', translateY: '-50%' }} animate={{ width: hover ? 46 : 14, height: hover ? 46 : 14, backgroundColor: hover ? 'rgba(57,211,83,0.15)' : 'rgba(57,211,83,0)' }} />
  );
}

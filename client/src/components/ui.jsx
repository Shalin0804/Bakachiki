import { useEffect, useId, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Star } from 'lucide-react';
import { inr } from '../lib/api.js';

const EASE = [0.2, 0.9, 0.1, 1];

/** Page enter/exit wrapper used by every route. */
export const Page = ({ children, className = '' }) => (
  <motion.main
    id="main"
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.45, ease: EASE }}
    className={className}
  >
    {children}
  </motion.main>
);

/** Masked line-by-line text reveal. */
// The in-view trigger sits on the (visible) wrapper: the lines start clipped by overflow-hidden,
// so observing them directly would never report an intersection.
export function MaskText({ lines, className = '', lineClass = '', delay = 0, as = 'h2', inView = true }) {
  const Tag = motion[as];
  const trigger = inView ? { whileInView: 'show', viewport: { once: true, margin: '-10% 0px' } } : { animate: 'show' };
  return (
    <Tag className={className} initial="hidden" {...trigger}>
      {lines.map((line, i) => (
        <span key={i} className="block overflow-hidden pb-[0.06em]">
          <motion.span className={`block ${lineClass}`} variants={{ hidden: { y: '110%' }, show: { y: '0%' } }} transition={{ duration: 0.9, delay: delay + i * 0.09, ease: EASE }}>
            {line}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}

/** Fade-up on scroll. */
export const Reveal = ({ children, delay = 0, className = '', y = 28 }) => (
  <motion.div className={className} initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-8% 0px' }} transition={{ duration: 0.7, delay, ease: EASE }}>
    {children}
  </motion.div>
);

export function Marquee({ items, speed = 28, reverse = false, className = '', itemClass = '' }) {
  const row = [...items, ...items];
  return (
    <div className={`overflow-hidden ${className}`} aria-hidden="true">
      <div className={`marquee ${reverse ? 'marquee-reverse' : ''}`} style={{ '--marquee-speed': `${speed}s` }}>
        {[0, 1].map((k) => (
          <div key={k} className="flex shrink-0 items-center">
            {row.map((t, i) => (
              <span key={i} className={`flex items-center whitespace-nowrap ${itemClass}`}>
                {t}<span className="mx-6 text-neon">✦</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide = false, side = false }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    setTimeout(() => ref.current?.focus(), 30);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus?.(); };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className={`fixed inset-0 z-[70] flex ${side ? 'justify-end' : 'items-end sm:items-center justify-center'} bg-black/70 backdrop-blur-sm`}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div
            ref={ref} role="dialog" aria-modal="true" aria-labelledby={title ? titleId : undefined} tabIndex={-1}
            className={`relative max-h-[92dvh] w-full overflow-y-auto border border-line bg-panel outline-none ${side ? 'h-full max-h-none max-w-md' : wide ? 'sm:max-w-5xl' : 'sm:max-w-lg'}`}
            initial={side ? { x: '100%' } : { y: 40, opacity: 0, scale: 0.98 }}
            animate={side ? { x: 0 } : { y: 0, opacity: 1, scale: 1 }}
            exit={side ? { x: '100%' } : { y: 30, opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-panel/95 px-5 py-4 backdrop-blur">
              {title ? <h2 id={titleId} className="display text-2xl">{title}</h2> : <span />}
              <button onClick={onClose} aria-label="Close" className="grid size-10 place-items-center border border-line transition hover:border-neon hover:text-neon"><X size={18} /></button>
            </div>
            <div className="p-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Labelled input/select/textarea with error text. */
export function Field({ label, error, as = 'input', className = '', children, hint, ...props }) {
  const id = useId();
  const Comp = as;
  return (
    <label htmlFor={id} className={`block ${className}`}>
      <span className="label mb-2 block text-mute">{label}</span>
      <Comp id={id} className="field" aria-invalid={error ? 'true' : undefined} aria-describedby={error ? `${id}-e` : undefined} {...props}>{children}</Comp>
      {hint && !error && <span className="mt-1 block text-xs text-mute">{hint}</span>}
      {error && <span id={`${id}-e`} className="mt-1 block text-xs text-danger">{Array.isArray(error) ? error[0] : error}</span>}
    </label>
  );
}

export const Spinner = ({ className = '' }) => (
  <span role="status" aria-label="Loading" className={`inline-block size-5 animate-spin rounded-full border-2 border-line border-t-neon ${className}`} />
);

export const PageLoader = () => (
  <div className="grid min-h-[60vh] place-items-center"><Spinner className="size-8" /></div>
);

export function Empty({ title, hindi, children, action }) {
  return (
    <div className="flex flex-col items-center gap-4 border border-dashed border-line px-6 py-16 text-center">
      {hindi && <p className="hindi text-5xl text-green">{hindi}</p>}
      <h3 className="display text-3xl">{title}</h3>
      {children && <p className="max-w-sm text-mute">{children}</p>}
      {action}
    </div>
  );
}

export function Price({ price, sale, className = '', big = false }) {
  const discounted = sale != null && sale < price;
  const off = discounted ? Math.round(((price - sale) / price) * 100) : 0;
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-2 ${className}`}>
      <span className={`font-bold ${big ? 'text-3xl' : ''}`}>{inr(discounted ? sale : price)}</span>
      {discounted && <><s className="text-sm text-mute">{inr(price)}</s><span className="text-xs font-bold text-neon">{off}% OFF</span></>}
    </span>
  );
}

export const Stars = ({ value = 0, size = 14 }) => (
  <span className="inline-flex gap-0.5" aria-label={`${value} out of 5`}>
    {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={size} className={n <= Math.round(value) ? 'fill-neon text-neon' : 'text-line'} />)}
  </span>
);

export const StatusPill = ({ value }) => {
  const tone = {
    paid: 'border-neon text-neon', delivered: 'border-neon text-neon', confirmed: 'border-green text-green', shipped: 'border-neon/60 text-neon',
    processing: 'border-warn text-warn', pending: 'border-warn text-warn', cancelled: 'border-danger text-danger', failed: 'border-danger text-danger', refunded: 'border-mute text-mute',
  }[value] || 'border-line text-mute';
  return <span className={`inline-block border px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.15em] ${tone}`}>{value}</span>;
};

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { api, asset, inr } from '../lib/api.js';

// Relative luminance → pick readable ink for whatever tee colour is showing.
const isLight = (hex = '#000000') => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55;
};

// Where the draggable stickers start (percent of the panel) and their tilt.
const STICKER_SPOTS = [
  { left: '6%', top: '40%', rotate: -9 }, { left: '80%', top: '34%', rotate: 7 },
  { left: '22%', top: '62%', rotate: 4 }, { left: '70%', top: '60%', rotate: -6 },
];

/**
 * The homepage opener, built like a shop floor: a clothes rail of the real catalogue (hang tags from the API),
 * a fabric panel that takes the chosen tee's colour, the back print inflating as raised puff ink and tilting
 * toward the cursor, stickers you can peel around, and a spinning stamp that links to the tee.
 */
export default function Hero({ hero, stickers = [] }) {
  const [tees, setTees] = useState([]);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const panel = useRef(null);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rotY = useSpring(useTransform(mx, [0, 1], [-16, 16]), { stiffness: 110, damping: 16 });
  const rotX = useSpring(useTransform(my, [0, 1], [12, -12]), { stiffness: 110, damping: 16 });
  const shine = useTransform([mx, my], ([x, y]) => `radial-gradient(circle at ${x * 100}% ${y * 100}%, rgba(255,255,255,.7), transparent 32%)`);
  const glowX = useTransform(mx, (v) => `${v * 100}%`);
  const glowY = useTransform(my, (v) => `${v * 100}%`);

  useEffect(() => {
    api.get('/products', { params: { limit: 8 } }).then(({ data }) => {
      setTees(data.products.filter((p) => p.colors?.[0]).map((p) => ({
        slug: p.slug, name: p.colors[0].name, hex: p.colors[0].hex, image: p.image, price: p.sale_price ?? p.price,
      })));
    }).catch(() => {});
  }, []);
  useEffect(() => {
    if (tees.length < 2 || paused) return undefined;
    const t = setInterval(() => setIdx((i) => (i + 1) % tees.length), 4200);
    return () => clearInterval(t);
  }, [tees.length, paused]);

  const tee = tees[idx] || { hex: '#151815', name: '' };
  const light = isLight(tee.hex);
  const ink = light ? 'text-ink' : 'text-paper';
  const word = hero.hindi || 'बाकाचिकी';
  const pick = (i) => { setIdx(i); setPaused(true); };

  const onMove = (e) => {
    const r = panel.current.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width);
    my.set((e.clientY - r.top) / r.height);
  };

  return (
    <section className="relative isolate flex min-h-[100svh] flex-col bg-ink px-2 pb-2 pt-[4.5rem] sm:px-3 sm:pb-3 lg:pt-[5.5rem]" aria-label="Featured drop">
      <h1 className="sr-only">{hero.title || 'BAKACHIKI'} — {hero.subtitle}</h1>

      <motion.div ref={panel} onPointerMove={onMove} onPointerLeave={() => { mx.set(0.5); my.set(0.5); }}
        animate={{ backgroundColor: tee.hex }} transition={{ duration: 1, ease: [0.2, 0.9, 0.1, 1] }}
        className={`relative flex flex-1 flex-col overflow-hidden [perspective:1200px] ${ink}`}>
        {/* fabric: knit, folds, cursor-lit sheen, stitched seams */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-20 mix-blend-overlay [background:repeating-linear-gradient(90deg,rgba(255,255,255,.5)_0_1px,transparent_1px_4px),repeating-linear-gradient(0deg,rgba(0,0,0,.6)_0_1px,transparent_1px_3px)]" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_15%_0%,rgba(255,255,255,.16),transparent_55%),radial-gradient(90%_70%_at_100%_100%,rgba(0,0,0,.5),transparent_60%),linear-gradient(100deg,transparent_30%,rgba(0,0,0,.18)_45%,transparent_60%)]" />
        <motion.div aria-hidden="true" className="pointer-events-none absolute size-[50vmax] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 blur-[90px]" style={{ left: glowX, top: glowY }} />
        <div aria-hidden="true" className="pointer-events-none absolute inset-2 border-2 border-dashed border-current opacity-20 sm:inset-3" />

        {/* giant colour name watermark */}
        <AnimatePresence mode="popLayout">
          <motion.p key={tee.name} aria-hidden="true" initial={{ opacity: 0, x: 80 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -80 }} transition={{ duration: 0.8, ease: [0.2, 0.9, 0.1, 1] }}
            className="display pointer-events-none absolute inset-x-0 bottom-[22%] whitespace-nowrap text-center text-[17vw] leading-none opacity-[.13] [-webkit-text-stroke:2px_currentColor] [color:transparent] lg:bottom-[14%] lg:text-[14vw]">
            {tee.name}
          </motion.p>
        </AnimatePresence>

        {/* the rail */}
        <div className="relative z-20 px-3 pt-6 sm:px-8">
          <div aria-hidden="true" className="absolute inset-x-0 top-6 h-[5px] bg-gradient-to-b from-white/70 via-zinc-400 to-zinc-700 shadow-[0_6px_10px_rgba(0,0,0,.35)]" />
          <div className="relative flex items-start justify-center gap-[2.2vw] sm:gap-6" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
            {tees.map((t, i) => (
              <HangTag key={t.slug} tee={t} index={i} active={i === idx} onPick={() => pick(i)} />
            ))}
          </div>
        </div>

        {/* the print */}
        <div className="relative z-10 grid flex-1 place-items-center px-2 py-4">
          <motion.div style={{ rotateX: rotX, rotateY: rotY, transformStyle: 'preserve-3d' }} className="relative select-none text-center">
            <motion.p aria-hidden="true"
              initial={{ '--puff': 0, scale: 0.92, opacity: 0 }} animate={{ '--puff': 1, scale: 1, opacity: 1 }}
              transition={{ delay: 0.25, duration: 1.4, ease: [0.34, 1.56, 0.64, 1] }}
              className="puff hindi relative whitespace-nowrap text-[22vw] leading-none text-green lg:text-[10.5vw]" style={{ transform: 'translateZ(70px)' }}>
              {word}
              <motion.span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-clip-text text-transparent mix-blend-soft-light [-webkit-text-stroke:0] [text-shadow:none]" style={{ backgroundImage: shine }}>{word}</motion.span>
            </motion.p>
            <p aria-hidden="true" className="display mt-1 text-[4.5vw] tracking-[0.5em] opacity-80 lg:text-[1.6vw]" style={{ transform: 'translateZ(25px)' }}>{hero.title || 'BAKACHIKI'}</p>
          </motion.div>
        </div>

        {/* stickers: peel and move them (desktop) */}
        {stickers.slice(0, STICKER_SPOTS.length).map((text, i) => (
          <motion.span key={text} drag dragConstraints={panel} dragElastic={0.15} dragMomentum={false}
            initial={{ opacity: 0, scale: 1.6, rotate: STICKER_SPOTS[i].rotate * 3 }} animate={{ opacity: 1, scale: 1, rotate: STICKER_SPOTS[i].rotate }}
            transition={{ delay: 1 + i * 0.12, type: 'spring', stiffness: 260, damping: 14 }}
            whileHover={{ scale: 1.08 }} whileDrag={{ scale: 1.15, rotate: 0, cursor: 'grabbing', boxShadow: '0 18px 30px rgba(0,0,0,.45)' }}
            className={`absolute z-30 hidden cursor-grab select-none px-3 py-1.5 shadow-[0_6px_12px_rgba(0,0,0,.3)] md:block ${i % 2 ? 'bg-paper text-ink' : 'bg-neon text-ink'} ${/[ऀ-ॿ]/.test(text) ? 'hindi text-3xl' : 'display text-xl'}`}
            style={{ left: STICKER_SPOTS[i].left, top: STICKER_SPOTS[i].top }}>
            {text}
          </motion.span>
        ))}

        {/* copy + stamp */}
        <div className="relative z-20 flex flex-wrap items-end justify-between gap-6 p-5 sm:px-8 sm:pb-6 sm:pt-0">
          <div className="max-w-md">
            <p className="label mb-3 inline-flex items-center gap-2"><span className="size-2 animate-pulse rounded-full bg-neon" />{hero.eyebrow}</p>
            <p className="text-sm opacity-85 sm:text-base">{hero.subtitle}</p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Link to={hero.cta_primary?.href || '/new-drops'} className="btn btn-solid">{hero.cta_primary?.label || 'EXPLORE THE DROP'}<ArrowRight size={16} /></Link>
              <Link to={hero.cta_secondary?.href || '/shop'} className="btn btn-ghost bg-ink/70 text-paper backdrop-blur">{hero.cta_secondary?.label || 'SHOP NOW'}</Link>
            </div>
          </div>
          {tee.slug && <Stamp tee={tee} word={word} />}
        </div>
      </motion.div>
    </section>
  );
}

function HangTag({ tee, index, active, onPick }) {
  return (
    <motion.button type="button" onClick={onPick} aria-pressed={active} aria-label={`${tee.name} tee`}
      initial={{ y: -140 }} animate={{ y: active ? 18 : 0 }} transition={{ type: 'spring', stiffness: 140, damping: 12, delay: active ? 0 : 0.2 + index * 0.08 }}
      className="group relative w-[12.5vw] max-w-[92px] shrink-0 text-left lg:max-w-[100px]">
      {/* the swing lives on an inner wrapper so it doesn't fight the drop-in spring */}
      <motion.span className="block origin-top" animate={{ rotate: [-2.5, 2.5, -2.5] }} transition={{ duration: 3 + (index % 3) * 0.6, repeat: Infinity, ease: 'easeInOut' }}
        whileHover={{ rotate: [0, 9, -7, 4, 0], transition: { duration: 0.9 } }}>
        {/* hanger hook + shoulders */}
        <svg viewBox="0 0 100 40" className="mx-auto -mt-1 block w-[85%] text-zinc-300 drop-shadow-[0_2px_2px_rgba(0,0,0,.4)]" aria-hidden="true">
          <path d="M50 22 V12 a6 6 0 1 1 6 -6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <path d="M50 22 L6 38 H94 Z" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
        </svg>
        <span className={`block border-2 bg-ink p-1 shadow-[0_14px_24px_rgba(0,0,0,.45)] transition ${active ? 'border-neon' : 'border-transparent group-hover:border-paper/60'}`}>
          <span className="block aspect-[4/5] overflow-hidden" style={{ background: tee.hex }}>
            {tee.image && <img src={asset(tee.image)} alt="" draggable="false" className="size-full object-cover transition duration-500 group-hover:scale-110" />}
          </span>
          <span className="block px-0.5 pb-0.5 pt-1 text-paper">
            <span className="block truncate text-[0.55rem] font-bold uppercase tracking-[0.14em] sm:text-[0.62rem]">{tee.name}</span>
            <span className="hidden text-[0.62rem] text-neon sm:block">{inr(tee.price)}</span>
          </span>
        </span>
      </motion.span>
    </motion.button>
  );
}

function Stamp({ tee, word }) {
  const ring = `${word} • WEAR HINDI LOUD • ${tee.name.toUpperCase()} • `;
  return (
    <Link to={`/product/${tee.slug}`} className="group relative grid size-28 shrink-0 place-items-center sm:size-36" aria-label={`Shop the ${tee.name} tee`}>
      <motion.svg viewBox="0 0 200 200" className="absolute inset-0" animate={{ rotate: 360 }} transition={{ duration: 18, repeat: Infinity, ease: 'linear' }} aria-hidden="true">
        <defs><path id="stamp-ring" d="M100 100 m-78 0 a78 78 0 1 1 156 0 a78 78 0 1 1 -156 0" /></defs>
        <circle cx="100" cy="100" r="96" fill="#080A08" />
        <text fill="#39D353" fontSize="15" fontWeight="700" letterSpacing="3" style={{ fontFamily: 'var(--font-hindi), var(--font-display)' }}>
          <textPath href="#stamp-ring" textLength="480">{ring}</textPath>
        </text>
      </motion.svg>
      <span className="relative grid size-14 place-items-center rounded-full bg-neon text-ink transition group-hover:scale-110 sm:size-16">
        <ArrowUpRight size={26} className="transition group-hover:rotate-45" />
      </span>
    </Link>
  );
}

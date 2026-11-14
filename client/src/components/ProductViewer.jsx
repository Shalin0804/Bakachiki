// Interactive product stage.
// • True 360° when the product has a "frame" sequence (≥ 8 frames) for the colour.
// • Otherwise rotates through the real angle shots (front → side → back → side) with a crossfade — never a single image.
// Drag/swipe to rotate, inertia on release, slow auto-rotation after inactivity, front/back shortcuts, hotspots.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, RotateCw, ZoomIn, Play, ChevronLeft, ChevronRight, Move3d } from 'lucide-react';
import { asset } from '../lib/api.js';

const IDLE_MS = 3500;
const AUTO_DEG_PER_S = 14;
const FRICTION = 0.92; // velocity multiplier per 16ms frame
const norm = (a) => ((a % 360) + 360) % 360;
const VIEW_ANGLES = { front: 0, side: 90, back: 180, 'side-2': 270 };

function useRotation({ enabled, stops }) {
  const [angle, setAngle] = useState(0);
  const [mode, setMode] = useState('idle'); // idle | drag | inertia | auto | tween
  const st = useRef({ angle: 0, v: 0, lastX: 0, lastT: 0, raf: 0, idle: 0, mode: 'idle' });

  const set = (a) => { st.current.angle = a; setAngle(a); };
  const setM = (m) => { st.current.mode = m; setMode(m); };
  const stop = () => cancelAnimationFrame(st.current.raf);

  const scheduleAuto = useCallback(() => {
    clearTimeout(st.current.idle);
    if (st.current.hold || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    st.current.idle = setTimeout(() => {
      setM('auto');
      let last = performance.now();
      const tick = (t) => { set(st.current.angle + ((t - last) / 1000) * AUTO_DEG_PER_S); last = t; st.current.raf = requestAnimationFrame(tick); };
      st.current.raf = requestAnimationFrame(tick);
    }, IDLE_MS);
  }, []);

  const pause = useCallback(() => { stop(); clearTimeout(st.current.idle); setM('idle'); }, []);

  useEffect(() => { if (enabled) scheduleAuto(); return () => { stop(); clearTimeout(st.current.idle); }; }, [enabled, scheduleAuto]);

  const onPointerDown = (e) => {
    if (!enabled) return;
    stop(); clearTimeout(st.current.idle);
    e.currentTarget.setPointerCapture(e.pointerId);
    Object.assign(st.current, { lastX: e.clientX, lastT: performance.now(), v: 0 });
    setM('drag');
  };
  const onPointerMove = (e) => {
    if (st.current.mode !== 'drag') return;
    const now = performance.now();
    const dx = e.clientX - st.current.lastX;
    const degPerPx = 360 / Math.max(320, e.currentTarget.clientWidth * 1.4);
    const delta = -dx * degPerPx;
    st.current.v = (delta / Math.max(1, now - st.current.lastT)) * 16; // deg per frame
    Object.assign(st.current, { lastX: e.clientX, lastT: now });
    set(st.current.angle + delta);
  };
  const onPointerUp = () => {
    if (st.current.mode !== 'drag') return;
    if (performance.now() - st.current.lastT > 80) st.current.v = 0; // finger rested before release
    setM('inertia');
    const tick = () => {
      st.current.v *= FRICTION;
      if (Math.abs(st.current.v) < 0.05) {
        // settle on the nearest real view so hotspots line up
        if (stops) goTo(nearestStop(st.current.angle, stops)); else { setM('idle'); scheduleAuto(); }
        return;
      }
      set(st.current.angle + st.current.v);
      st.current.raf = requestAnimationFrame(tick);
    };
    st.current.raf = requestAnimationFrame(tick);
  };

  const goTo = useCallback((target) => {
    stop(); clearTimeout(st.current.idle);
    const from = st.current.angle;
    const diff = ((((target - from) % 360) + 540) % 360) - 180; // shortest path
    const t0 = performance.now(); const dur = 520;
    setM('tween');
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      set(from + diff * (1 - (1 - k) ** 3));
      if (k < 1) st.current.raf = requestAnimationFrame(tick); else { setM('idle'); scheduleAuto(); }
    };
    st.current.raf = requestAnimationFrame(tick);
  }, [scheduleAuto]);

  const hold = (on) => { st.current.hold = on; if (!on) scheduleAuto(); };
  return { angle, mode, goTo, pause, hold, resume: scheduleAuto, handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp } };
}

const nearestStop = (angle, stops) => {
  const a = norm(angle);
  let best = stops[0]; let bestD = 999;
  for (const s of stops) { const d = Math.min(Math.abs(a - s), 360 - Math.abs(a - s)); if (d < bestD) { bestD = d; best = s; } }
  return angle + ((((best - a) % 360) + 540) % 360) - 180;
};

export default function ProductViewer({ images, color, hotspots = [], name }) {
  const forColor = useCallback((list) => {
    const exact = list.filter((i) => i.color === color);
    return exact.length ? exact : list.filter((i) => !i.color);
  }, [color]);

  const frames = useMemo(() => forColor(images.filter((i) => i.kind === 'frame')), [images, forColor]);
  const stills = useMemo(() => {
    const own = images.filter((i) => i.kind !== 'frame' && (!i.color || i.color === color));
    return own.length ? own : images.filter((i) => i.kind !== 'frame');
  }, [images, color]);

  // Rotation sources: real frame sequence, or the real angle shots.
  const views = useMemo(() => {
    const pick = (k) => stills.find((i) => i.kind === k);
    const front = pick('front'); const side = pick('side'); const back = pick('back');
    return [front && { key: 'front', img: front }, side && { key: 'side', img: side }, back && { key: 'back', img: back }, side && back && { key: 'side-2', img: side, mirror: true }].filter(Boolean);
  }, [stills]);
  const trueSpin = frames.length >= 8;
  const canRotate = trueSpin || views.length >= 2;
  const stops = trueSpin ? null : views.map((v) => VIEW_ANGLES[v.key]);

  const [stage, setStage] = useState(canRotate ? 'spin' : 0); // 'spin' or index into stills
  const [zoom, setZoom] = useState(null);
  const [openSpot, setOpenSpot] = useState(null);
  const rot = useRotation({ enabled: canRotate && stage === 'spin' && openSpot == null, stops });

  useEffect(() => { setStage(canRotate ? 'spin' : 0); setZoom(null); }, [color, canRotate]);

  // Preload frames so dragging never flashes.
  useEffect(() => { frames.forEach((f) => { const im = new Image(); im.src = asset(f.url); }); }, [frames]);

  const a = norm(rot.angle);
  const currentView = trueSpin
    ? (a < 45 || a >= 315 ? 'front' : a >= 135 && a < 225 ? 'back' : 'side')
    : (() => { const step = 360 / views.length; return views[Math.round(a / step) % views.length]?.key; })();
  const settled = rot.mode === 'idle' || rot.mode === 'auto' ? Math.min(...(stops || [0, 90, 180, 270]).map((s) => Math.min(Math.abs(a - s), 360 - Math.abs(a - s)))) < 6 : false;
  const visibleSpots = hotspots.filter((h) => h.view === 'any' || !h.view || h.view === currentView || (h.view === 'side' && currentView === 'side-2'));
  const showSpots = stage === 'spin' && settled && rot.mode !== 'auto' && rot.mode !== 'drag';

  const stillIdx = typeof stage === 'number' ? stage : -1;
  const goStill = (d) => setStage((s) => {
    const i = typeof s === 'number' ? s : -1;
    const n = (i + d + stills.length) % stills.length;
    return n;
  });

  return (
    <div className="flex flex-col gap-3 lg:flex-row-reverse">
      {/* Stage */}
      <div className="relative flex-1">
        <div className="relative aspect-[5/6] overflow-hidden border border-line bg-panel select-none">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-[radial-gradient(ellipse_at_bottom,rgba(57,211,83,.18),transparent_65%)]" />

          {stage === 'spin' ? (
            <div
              className={`absolute inset-0 touch-pan-y ${rot.mode === 'drag' ? 'cursor-grabbing' : 'cursor-grab'}`}
              {...rot.handlers}
              onMouseEnter={() => { rot.hold(true); if (rot.mode === 'auto') rot.goTo(nearestStop(rot.angle, stops || [0, 90, 180, 270])); }}
              onMouseLeave={() => rot.hold(false)}
              role="img"
              aria-label={`${name}, ${trueSpin ? '360 degree' : 'rotating'} view. Drag left or right to turn. Currently showing ${currentView === 'side-2' ? 'side' : currentView}.`}
            >
              {trueSpin ? (
                <img src={asset(frames[Math.round((a / 360) * frames.length) % frames.length].url)} alt="" draggable="false" className="absolute inset-0 size-full object-contain" />
              ) : (
                views.map((v, i) => {
                  const step = 360 / views.length;
                  const pos = a / step;
                  const base = Math.floor(pos) % views.length;
                  const f = pos - Math.floor(pos);
                  const opacity = i === base ? 1 - f : i === (base + 1) % views.length ? f : 0;
                  const squeeze = 1 - 0.14 * Math.sin(Math.PI * f);
                  return opacity > 0.001 && (
                    <img key={v.key} src={asset(v.img.url)} alt="" draggable="false"
                      className="absolute inset-0 size-full object-contain will-change-transform"
                      style={{ opacity, transform: `scaleX(${(v.mirror ? -1 : 1) * squeeze})` }} />
                  );
                })
              )}

              <AnimatePresence>
                {showSpots && visibleSpots.map((h, i) => (
                  <motion.div key={`${h.title}-${currentView}`} className="absolute" style={{ left: `${h.x}%`, top: `${h.y}%` }}
                    initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} transition={{ delay: i * 0.08 }}>
                    <button
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => setOpenSpot(openSpot === i ? null : i)}
                      onMouseEnter={() => setOpenSpot(i)} onMouseLeave={() => setOpenSpot(null)}
                      onFocus={() => setOpenSpot(i)} onBlur={() => setOpenSpot(null)}
                      aria-expanded={openSpot === i} aria-label={`${h.title}: ${h.body}`}
                      className="relative -translate-x-1/2 -translate-y-1/2 grid size-9 place-items-center rounded-full bg-neon text-ink shadow-[0_0_0_6px_rgba(57,211,83,.25)]"
                    >
                      <span className="absolute inset-0 animate-ping rounded-full bg-neon/50" />
                      <Plus size={18} strokeWidth={3} className={`relative transition-transform ${openSpot === i ? 'rotate-45' : ''}`} />
                    </button>
                    <AnimatePresence>
                      {openSpot === i && (
                        <motion.div role="tooltip" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                          className={`absolute top-6 z-20 w-56 border border-neon bg-ink/95 p-3 text-left backdrop-blur ${h.x > 60 ? 'right-0' : h.x < 40 ? 'left-0' : '-left-28'}`}>
                          <p className="label text-neon">{h.title}</p>
                          <p className="mt-1 text-sm text-paper/90">{h.body}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <StillStage item={stills[stillIdx]} name={name} zoom={zoom} setZoom={setZoom} onSwipe={goStill} />
          )}

          {/* Stage chrome */}
          {stage === 'spin' && (
            <>
              <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2">
                <span className="label flex items-center gap-1.5 bg-ink/70 px-2 py-1 text-neon backdrop-blur"><Move3d size={13} />{trueSpin ? '360° VIEW' : 'DRAG TO TURN'}</span>
              </div>
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 p-3">
                <div className="flex gap-1.5">
                  {['front', 'back'].filter((k) => trueSpin || views.some((v) => v.key === k)).map((k) => (
                    <button key={k} onClick={() => rot.goTo(VIEW_ANGLES[k])}
                      className={`border px-3 py-2 text-[0.68rem] font-bold uppercase tracking-[0.18em] backdrop-blur transition ${currentView === k && settled ? 'border-neon bg-neon text-ink' : 'border-line bg-ink/70 hover:border-neon'}`}>
                      {k}
                    </button>
                  ))}
                </div>
                <Dial angle={a} spinning={rot.mode === 'auto'} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Thumbnails: vertical rail on desktop, swipeable strip on mobile */}
      <ul className="scrollbar-none flex snap-x snap-mandatory gap-2 overflow-x-auto lg:max-h-[min(80vh,760px)] lg:w-20 lg:flex-col lg:overflow-y-auto lg:overflow-x-visible" aria-label="Product media">
        {canRotate && (
          <li className="snap-start">
            <button onClick={() => setStage('spin')} aria-label="Rotating view" aria-current={stage === 'spin'}
              className={`grid aspect-[5/6] w-16 place-items-center border bg-panel transition sm:w-20 ${stage === 'spin' ? 'border-neon text-neon' : 'border-line text-mute hover:border-mute'}`}>
              <span className="flex flex-col items-center gap-1"><RotateCw size={18} /><span className="text-[0.6rem] font-bold">{trueSpin ? '360°' : 'TURN'}</span></span>
            </button>
          </li>
        )}
        {stills.map((s, i) => (
          <li key={s.id} className="snap-start">
            <button onClick={() => { setStage(i); setZoom(null); }} aria-label={`${s.kind} view`} aria-current={stillIdx === i}
              className={`relative block aspect-[5/6] w-16 overflow-hidden border bg-panel transition sm:w-20 ${stillIdx === i ? 'border-neon' : 'border-line hover:border-mute'}`}>
              {s.kind === 'video' ? <span className="grid size-full place-items-center text-neon"><Play size={18} /></span>
                : <img src={asset(s.url)} alt="" loading="lazy" className="size-full object-cover" />}
              <span className="absolute inset-x-0 bottom-0 bg-ink/80 py-0.5 text-center text-[0.55rem] font-bold uppercase tracking-wider">{s.kind}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StillStage({ item, name, zoom, setZoom, onSwipe }) {
  if (!item) return null;
  if (item.kind === 'video') {
    return <video key={item.url} src={asset(item.url)} className="absolute inset-0 size-full object-contain" controls playsInline muted autoPlay loop aria-label={`${name} video`} />;
  }
  const toggleZoom = (e) => {
    if (zoom) return setZoom(null);
    const r = e.currentTarget.getBoundingClientRect();
    setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };
  return (
    <>
      <motion.div key={item.id} className="absolute inset-0 touch-pan-y" drag={zoom ? false : 'x'} dragConstraints={{ left: 0, right: 0 }} dragElastic={0.25}
        onDragEnd={(_, info) => { if (Math.abs(info.offset.x) > 60) onSwipe(info.offset.x < 0 ? 1 : -1); }}
        initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
        <button type="button" onClick={toggleZoom} className={`absolute inset-0 ${zoom ? 'cursor-zoom-out' : 'cursor-zoom-in'}`} aria-label={zoom ? 'Zoom out' : 'Zoom in'}>
          <img src={asset(item.url)} alt={item.alt || `${name} — ${item.kind}`} draggable="false"
            className="size-full object-contain transition-transform duration-500"
            style={zoom ? { transform: 'scale(2.2)', transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined} />
        </button>
      </motion.div>
      <span className="label pointer-events-none absolute left-4 top-4 flex items-center gap-1.5 bg-ink/70 px-2 py-1 backdrop-blur"><ZoomIn size={13} />{item.kind}</span>
      <div className="absolute inset-x-0 bottom-3 flex justify-between px-3 lg:hidden">
        <button onClick={() => onSwipe(-1)} aria-label="Previous image" className="grid size-10 place-items-center border border-line bg-ink/70"><ChevronLeft size={18} /></button>
        <button onClick={() => onSwipe(1)} aria-label="Next image" className="grid size-10 place-items-center border border-line bg-ink/70"><ChevronRight size={18} /></button>
      </div>
    </>
  );
}

const Dial = ({ angle, spinning }) => (
  <div className="flex items-center gap-2 bg-ink/70 px-2 py-1.5 backdrop-blur" aria-hidden="true">
    <svg width="26" height="26" viewBox="0 0 26 26" className={spinning ? 'text-neon' : 'text-paper'}>
      <circle cx="13" cy="13" r="11" fill="none" stroke="currentColor" strokeOpacity=".3" />
      <line x1="13" y1="13" x2="13" y2="3" stroke="currentColor" strokeWidth="2" transform={`rotate(${angle} 13 13)`} />
    </svg>
    <span className="w-9 text-right font-mono text-xs">{Math.round(angle)}°</span>
  </div>
);

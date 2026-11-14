// Generates placeholder product art (SVG) in the BAKACHIKI style into uploads/seed.
// Replace with real photography from Admin → Products → Media; these only exist so a fresh install looks right.
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(import.meta.dirname, '../uploads/seed');
fs.mkdirSync(OUT, { recursive: true });

const G = { main: '#168A32', dark: '#0d5c21', neon: '#39D353' };
const TEES = {
  black: { base: '#151815', shade: '#0b0d0b', light: '#232823', rib: '#101210', bg1: '#101410', bg2: '#060806' },
  beige: { base: '#d8c8a6', shade: '#b9a782', light: '#ebdfc6', rib: '#cbb995', bg1: '#141a14', bg2: '#070907' },
};
const HINDI_FONT = "'Nirmala UI','Mangal','Noto Sans Devanagari','Kohinoor Devanagari',sans-serif";
const LATIN_FONT = "'Anton','Impact','Arial Narrow Bold',sans-serif";

const defs = (t, id) => `
<defs>
  <radialGradient id="bg${id}" cx="50%" cy="38%" r="75%">
    <stop offset="0" stop-color="${t.bg1}"/><stop offset="1" stop-color="${t.bg2}"/>
  </radialGradient>
  <radialGradient id="glow${id}" cx="50%" cy="100%" r="60%">
    <stop offset="0" stop-color="${G.neon}" stop-opacity=".35"/><stop offset="1" stop-color="${G.neon}" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="body${id}" x1="0" x2="1">
    <stop offset="0" stop-color="${t.shade}"/><stop offset=".22" stop-color="${t.base}"/>
    <stop offset=".55" stop-color="${t.light}"/><stop offset=".85" stop-color="${t.base}"/><stop offset="1" stop-color="${t.shade}"/>
  </linearGradient>
  <filter id="puff${id}" x="-10%" y="-10%" width="120%" height="130%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="b"/>
    <feSpecularLighting in="b" surfaceScale="6" specularConstant=".9" specularExponent="22" lighting-color="#d9ffe0" result="s">
      <feDistantLight azimuth="235" elevation="48"/>
    </feSpecularLighting>
    <feComposite in="s" in2="SourceAlpha" operator="in" result="sh"/>
    <feDropShadow dx="3" dy="6" stdDeviation="3" flood-color="#000" flood-opacity=".55" in="SourceGraphic" result="d"/>
    <feMerge><feMergeNode in="d"/><feMergeNode in="sh"/></feMerge>
  </filter>
  <pattern id="knit${id}" width="8" height="10" patternUnits="userSpaceOnUse">
    <path d="M0 0 L4 5 L8 0 M0 5 L4 10 L8 5" stroke="#000" stroke-opacity=".08" fill="none"/>
  </pattern>
</defs>`;

// Boxy, drop-shoulder oversized tee. neckDepth: deeper on the front.
const teePath = (neck) => `M400 168 Q500 ${168 + neck} 600 168 L742 202 L884 336 L912 566 L764 592 L742 482 L748 1072 Q500 1094 252 1072 L258 482 L236 592 L88 566 L116 336 L258 202 Z`;
const folds = `
  <path d="M330 520 Q350 760 320 1060" stroke="#000" stroke-opacity=".12" stroke-width="18" fill="none"/>
  <path d="M680 540 Q650 800 690 1060" stroke="#000" stroke-opacity=".1" stroke-width="22" fill="none"/>
  <path d="M258 482 Q300 450 330 420" stroke="#000" stroke-opacity=".18" stroke-width="10" fill="none"/>
  <path d="M742 482 Q700 450 670 420" stroke="#000" stroke-opacity=".18" stroke-width="10" fill="none"/>
  <path d="M258 202 Q245 330 258 482 M742 202 Q755 330 742 482" stroke="#000" stroke-opacity=".22" stroke-width="3" fill="none"/>`;

function tee(t, id, side) {
  const neck = side === 'front' ? 58 : 22;
  const print = side === 'front'
    ? `<text x="610" y="380" font-family="${LATIN_FONT}" font-size="40" letter-spacing="3" fill="${G.main}" filter="url(#puff${id})">BAKACHIKI</text>`
    : `<text x="500" y="560" text-anchor="middle" font-family="${HINDI_FONT}" font-weight="700" font-size="190" fill="${G.main}" filter="url(#puff${id})">बकचिकी</text>
       <text x="500" y="660" text-anchor="middle" font-family="${LATIN_FONT}" font-size="54" letter-spacing="18" fill="${G.main}" filter="url(#puff${id})">BAKACHIKI</text>
       <text x="500" y="720" text-anchor="middle" font-family="${LATIN_FONT}" font-size="20" letter-spacing="8" fill="${G.neon}" opacity=".8">STREET · कल्चर · 2026</text>`;
  return `
  <g>
    <ellipse cx="500" cy="1110" rx="330" ry="26" fill="#000" opacity=".55"/>
    <path d="${teePath(neck)}" fill="url(#body${id})"/>
    <path d="${teePath(neck)}" fill="url(#knit${id})"/>
    ${folds}
    <path d="M400 168 Q500 ${168 + neck} 600 168" stroke="${t.rib}" stroke-width="22" fill="none" stroke-linecap="round"/>
    <path d="M400 168 Q500 ${168 + neck} 600 168" stroke="#000" stroke-opacity=".25" stroke-width="2" fill="none" transform="translate(0 11)"/>
    ${print}
  </g>`;
}

function sideTee(t, id) {
  return `
  <g>
    <ellipse cx="500" cy="1110" rx="190" ry="22" fill="#000" opacity=".55"/>
    <path d="M430 170 Q470 160 560 172 L600 230 Q630 520 612 1072 Q500 1090 392 1072 Q372 520 400 230 Z" fill="url(#body${id})"/>
    <path d="M430 170 Q470 160 560 172 L600 230 Q630 520 612 1072 Q500 1090 392 1072 Q372 520 400 230 Z" fill="url(#knit${id})"/>
    <path d="M430 210 Q520 220 560 300 L600 560 L470 590 L440 330 Z" fill="${t.base}" stroke="#000" stroke-opacity=".25" stroke-width="3"/>
    <path d="M470 590 L600 560" stroke="#000" stroke-opacity=".3" stroke-width="6"/>
    <path d="M430 170 Q495 150 560 172" stroke="${t.rib}" stroke-width="20" fill="none" stroke-linecap="round"/>
    <path d="M600 420 Q616 520 612 760" stroke="${G.main}" stroke-width="10" opacity=".8" filter="url(#puff${id})"/>
  </g>`;
}

const frame = (t, id, inner, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1200" width="1000" height="1200">${defs(t, id)}
  <rect width="1000" height="1200" fill="url(#bg${id})"/>
  <rect width="1000" height="1200" fill="url(#glow${id})"/>
  ${extra}${inner}</svg>`;

const write = (name, svg) => fs.writeFileSync(path.join(OUT, name), svg.replace(/\n\s+/g, '\n'));

for (const [color, t] of Object.entries(TEES)) {
  write(`${color}-front.svg`, frame(t, 'f', tee(t, 'f', 'front')));
  write(`${color}-back.svg`, frame(t, 'b', tee(t, 'b', 'back')));
  write(`${color}-side.svg`, frame(t, 's', sideTee(t, 's')));
  // Fabric close-up: macro knit texture with raking green light.
  write(`fabric-closeup-${color}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1200" width="1000" height="1200">${defs(t, 'x')}
    <pattern id="macro" width="40" height="48" patternUnits="userSpaceOnUse">
      <rect width="40" height="48" fill="${t.base}"/>
      <path d="M0 0 Q10 30 20 48 M20 0 Q30 30 40 48 M20 0 Q10 30 0 48 M40 0 Q30 30 20 48" stroke="${t.shade}" stroke-width="7" fill="none"/>
      <path d="M2 4 Q10 26 18 44 M22 4 Q30 26 38 44" stroke="${t.light}" stroke-width="2" fill="none" opacity=".6"/>
    </pattern>
    <linearGradient id="rake" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${G.neon}" stop-opacity=".22"/><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></linearGradient>
    <rect width="1000" height="1200" fill="url(#macro)"/><rect width="1000" height="1200" fill="url(#rake)"/>
    <path d="M0 980 Q500 940 1000 990 L1000 1200 L0 1200 Z" fill="${t.rib}"/>
    <path d="M0 980 Q500 940 1000 990" stroke="#000" stroke-opacity=".35" stroke-width="6" stroke-dasharray="18 10" fill="none"/>
    <path d="M0 1010 Q500 970 1000 1020" stroke="#000" stroke-opacity=".35" stroke-width="6" stroke-dasharray="18 10" fill="none"/>
  </svg>`);
  // Print close-up: macro crop of the raised Hindi type.
  write(`print-closeup-${color}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1200" width="1000" height="1200">${defs(t, 'p')}
    <rect width="1000" height="1200" fill="${t.base}"/><rect width="1000" height="1200" fill="url(#knit${'p'})"/>
    <text x="-80" y="760" font-family="${HINDI_FONT}" font-weight="700" font-size="620" fill="${G.main}" filter="url(#puffp)">बकचि</text>
    <rect width="1000" height="1200" fill="url(#glowp)" opacity=".7"/>
  </svg>`);
}

// Category/collection art.
write('collection-hindi.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800">
  <rect width="1200" height="800" fill="#080A08"/>
  <text x="600" y="520" text-anchor="middle" font-family="${HINDI_FONT}" font-weight="700" font-size="360" fill="${G.main}">हिंदी</text>
  <text x="600" y="660" text-anchor="middle" font-family="${LATIN_FONT}" font-size="60" letter-spacing="30" fill="${G.neon}">HINDI PUFF SERIES</text></svg>`);
write('collection-essentials.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800">
  <rect width="1200" height="800" fill="#101410"/>
  <text x="600" y="470" text-anchor="middle" font-family="${LATIN_FONT}" font-size="230" fill="none" stroke="${G.neon}" stroke-width="3">OVERSIZED</text>
  <text x="600" y="600" text-anchor="middle" font-family="${LATIN_FONT}" font-size="60" letter-spacing="30" fill="#A5A5A5">240 GSM ESSENTIALS</text></svg>`);

console.log('Seed art written to', OUT);

import { Setting } from '../models.js';

// Defaults for every admin-editable content block. Stored values are shallow-merged over these,
// so adding a new field here never breaks an existing database.
export const DEFAULT_SETTINGS = {
  announcement: { enabled: true, text: 'FREE SHIPPING ABOVE ₹1499 · COD AVAILABLE · 240 GSM HEAVYWEIGHT COTTON' },
  hero: {
    eyebrow: 'DROP 01 — HINDI PUFF SERIES',
    title: 'BAKACHIKI',
    hindi: 'बाकाचिकी',
    subtitle: 'Oversized tees with loud Hindi type, raised puff print and zero chill. Made for the streets that raised us.',
    images: ['/uploads/seed/products/jet-black/99_spec_sheet.jpg', '/uploads/seed/products/beige/99_spec_sheet.jpg'],
    cta_primary: { label: 'EXPLORE THE DROP', href: '/new-drops' },
    cta_secondary: { label: 'SHOP NOW', href: '/shop' },
  },
  marquee: { items: ['BAKACHIKI', 'बाकाचिकी', 'PUFF PRINT', '240 GSM', 'DROP SHOULDER', 'MADE IN INDIA'] },
  promo: {
    enabled: true,
    eyebrow: 'THE PUFF EFFECT',
    title: 'TYPE YOU CAN FEEL.',
    body: 'Every back print is raised puff ink — run your fingers over it. The Devanagari stands off the cotton like a 3D billboard.',
    image_url: '/uploads/seed/products/jet-black/06_print_macro.png',
    cta_label: 'FEEL THE DROP',
    cta_href: '/shop',
  },
  about: {
    title: 'NOT YOUR AVERAGE TEE.',
    hindi: 'बाकाचिकी',
    body: 'BAKACHIKI started with one idea: Hindi deserves to be worn loud. We take the script we grew up with, blow it up across the back of heavyweight oversized tees, and raise it with puff print so it literally stands out.\n\nEvery piece is cut drop-shoulder and boxy, built on 240 GSM cotton that holds its shape wash after wash.',
    image_url: '/uploads/seed/products/beige/08_back_model.png',
    pillars: [
      { title: '240 GSM', body: 'Heavyweight cotton with structure.' },
      { title: 'PUFF PRINT', body: 'Raised, embossed ink you can feel.' },
      { title: 'DROP SHOULDER', body: 'Boxy oversized street silhouette.' },
    ],
  },
  contact: {
    email: 'hello@bakachiki.in',
    phone: '+91 00000 00000',
    whatsapp: '',
    instagram: 'https://instagram.com/bakachiki',
    address: 'India',
    hours: 'Mon–Sat, 10am–7pm IST',
  },
  store: { shipping_flat: 99, free_shipping_threshold: 1499, cod_enabled: true, cod_max_order: 5000, return_days: 7 },
  size_guide: {
    note: 'Measurements in inches, garment laid flat. Oversized fit — size down for a regular look. (Edit these in Admin → Content.)',
    rows: [
      { size: 'XS', chest: 40, length: 27, shoulder: 20 },
      { size: 'S', chest: 42, length: 28, shoulder: 21 },
      { size: 'M', chest: 44, length: 29, shoulder: 22 },
      { size: 'L', chest: 46, length: 30, shoulder: 23 },
      { size: 'XL', chest: 48, length: 31, shoulder: 24 },
      { size: 'XXL', chest: 50, length: 32, shoulder: 25 },
    ],
  },
  seo: {
    title: 'BAKACHIKI — Hindi Streetwear, Oversized Puff Print Tees',
    description: 'BAKACHIKI makes funky oversized streetwear tees with loud Hindi typography, raised puff print and 240 GSM cotton. Made in India.',
    og_image: '/uploads/seed/products/jet-black/99_spec_sheet.jpg',
  },
};

export async function getSettings() {
  const rows = await Setting.findAll();
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return Object.fromEntries(Object.entries(DEFAULT_SETTINGS).map(([k, def]) => [k, { ...def, ...(stored[k] || {}) }]));
}

export async function getSetting(key) {
  const row = await Setting.findOne({ where: { key } });
  return { ...DEFAULT_SETTINGS[key], ...(row?.value || {}) };
}

export async function saveSetting(key, value) {
  const [row] = await Setting.findOrCreate({ where: { key }, defaults: { value } });
  row.value = value;
  row.changed('value', true);
  await row.save();
  return row.value;
}

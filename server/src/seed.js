// Idempotent seed: admin account, categories, collections and the launch tees (one per colour).
// Product facts come from the brand brief (240 GSM cotton, drop shoulder, puff print, Hindi back type).
// Prices and stock are placeholders — edit them in Admin → Products.
import fs from 'node:fs';
import bcrypt from 'bcryptjs';
import { sequelize } from './db.js';
import { User, Category, Collection, Product, ProductImage, Variant, Coupon } from './models.js';
import { moveStock } from './services/orders.js';

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const STOCK = [10, 24, 36, 36, 24, 10];

const hotspots = [
  { view: 'back', x: 50, y: 42, title: 'Print Technology', body: 'Puff / emboss print — the Hindi type is raised off the fabric so you can feel every stroke.' },
  { view: 'any', x: 36, y: 72, title: 'Fabric Quality', body: '240 GSM heavyweight cotton with a dense hand-feel that holds its boxy shape.' },
  { view: 'any', x: 18, y: 30, title: 'Stitching Details', body: 'Drop-shoulder seams sit low on the arm for the relaxed oversized silhouette.' },
  { view: 'front', x: 50, y: 16, title: 'Neck Design', body: 'Crew neck finish that frames the oversized fit.' },
];

const tee = (color, hex, dir, code, category, flags, description) => ({
  color, hex, dir, code, category, flags, description,
  name: `Hindi Puff Oversized Tee — ${color}`, slug: `hindi-puff-oversized-tee-${color.toLowerCase().replace(/ /g, '-')}`,
});
const NEW = { is_featured: false, is_new_arrival: true, is_best_seller: false };
const products = [
  tee('Black', '#151815', 'jet-black', 'BLK', 'oversized-t-shirts', { is_featured: true, is_new_arrival: true, is_best_seller: true },
    'The OG. A jet-black oversized tee with BAKACHIKI in raised green puff print and a giant Devanagari बकचिकी across the back. Cut boxy with a drop shoulder on 240 GSM cotton.'),
  tee('Beige', '#D8C8A6', 'beige', 'BEG', 'graphic-tees', { is_featured: true, is_new_arrival: true, is_best_seller: false },
    'Sand-toned oversized tee with green puff BAKACHIKI branding and loud बकचिकी Hindi typography on the back. Drop-shoulder, boxy, built on 240 GSM cotton.'),
  tee('Off-White', '#EEEBE3', 'off-white', 'OWT', 'graphic-tees', NEW,
    'Clean off-white oversized tee with green puff BAKACHIKI on the chest and बकचिकी raised across the back. Drop-shoulder, boxy, 240 GSM cotton.'),
  tee('Forest Green', '#1E4A2A', 'forest-green', 'FGR', 'oversized-t-shirts', NEW,
    'Deep forest-green oversized tee with BAKACHIKI in raised green puff print and बकचिकी across the back. Drop-shoulder, boxy, 240 GSM cotton.'),
  tee('Purple', '#4A2163', 'purple', 'PRP', 'graphic-tees', NEW,
    'Rich purple oversized tee with green puff BAKACHIKI branding and loud बकचिकी Hindi typography on the back. Drop-shoulder, boxy, 240 GSM cotton.'),
  tee('Charcoal Grey', '#3B3E40', 'charcoal-grey', 'CGR', 'oversized-t-shirts', NEW,
    'Charcoal-grey oversized tee with BAKACHIKI in raised green puff print and बकचिकी across the back. Drop-shoulder, boxy, 240 GSM cotton.'),
];

// Photos live in uploads/seed/products/<dir>/NN_<view>.png, numbered in display order.
const KIND = { front_model: 'front', back_model: 'back', side_model: 'side', print_macro: 'print' };
function productMedia(p) {
  const dir = new URL(`../uploads/seed/products/${p.dir}/`, import.meta.url);
  return fs.readdirSync(dir).sort().map((file, i) => {
    const view = file.replace(/^\d+_|\.\w+$/g, '');
    return { kind: KIND[view] || 'gallery', color: p.color, url: `/uploads/seed/products/${p.dir}/${file}`, alt: `${p.name} — ${view.replace('_', ' ')}`, sort_order: i };
  });
}

await sequelize.transaction(async (transaction) => {
  const email = (process.env.ADMIN_EMAIL || 'admin@bakachiki.in').toLowerCase();
  const [admin, adminCreated] = await User.findOrCreate({
    where: { email },
    defaults: { name: 'BAKACHIKI Admin', role: 'admin', password_hash: await bcrypt.hash(process.env.ADMIN_PASSWORD || 'ChangeMe@123', 12) },
    transaction,
  });
  if (!adminCreated && admin.role !== 'admin') await admin.update({ role: 'admin' }, { transaction });
  console.log(adminCreated ? `Admin created: ${email}` : `Admin exists: ${email}`);

  const cats = {};
  for (const [i, c] of [
    { name: 'Oversized T-Shirts', slug: 'oversized-t-shirts', description: 'Boxy, drop-shoulder, heavyweight.' },
    { name: 'Graphic Tees', slug: 'graphic-tees', description: 'Loud prints. Louder type.' },
  ].entries()) {
    [cats[c.slug]] = await Category.findOrCreate({ where: { slug: c.slug }, defaults: { ...c, sort_order: i }, transaction });
  }

  const [hindi] = await Collection.findOrCreate({
    where: { slug: 'hindi-puff-series' },
    defaults: { name: 'Hindi Puff Series', tagline: 'Devanagari, raised.', description: 'Our debut drop: giant Hindi typography in raised puff print on heavyweight oversized tees.', image_url: '/uploads/seed/collection-hindi.svg', sort_order: 0 },
    transaction,
  });
  const [essentials] = await Collection.findOrCreate({
    where: { slug: 'oversized-essentials' },
    defaults: { name: 'Oversized Essentials', tagline: '240 GSM. Drop shoulder.', description: 'The everyday heavyweight oversized fit, in six colours.', image_url: '/uploads/seed/collection-essentials.svg', sort_order: 1 },
    transaction,
  });

  for (const p of products) {
    if (await Product.count({ where: { slug: p.slug }, transaction })) { console.log(`Product exists: ${p.slug}`); continue; }
    const product = await Product.create({
      name: p.name, slug: p.slug, sku: `BK-HPT-${p.code}`, description: p.description,
      price: 1499, discount_price: 1199, category_id: cats[p.category].id,
      fabric: 'Cotton', gsm: 240, fit: 'Oversized · Drop Shoulder', print_type: 'Puff / Emboss',
      hotspots, ...p.flags,
      meta_title: `${p.name} | BAKACHIKI`,
      meta_description: `${p.color} oversized tee with raised puff print Hindi typography. 240 GSM cotton, drop-shoulder fit.`,
    }, { transaction });
    await product.setCollections([hindi.id, essentials.id], { transaction });

    await ProductImage.bulkCreate(productMedia(p).map((m) => ({ ...m, product_id: product.id })), { transaction });

    for (const [i, size] of SIZES.entries()) {
      const v = await Variant.create({ product_id: product.id, color: p.color, color_hex: p.hex, size, sku: `BK-HPT-${p.code}-${size}`, stock: 0 }, { transaction });
      await moveStock(v, STOCK[i], 'initial', { transaction, userId: admin.id, note: 'Seed' });
    }
    console.log(`Product created: ${p.slug}`);
  }

  await Coupon.findOrCreate({
    where: { code: 'BAKA10' },
    defaults: { description: '10% off on orders above ₹999 (sample coupon)', type: 'percent', value: 10, min_order: 999, max_discount: 300 },
    transaction,
  });
});

await sequelize.close();
console.log('Seed complete.');

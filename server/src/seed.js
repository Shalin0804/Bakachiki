// Idempotent seed: admin account, categories, collections and the two launch tees.
// Product facts come from the brand brief (240 GSM cotton, drop shoulder, puff print, Hindi back type).
// Prices and stock are placeholders — edit them in Admin → Products.
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

const products = [
  {
    color: 'Black', hex: '#151815', file: 'black', code: 'BLK', category: 'oversized-t-shirts',
    name: 'Hindi Puff Oversized Tee — Black', slug: 'hindi-puff-oversized-tee-black',
    flags: { is_featured: true, is_new_arrival: true, is_best_seller: true },
    description: 'The OG. A jet-black oversized tee with BAKACHIKI in raised green puff print and a giant Devanagari बकचिकी across the back. Cut boxy with a drop shoulder on 240 GSM cotton.',
  },
  {
    color: 'Beige', hex: '#D8C8A6', file: 'beige', code: 'BEG', category: 'graphic-tees',
    name: 'Hindi Puff Oversized Tee — Beige', slug: 'hindi-puff-oversized-tee-beige',
    flags: { is_featured: true, is_new_arrival: true, is_best_seller: false },
    description: 'Sand-toned oversized tee with green puff BAKACHIKI branding and loud बकचिकी Hindi typography on the back. Drop-shoulder, boxy, built on 240 GSM cotton.',
  },
];

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
    defaults: { name: 'Oversized Essentials', tagline: '240 GSM. Drop shoulder.', description: 'The everyday heavyweight oversized fit, in black and beige.', image_url: '/uploads/seed/collection-essentials.svg', sort_order: 1 },
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

    const media = [
      ['front', `${p.file}-front.svg`], ['back', `${p.file}-back.svg`], ['side', `${p.file}-side.svg`],
      ['print', `print-closeup-${p.file}.svg`], ['fabric', `fabric-closeup-${p.file}.svg`],
      ['model', `hero-${p.file}.jpg`],
    ];
    await ProductImage.bulkCreate(media.map(([kind, file], i) => ({
      product_id: product.id, kind, color: p.color, url: `/uploads/seed/${file}`, alt: `${p.name} — ${kind} view`, sort_order: i,
    })), { transaction });

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

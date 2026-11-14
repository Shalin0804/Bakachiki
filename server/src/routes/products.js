// Public catalogue: products, filters, categories, collections, reviews, site settings.
import { Router } from 'express';
import { z } from 'zod';
import { Op, fn, col, literal } from 'sequelize';
import { Product, ProductImage, Variant, Category, Collection, Review, User, OrderItem, Order } from '../models.js';
import { validate, requireAuth, fail, optionalAuth } from '../middleware.js';
import { unitPrice } from '../services/pricing.js';
import { getSettings } from '../services/settings.js';
import { razorpayEnabled } from '../services/razorpay.js';

const r = Router();
const effectivePrice = literal('COALESCE(LEAST(`Product`.`discount_price`, `Product`.`price`), `Product`.`price`)');
const sortImages = (images = []) => [...images].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);

function colorsOf(variants = []) {
  const map = new Map();
  for (const v of variants) {
    const c = map.get(v.color) || { name: v.color, hex: v.color_hex, in_stock: false };
    c.in_stock ||= v.stock > 0;
    map.set(v.color, c);
  }
  return [...map.values()];
}

export function serializeProductCard(p) {
  const images = sortImages(p.images).filter((i) => i.kind !== 'video');
  const colors = colorsOf(p.variants);
  const firstColor = colors[0]?.name;
  const find = (kind) => images.find((i) => i.kind === kind && (!firstColor || !i.color || i.color === firstColor)) || images.find((i) => i.kind === kind);
  const primary = find('front') || images[0];
  const hover = find('model') || find('back') || images.find((i) => i !== primary);
  return {
    id: p.id, name: p.name, slug: p.slug,
    price: p.price, discount_price: p.discount_price, sale_price: unitPrice(p),
    image: primary?.url || null, hover_image: hover?.url || null,
    colors, sizes: [...new Set((p.variants || []).filter((v) => v.stock > 0).map((v) => v.size))],
    variants: (p.variants || []).map((v) => ({ id: v.id, color: v.color, size: v.size, stock: v.stock })),
    in_stock: (p.variants || []).some((v) => v.stock > 0),
    is_new_arrival: p.is_new_arrival, is_best_seller: p.is_best_seller, is_featured: p.is_featured,
    category: p.category ? { name: p.category.name, slug: p.category.slug } : undefined,
  };
}

const csv = z.string().optional().transform((s) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : []));
const listQuery = z.object({
  q: z.string().trim().max(80).optional(),
  category: z.string().max(100).optional(),
  collection: z.string().max(100).optional(),
  sizes: csv, colors: csv,
  min_price: z.coerce.number().int().min(0).optional(),
  max_price: z.coerce.number().int().min(0).optional(),
  in_stock: z.enum(['1', 'true']).optional(),
  badge: z.enum(['new', 'bestseller', 'featured']).optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'popular']).optional().default('newest'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(48).optional().default(12),
});

const cardInclude = [
  { model: ProductImage, as: 'images', attributes: ['id', 'url', 'kind', 'color', 'sort_order'] },
  { model: Variant, as: 'variants', attributes: ['id', 'color', 'color_hex', 'size', 'stock'] },
  { model: Category, as: 'category', attributes: ['name', 'slug'] },
];

r.get('/products', validate({ query: listQuery }), async (req, res) => {
  const q = req.q;
  const where = { is_active: true };
  const and = [];
  if (q.q) and.push({ [Op.or]: [{ name: { [Op.like]: `%${q.q}%` } }, { description: { [Op.like]: `%${q.q}%` } }, { sku: { [Op.like]: `%${q.q}%` } }] });
  if (q.badge === 'new') where.is_new_arrival = true;
  if (q.badge === 'bestseller') where.is_best_seller = true;
  if (q.badge === 'featured') where.is_featured = true;
  if (q.category) {
    const cat = await Category.findOne({ where: { slug: q.category } });
    if (!cat) return res.json({ products: [], total: 0, page: 1, pages: 0 });
    where.category_id = cat.id;
  }
  if (q.collection) {
    const coll = await Collection.findOne({ where: { slug: q.collection, is_active: true } });
    if (!coll) return res.json({ products: [], total: 0, page: 1, pages: 0 });
    and.push({ id: (await coll.getProducts({ attributes: ['id'], joinTableAttributes: [] })).map((p) => p.id) });
  }
  if (q.sizes.length || q.colors.length || q.in_stock) {
    const vWhere = {};
    if (q.sizes.length) vWhere.size = q.sizes;
    if (q.colors.length) vWhere.color = q.colors;
    if (q.in_stock) vWhere.stock = { [Op.gt]: 0 };
    const rows = await Variant.findAll({ where: vWhere, attributes: [[fn('DISTINCT', col('product_id')), 'product_id']], raw: true });
    and.push({ id: rows.map((v) => v.product_id) });
  }
  if (q.min_price != null) and.push(literal(`COALESCE(LEAST(discount_price, price), price) >= ${Number(q.min_price)}`));
  if (q.max_price != null) and.push(literal(`COALESCE(LEAST(discount_price, price), price) <= ${Number(q.max_price)}`));
  if (and.length) where[Op.and] = and;

  const order = {
    newest: [['created_at', 'DESC']],
    price_asc: [[effectivePrice, 'ASC']],
    price_desc: [[effectivePrice, 'DESC']],
    popular: [['sold_count', 'DESC'], ['created_at', 'DESC']],
  }[q.sort];

  // Page over ids first, then load associations for just that page (keeps LIMIT correct with hasMany joins).
  const { rows, count } = await Product.findAndCountAll({ where, attributes: ['id'], order: [...order, ['id', 'DESC']], limit: q.limit, offset: (q.page - 1) * q.limit });
  const ids = rows.map((p) => p.id);
  const products = ids.length ? await Product.findAll({ where: { id: ids }, include: cardInclude }) : [];
  products.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  res.json({ products: products.map(serializeProductCard), total: count, page: q.page, pages: Math.ceil(count / q.limit) });
});

r.get('/products/filters', async (_req, res) => {
  const [colors, sizes, range, categories] = await Promise.all([
    Variant.findAll({ attributes: ['color', [fn('MIN', col('color_hex')), 'hex']], group: ['color'], raw: true }),
    Variant.findAll({ attributes: [[fn('DISTINCT', col('size')), 'size']], raw: true }),
    Product.findOne({ where: { is_active: true }, attributes: [[fn('MIN', col('price')), 'min'], [fn('MAX', col('price')), 'max']], raw: true }),
    Category.findAll({ order: [['sort_order', 'ASC'], ['name', 'ASC']] }),
  ]);
  const order = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  res.json({
    colors: colors.map((c) => ({ name: c.color, hex: c.hex })),
    sizes: sizes.map((s) => s.size).sort((a, b) => order.indexOf(a) - order.indexOf(b)),
    price: { min: 0, max: Number(range?.max || 0) },
    categories,
  });
});

r.get('/products/:slug', async (req, res) => {
  const product = await Product.findOne({
    where: { slug: req.params.slug, is_active: true },
    include: [
      { model: ProductImage, as: 'images' },
      { model: Variant, as: 'variants', attributes: ['id', 'color', 'color_hex', 'size', 'sku', 'stock'] },
      { model: Category, as: 'category', attributes: ['id', 'name', 'slug'] },
      { model: Collection, as: 'collections', attributes: ['name', 'slug'], through: { attributes: [] } },
    ],
  });
  if (!product) fail(404, 'Product not found');
  const [stats, related] = await Promise.all([
    Review.findOne({ where: { product_id: product.id, is_approved: true }, attributes: [[fn('AVG', col('rating')), 'avg'], [fn('COUNT', col('id')), 'count']], raw: true }),
    Product.findAll({
      where: { is_active: true, id: { [Op.ne]: product.id }, ...(product.category_id ? { category_id: product.category_id } : {}) },
      include: cardInclude, order: [['sold_count', 'DESC']], limit: 4,
    }),
  ]);
  const json = product.toJSON();
  json.images = sortImages(json.images);
  json.sale_price = unitPrice(product);
  json.colors = colorsOf(json.variants);
  json.rating = { average: stats?.avg ? Number(Number(stats.avg).toFixed(1)) : null, count: Number(stats?.count || 0) };
  json.related = related.map(serializeProductCard);
  res.json({ product: json });
});

// --- Reviews ---
r.get('/products/:id/reviews', async (req, res) => {
  const reviews = await Review.findAll({
    where: { product_id: req.params.id, is_approved: true },
    include: [{ model: User, as: 'user', attributes: ['name'] }],
    order: [['created_at', 'DESC']], limit: 50,
  });
  res.json({ reviews: reviews.map((rv) => ({ ...rv.toJSON(), user: { name: rv.user?.name?.split(' ')[0] || 'Customer' } })) });
});

r.post('/products/:id/reviews', requireAuth, validate({
  body: z.object({ rating: z.coerce.number().int().min(1).max(5), title: z.string().trim().max(120).optional(), body: z.string().trim().max(2000).optional() }),
}), async (req, res) => {
  const product = await Product.findByPk(req.params.id);
  if (!product) fail(404, 'Product not found');
  const bought = await OrderItem.count({
    where: { product_id: product.id },
    include: [{ model: Order, where: { user_id: req.user.id, status: { [Op.ne]: 'cancelled' } }, attributes: [] }],
  });
  if (!bought) fail(403, 'Only customers who ordered this product can review it');
  const [review, created] = await Review.findOrCreate({ where: { product_id: product.id, user_id: req.user.id }, defaults: req.body });
  if (!created) await review.update(req.body);
  res.status(created ? 201 : 200).json({ review });
});

// --- Categories & collections ---
r.get('/categories', async (_req, res) => {
  const categories = await Category.findAll({
    attributes: { include: [[literal('(SELECT COUNT(*) FROM products p WHERE p.category_id = `Category`.`id` AND p.is_active = 1)'), 'product_count']] },
    order: [['sort_order', 'ASC'], ['name', 'ASC']],
  });
  res.json({ categories });
});

r.get('/collections', async (_req, res) => {
  res.json({ collections: await Collection.findAll({ where: { is_active: true }, order: [['sort_order', 'ASC'], ['name', 'ASC']] }) });
});

r.get('/collections/:slug', async (req, res) => {
  const collection = await Collection.findOne({ where: { slug: req.params.slug, is_active: true } });
  if (!collection) fail(404, 'Collection not found');
  res.json({ collection });
});

// --- Site content (public) ---
r.get('/settings', optionalAuth, async (_req, res) => {
  const settings = await getSettings();
  res.json({ settings, payments: { razorpay: razorpayEnabled(), razorpay_key: process.env.RAZORPAY_KEY_ID || null, cod: settings.store.cod_enabled } });
});

export default r;

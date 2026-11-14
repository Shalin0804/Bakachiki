// Admin API — every route requires an admin-panel JWT for an active admin or super_admin.
// Staff management (/staff) is super_admin only.
import { Router } from 'express';
import { z } from 'zod';
import { Op, fn, col, literal } from 'sequelize';
import { sequelize } from '../db.js';
import {
  User, Address, STAFF_ROLES, Product, ProductImage, Variant, Category, Collection, Inventory, Order, OrderItem, Payment,
  Coupon, CouponUsage, Review, SIZES, ORDER_STATUSES, PAYMENT_STATUSES, MEDIA_KINDS,
} from '../models.js';
import bcrypt from 'bcryptjs';
import { validate, requireAdmin, requireSuperAdmin, fail } from '../middleware.js';
import { emailSchema, passwordSchema } from './auth.js';
import { upload, saveFile, deleteFile } from '../services/storage.js';
import { getSettings, saveSetting, DEFAULT_SETTINGS } from '../services/settings.js';
import { moveStock, cancelOrder } from '../services/orders.js';

const r = Router();
r.use(requireAdmin);

const slugify = (s) => s.toString().normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 160) || `item-${Date.now()}`;
const pageQuery = z.object({
  q: z.string().trim().max(80).optional(),
  status: z.string().max(20).optional(),
  payment_status: z.string().max(20).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});
const idParam = z.object({ id: z.coerce.number().int().positive() });
const optionalText = (max) => z.string().trim().max(max).optional().nullable().transform((v) => v || null);

// ---------------- Dashboard ----------------
r.get('/stats', async (_req, res) => {
  const since = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
  since.setHours(0, 0, 0, 0);
  const [revenue, totalOrders, totalProducts, totalCustomers, pendingOrders, recentOrders, daily, lowStock, byStatus] = await Promise.all([
    Order.sum('total', { where: { payment_status: 'paid' } }),
    Order.count(),
    Product.count(),
    User.count({ where: { role: 'customer' } }),
    Order.count({ where: { status: ['pending', 'confirmed', 'processing'] } }),
    Order.findAll({ order: [['created_at', 'DESC']], limit: 8, attributes: ['id', 'order_number', 'name', 'total', 'status', 'payment_status', 'payment_method', 'created_at'] }),
    Order.findAll({
      where: { created_at: { [Op.gte]: since }, status: { [Op.ne]: 'cancelled' } },
      attributes: [[fn('DATE', col('created_at')), 'day'], [fn('SUM', col('total')), 'total'], [fn('COUNT', col('id')), 'orders']],
      group: [fn('DATE', col('created_at'))], raw: true,
    }),
    Variant.findAll({ where: { stock: { [Op.lte]: 5 } }, include: [{ model: Product, as: 'product', attributes: ['id', 'name'] }], order: [['stock', 'ASC']], limit: 10 }),
    Order.findAll({ attributes: ['status', [fn('COUNT', col('id')), 'count']], group: ['status'], raw: true }),
  ]);
  const byDay = Object.fromEntries(daily.map((d) => [String(d.day).slice(0, 10), d]));
  const sales = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(since.getTime() + i * 86400000);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { day: key, total: Number(byDay[key]?.total || 0), orders: Number(byDay[key]?.orders || 0) };
  });
  res.json({
    totals: { revenue: revenue || 0, orders: totalOrders, products: totalProducts, customers: totalCustomers, pending_orders: pendingOrders },
    recent_orders: recentOrders, sales, low_stock: lowStock,
    by_status: Object.fromEntries(byStatus.map((s) => [s.status, Number(s.count)])),
  });
});

// ---------------- Products ----------------
const variantSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  color: z.string().trim().min(1).max(40),
  color_hex: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like #101410'),
  size: z.enum(SIZES),
  sku: z.string().trim().min(1).max(80),
  stock: z.coerce.number().int().min(0).max(100000),
});
const hotspotSchema = z.object({
  x: z.coerce.number().min(0).max(100), y: z.coerce.number().min(0).max(100),
  title: z.string().trim().min(1).max(60), body: z.string().trim().max(400),
  view: z.enum(['front', 'back', 'side', 'any']).default('any'),
});
const productSchema = z.object({
  name: z.string().trim().min(2).max(150),
  slug: z.string().trim().max(170).optional().or(z.literal('')),
  sku: z.string().trim().min(1).max(60),
  description: z.string().max(10000).optional().default(''),
  price: z.coerce.number().int().min(1),
  discount_price: z.union([z.coerce.number().int().min(1), z.literal(''), z.null()]).optional().transform((v) => (v === '' || v == null ? null : v)),
  category_id: z.union([z.coerce.number().int().positive(), z.literal(''), z.null()]).optional().transform((v) => v || null),
  collection_ids: z.array(z.coerce.number().int().positive()).optional().default([]),
  fabric: optionalText(120), gsm: z.union([z.coerce.number().int().min(50).max(1000), z.literal(''), z.null()]).optional().transform((v) => v || null),
  fit: optionalText(80), print_type: optionalText(80),
  hotspots: z.array(hotspotSchema).max(12).optional().default([]),
  is_featured: z.boolean().default(false), is_new_arrival: z.boolean().default(false),
  is_best_seller: z.boolean().default(false), is_active: z.boolean().default(true),
  meta_title: optionalText(160), meta_description: optionalText(300),
  variants: z.array(variantSchema).max(120).default([]),
}).refine((p) => p.discount_price == null || p.discount_price < p.price, { message: 'Discount price must be lower than price', path: ['discount_price'] });

const fullProduct = (id) => Product.findByPk(id, {
  include: [
    { model: ProductImage, as: 'images' }, { model: Variant, as: 'variants' },
    { model: Category, as: 'category' }, { model: Collection, as: 'collections', through: { attributes: [] } },
  ],
  order: [[{ model: ProductImage, as: 'images' }, 'sort_order', 'ASC'], [{ model: Variant, as: 'variants' }, 'id', 'ASC']],
});

r.get('/products', validate({ query: pageQuery }), async (req, res) => {
  const { q, page, limit } = req.q;
  const where = q ? { [Op.or]: [{ name: { [Op.like]: `%${q}%` } }, { sku: { [Op.like]: `%${q}%` } }] } : {};
  const { rows, count } = await Product.findAndCountAll({
    where, order: [['created_at', 'DESC']], limit, offset: (page - 1) * limit,
    attributes: { include: [
      [literal('(SELECT COALESCE(SUM(stock),0) FROM product_variants v WHERE v.product_id = `Product`.`id`)'), 'total_stock'],
      [literal("(SELECT url FROM product_images i WHERE i.product_id = `Product`.`id` AND i.kind <> 'video' ORDER BY (i.kind = 'front') DESC, i.sort_order LIMIT 1)"), 'thumb'],
    ] },
    include: [{ model: Category, as: 'category', attributes: ['name'] }],
  });
  res.json({ products: rows, total: count, pages: Math.ceil(count / limit) });
});

r.get('/products/:id', validate({ params: idParam }), async (req, res) => {
  const product = await fullProduct(req.params.id);
  if (!product) fail(404, 'Product not found');
  res.json({ product });
});

async function saveProduct(product, data, adminId) {
  return sequelize.transaction(async (transaction) => {
    const { variants, collection_ids: collectionIds, ...fields } = data;
    fields.slug = slugify(fields.slug || fields.name);
    if (!product) product = await Product.create(fields, { transaction });
    else await product.update(fields, { transaction });
    await product.setCollections(collectionIds, { transaction });

    const existing = await Variant.findAll({ where: { product_id: product.id }, transaction, lock: transaction.LOCK.UPDATE });
    const keep = new Set();
    for (const v of variants) {
      const current = v.id ? existing.find((e) => e.id === v.id) : existing.find((e) => e.color === v.color && e.size === v.size);
      if (current) {
        keep.add(current.id);
        const diff = v.stock - current.stock;
        await current.update({ color: v.color, color_hex: v.color_hex, size: v.size, sku: v.sku }, { transaction });
        if (diff) await moveStock(current, diff, 'adjustment', { transaction, userId: adminId, note: 'Edited in product form' });
      } else {
        const created = await Variant.create({ ...v, id: undefined, stock: 0, product_id: product.id }, { transaction });
        keep.add(created.id);
        if (v.stock) await moveStock(created, v.stock, 'initial', { transaction, userId: adminId });
      }
    }
    const removed = existing.filter((e) => !keep.has(e.id)).map((e) => e.id);
    if (removed.length) await Variant.destroy({ where: { id: removed }, transaction });
    return product;
  });
}

r.post('/products', validate({ body: productSchema }), async (req, res) => {
  const product = await saveProduct(null, req.body, req.user.id);
  res.status(201).json({ product: await fullProduct(product.id) });
});

r.put('/products/:id', validate({ params: idParam, body: productSchema }), async (req, res) => {
  const product = await Product.findByPk(req.params.id);
  if (!product) fail(404, 'Product not found');
  await saveProduct(product, req.body, req.user.id);
  res.json({ product: await fullProduct(product.id) });
});

r.delete('/products/:id', validate({ params: idParam }), async (req, res) => {
  const product = await Product.findByPk(req.params.id, { include: [{ model: ProductImage, as: 'images' }] });
  if (!product) fail(404, 'Product not found');
  const keys = product.images.map((i) => i.storage_key);
  await product.destroy(); // images/variants/reviews cascade; order history keeps its snapshot
  await Promise.all(keys.map(deleteFile));
  res.json({ ok: true });
});

// --- Product media (images, videos, 360° frames) ---
r.post('/products/:id/media', validate({ params: idParam }), upload.array('files', 72), async (req, res) => {
  const product = await Product.findByPk(req.params.id);
  if (!product) fail(404, 'Product not found');
  const meta = z.object({
    kind: z.enum(MEDIA_KINDS).default('gallery'),
    color: z.string().trim().max(40).optional().transform((v) => v || null),
    alt: z.string().trim().max(200).optional(),
    url: z.string().trim().url().max(500).optional(),
  }).parse(req.body);
  const start = (await ProductImage.max('sort_order', { where: { product_id: product.id } })) ?? -1;
  // Frame sequences must keep file-name order (frame-01, frame-02 …).
  const files = [...(req.files || [])].sort((a, b) => a.originalname.localeCompare(b.originalname, undefined, { numeric: true }));
  if (!files.length && !meta.url) fail(422, 'Choose at least one file or paste a URL');
  const saved = meta.url ? [{ url: meta.url, storage_key: null }] : [];
  for (const f of files) saved.push(await saveFile(f, `products/${product.id}`));
  await ProductImage.bulkCreate(saved.map((s, i) => ({
    product_id: product.id, kind: meta.kind, color: meta.color, url: s.url, storage_key: s.storage_key,
    alt: meta.alt || `${product.name} — ${meta.kind}${meta.kind === 'frame' ? ` ${i + 1}` : ''}`, sort_order: start + 1 + i,
  })));
  res.status(201).json({ product: await fullProduct(product.id) });
});

r.patch('/media/:id', validate({
  params: idParam,
  body: z.object({ kind: z.enum(MEDIA_KINDS).optional(), color: z.string().trim().max(40).nullable().optional(), alt: z.string().trim().max(200).optional() }),
}), async (req, res) => {
  const media = await ProductImage.findByPk(req.params.id);
  if (!media) fail(404, 'Media not found');
  await media.update({ ...req.body, color: req.body.color === '' ? null : req.body.color });
  res.json({ product: await fullProduct(media.product_id) });
});

r.put('/products/:id/media-order', validate({ params: idParam, body: z.object({ ids: z.array(z.coerce.number().int().positive()).max(500) }) }), async (req, res) => {
  await sequelize.transaction(async (transaction) => {
    for (const [i, mediaId] of req.body.ids.entries()) {
      await ProductImage.update({ sort_order: i }, { where: { id: mediaId, product_id: req.params.id }, transaction });
    }
  });
  res.json({ product: await fullProduct(req.params.id) });
});

r.delete('/media/:id', validate({ params: idParam }), async (req, res) => {
  const media = await ProductImage.findByPk(req.params.id);
  if (!media) fail(404, 'Media not found');
  await media.destroy();
  await deleteFile(media.storage_key);
  res.json({ product: await fullProduct(media.product_id) });
});

// --- Inventory ---
r.get('/inventory', validate({ query: z.object({ variant_id: z.coerce.number().int().positive().optional(), product_id: z.coerce.number().int().positive().optional() }) }), async (req, res) => {
  const where = req.q.variant_id ? { variant_id: req.q.variant_id } : {};
  const movements = await Inventory.findAll({
    where, order: [['created_at', 'DESC'], ['id', 'DESC']], limit: 200,
    include: [{ model: Variant, as: 'variant', attributes: ['sku', 'color', 'size', 'product_id'], where: req.q.product_id ? { product_id: req.q.product_id } : undefined }],
  });
  res.json({ movements });
});

r.post('/variants/:id/stock', validate({
  params: idParam,
  body: z.object({ change: z.coerce.number().int().refine((n) => n !== 0, 'Change cannot be 0'), reason: z.enum(['restock', 'adjustment']), note: z.string().trim().max(255).optional() }),
}), async (req, res) => {
  const variant = await sequelize.transaction(async (transaction) => {
    const v = await Variant.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!v) fail(404, 'Variant not found');
    if (v.stock + req.body.change < 0) fail(422, `Stock cannot go below 0 (currently ${v.stock})`);
    await moveStock(v, req.body.change, req.body.reason, { transaction, userId: req.user.id, note: req.body.note });
    return v;
  });
  res.json({ variant });
});

r.get('/stock', validate({ query: z.object({ q: z.string().trim().max(80).optional(), low: z.coerce.number().int().min(0).optional() }) }), async (req, res) => {
  const where = req.q.low !== undefined ? { stock: { [Op.lte]: req.q.low } } : {};
  const variants = await Variant.findAll({
    where, order: [['product_id', 'ASC'], ['color', 'ASC'], ['id', 'ASC']],
    include: [{ model: Product, as: 'product', attributes: ['id', 'name'], where: req.q.q ? { name: { [Op.like]: `%${req.q.q}%` } } : undefined }],
  });
  res.json({ variants });
});

// ---------------- Orders ----------------
r.get('/orders', validate({ query: pageQuery }), async (req, res) => {
  const { q, status, payment_status: paymentStatus, page, limit } = req.q;
  const where = {};
  if (status && ORDER_STATUSES.includes(status)) where.status = status;
  if (paymentStatus && PAYMENT_STATUSES.includes(paymentStatus)) where.payment_status = paymentStatus;
  if (q) where[Op.or] = [{ order_number: { [Op.like]: `%${q}%` } }, { email: { [Op.like]: `%${q}%` } }, { name: { [Op.like]: `%${q}%` } }, { phone: { [Op.like]: `%${q}%` } }];
  const { rows, count } = await Order.findAndCountAll({
    where, order: [['created_at', 'DESC']], limit, offset: (page - 1) * limit,
    attributes: { include: [[literal('(SELECT COALESCE(SUM(quantity),0) FROM order_items oi WHERE oi.order_id = `Order`.`id`)'), 'item_count']] },
  });
  res.json({ orders: rows, total: count, pages: Math.ceil(count / limit) });
});

r.get('/orders/:id', validate({ params: idParam }), async (req, res) => {
  const order = await Order.findByPk(req.params.id, {
    include: [{ model: OrderItem, as: 'items' }, { model: Payment, as: 'payments' }, { model: User, as: 'user', attributes: ['id', 'name', 'email', 'phone', 'created_at'] }],
  });
  if (!order) fail(404, 'Order not found');
  res.json({ order });
});

r.patch('/orders/:id', validate({
  params: idParam,
  body: z.object({
    status: z.enum(ORDER_STATUSES).optional(),
    payment_status: z.enum(PAYMENT_STATUSES).optional(),
    tracking_carrier: optionalText(80), tracking_number: optionalText(80),
    tracking_url: z.union([z.string().trim().url().max(500), z.literal(''), z.null()]).optional().transform((v) => v || null),
    admin_note: z.string().max(5000).optional().nullable(),
  }),
}), async (req, res) => {
  const order = await Order.findByPk(req.params.id);
  if (!order) fail(404, 'Order not found');
  const { status, payment_status: paymentStatus, ...rest } = req.body;
  if (order.status === 'cancelled' && status && status !== 'cancelled') fail(422, 'Cancelled orders cannot be reopened — stock has already been returned');
  // Online payments are only marked paid by verified Razorpay signatures; admins may only mark COD as paid.
  if (paymentStatus === 'paid' && order.payment_method !== 'cod' && order.payment_status !== 'paid') fail(422, 'Online payments are marked paid automatically after Razorpay verification');
  if (status === 'cancelled' && order.status !== 'cancelled') await cancelOrder(order.id, { userId: req.user.id, note: 'Cancelled by admin' });
  await order.reload();
  const update = { ...rest };
  if (status && status !== 'cancelled') update.status = status;
  if (paymentStatus) update.payment_status = paymentStatus;
  await order.update(update);
  if (paymentStatus === 'paid' && order.payment_method === 'cod') await Payment.update({ status: 'paid' }, { where: { order_id: order.id, provider: 'cod' } });
  if (paymentStatus === 'refunded') await Payment.update({ status: 'refunded' }, { where: { order_id: order.id, status: 'paid' } });
  res.json({ order: await Order.findByPk(order.id, { include: [{ model: OrderItem, as: 'items' }, { model: Payment, as: 'payments' }, { model: User, as: 'user', attributes: ['id', 'name', 'email', 'phone', 'created_at'] }] }) });
});

// ---------------- Customers ----------------
r.get('/customers', validate({ query: pageQuery }), async (req, res) => {
  const { q, page, limit } = req.q;
  const where = { role: 'customer' };
  if (q) where[Op.or] = [{ name: { [Op.like]: `%${q}%` } }, { email: { [Op.like]: `%${q}%` } }, { phone: { [Op.like]: `%${q}%` } }];
  const { rows, count } = await User.findAndCountAll({
    where, order: [['created_at', 'DESC']], limit, offset: (page - 1) * limit,
    attributes: { include: [
      [literal('(SELECT COUNT(*) FROM orders o WHERE o.user_id = `User`.`id`)'), 'order_count'],
      [literal("(SELECT COALESCE(SUM(total),0) FROM orders o WHERE o.user_id = `User`.`id` AND o.status <> 'cancelled')"), 'total_spent'],
    ] },
  });
  res.json({ customers: rows, total: count, pages: Math.ceil(count / limit) });
});

r.get('/customers/:id', validate({ params: idParam }), async (req, res) => {
  const customer = await User.findOne({ where: { id: req.params.id, role: 'customer' }, include: [{ model: Address, as: 'addresses' }] });
  if (!customer) fail(404, 'Customer not found');
  const orders = await Order.findAll({ where: { [Op.or]: [{ user_id: customer.id }, { email: customer.email }] }, order: [['created_at', 'DESC']], include: [{ model: OrderItem, as: 'items' }] });
  res.json({ customer, orders });
});

r.patch('/customers/:id', validate({ params: idParam, body: z.object({ is_active: z.boolean() }) }), async (req, res) => {
  const customer = await User.findOne({ where: { id: req.params.id, role: 'customer' } });
  if (!customer) fail(404, 'Customer not found');
  res.json({ customer: await customer.update({ is_active: req.body.is_active }) });
});

// ---------------- Staff (super_admin only) ----------------
const staffAttrs = ['id', 'name', 'email', 'phone', 'role', 'is_active', 'created_at'];
r.get('/staff', requireSuperAdmin, async (_req, res) => {
  res.json({ staff: await User.findAll({ where: { role: STAFF_ROLES }, attributes: staffAttrs, order: [['created_at', 'ASC']] }) });
});

r.post('/staff', requireSuperAdmin, validate({
  body: z.object({ name: z.string().trim().min(2).max(120), email: emailSchema, password: passwordSchema, role: z.enum(STAFF_ROLES) }),
}), async (req, res) => {
  if (await User.count({ where: { email: req.body.email } })) fail(409, 'An account with this email already exists');
  const user = await User.create({ ...req.body, password_hash: await bcrypt.hash(req.body.password, 12) });
  res.status(201).json({ user: await User.findByPk(user.id, { attributes: staffAttrs }) });
});

r.patch('/staff/:id', requireSuperAdmin, validate({
  params: idParam,
  body: z.object({
    name: z.string().trim().min(2).max(120).optional(),
    role: z.enum(STAFF_ROLES).optional(),
    is_active: z.boolean().optional(),
    password: passwordSchema.optional(),
  }),
}), async (req, res) => {
  const user = await User.findOne({ where: { id: req.params.id, role: STAFF_ROLES } });
  if (!user) fail(404, 'Staff member not found');
  const { password, ...changes } = req.body;
  // Stops a super_admin from locking themselves (and possibly everyone) out.
  if (user.id === req.user.id && (changes.role === 'admin' || changes.is_active === false)) fail(422, 'You cannot demote or deactivate your own account');
  if (password) changes.password_hash = await bcrypt.hash(password, 12);
  await user.update(changes);
  res.json({ user: await User.findByPk(user.id, { attributes: staffAttrs }) });
});

// ---------------- Coupons ----------------
const couponSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,40}$/, 'Use 3–40 letters, numbers, - or _'),
  description: optionalText(200),
  type: z.enum(['percent', 'fixed']),
  value: z.coerce.number().int().min(1),
  min_order: z.coerce.number().int().min(0).default(0),
  max_discount: z.union([z.coerce.number().int().min(1), z.literal(''), z.null()]).optional().transform((v) => v || null),
  starts_at: z.union([z.coerce.date(), z.literal(''), z.null()]).optional().transform((v) => v || null),
  expires_at: z.union([z.coerce.date(), z.literal(''), z.null()]).optional().transform((v) => v || null),
  usage_limit: z.union([z.coerce.number().int().min(1), z.literal(''), z.null()]).optional().transform((v) => v || null),
  per_user_limit: z.union([z.coerce.number().int().min(1), z.literal(''), z.null()]).optional().transform((v) => v || null),
  is_active: z.boolean().default(true),
}).refine((c) => c.type !== 'percent' || c.value <= 100, { message: 'Percentage cannot exceed 100', path: ['value'] })
  .refine((c) => !c.starts_at || !c.expires_at || c.starts_at < c.expires_at, { message: 'Expiry must be after start', path: ['expires_at'] });

r.get('/coupons', async (_req, res) => res.json({ coupons: await Coupon.findAll({ order: [['created_at', 'DESC']] }) }));
r.post('/coupons', validate({ body: couponSchema }), async (req, res) => res.status(201).json({ coupon: await Coupon.create(req.body) }));
r.put('/coupons/:id', validate({ params: idParam, body: couponSchema }), async (req, res) => {
  const coupon = await Coupon.findByPk(req.params.id);
  if (!coupon) fail(404, 'Coupon not found');
  res.json({ coupon: await coupon.update(req.body) });
});
r.delete('/coupons/:id', validate({ params: idParam }), async (req, res) => {
  const coupon = await Coupon.findByPk(req.params.id);
  if (!coupon) fail(404, 'Coupon not found');
  if (await CouponUsage.count({ where: { coupon_id: coupon.id } })) {
    await coupon.update({ is_active: false }); // keep history for orders that used it
    return res.json({ ok: true, deactivated: true });
  }
  await coupon.destroy();
  res.json({ ok: true });
});

// ---------------- Categories & collections ----------------
const taxonomySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().max(100).optional().or(z.literal('')),
  description: z.string().max(5000).optional().nullable(),
  tagline: optionalText(200),
  image_url: optionalText(500),
  sort_order: z.coerce.number().int().default(0),
  is_active: z.boolean().optional(),
  product_ids: z.array(z.coerce.number().int().positive()).optional(),
});

for (const [path, Model] of [['categories', Category], ['collections', Collection]]) {
  r.get(`/${path}`, async (_req, res) => {
    const rows = await Model.findAll({ order: [['sort_order', 'ASC'], ['name', 'ASC']], include: Model === Collection ? [{ model: Product, as: 'products', attributes: ['id'], through: { attributes: [] } }] : [] });
    res.json({ [path]: rows });
  });
  r.post(`/${path}`, validate({ body: taxonomySchema }), async (req, res) => {
    const { product_ids: productIds, ...data } = req.body;
    const row = await Model.create({ ...data, slug: slugify(data.slug || data.name) });
    if (Model === Collection && productIds) await row.setProducts(productIds);
    res.status(201).json({ item: row });
  });
  r.put(`/${path}/:id`, validate({ params: idParam, body: taxonomySchema }), async (req, res) => {
    const row = await Model.findByPk(req.params.id);
    if (!row) fail(404, 'Not found');
    const { product_ids: productIds, ...data } = req.body;
    await row.update({ ...data, slug: slugify(data.slug || data.name) });
    if (Model === Collection && productIds) await row.setProducts(productIds);
    res.json({ item: row });
  });
  r.delete(`/${path}/:id`, validate({ params: idParam }), async (req, res) => {
    await Model.destroy({ where: { id: req.params.id } }); // products.category_id is SET NULL by the FK
    res.json({ ok: true });
  });
}

// ---------------- Reviews ----------------
r.get('/reviews', async (_req, res) => {
  const reviews = await Review.findAll({
    order: [['created_at', 'DESC']], limit: 200,
    include: [{ model: User, as: 'user', attributes: ['name', 'email'] }, { model: Product, as: 'product', attributes: ['name', 'slug'] }],
  });
  res.json({ reviews });
});
r.patch('/reviews/:id', validate({ params: idParam, body: z.object({ is_approved: z.boolean() }) }), async (req, res) => {
  await Review.update({ is_approved: req.body.is_approved }, { where: { id: req.params.id } });
  res.json({ ok: true });
});
r.delete('/reviews/:id', validate({ params: idParam }), async (req, res) => {
  await Review.destroy({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// ---------------- Site content ----------------
r.get('/settings', async (_req, res) => res.json({ settings: await getSettings() }));
r.put('/settings/:key', async (req, res) => {
  const { key } = req.params;
  if (!(key in DEFAULT_SETTINGS)) fail(404, 'Unknown settings section');
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) fail(422, 'Settings must be an object');
  if (JSON.stringify(req.body).length > 50000) fail(413, 'Settings payload too large');
  if (key === 'store') {
    req.body = z.object({
      shipping_flat: z.coerce.number().int().min(0), free_shipping_threshold: z.coerce.number().int().min(0),
      cod_enabled: z.boolean(), cod_max_order: z.coerce.number().int().min(0), return_days: z.coerce.number().int().min(0),
    }).parse(req.body);
  }
  // Only keep keys the section defines, so the stored JSON can't grow arbitrary fields.
  const allowed = Object.fromEntries(Object.keys(DEFAULT_SETTINGS[key]).filter((k) => k in req.body).map((k) => [k, req.body[k]]));
  res.json({ value: await saveSetting(key, allowed) });
});

// Generic upload for banners, hero images, category art.
r.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) fail(422, 'No file received');
  res.status(201).json(await saveFile(req.file, 'content'));
});

export default r;

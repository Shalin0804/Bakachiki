// Logged-in customer: profile, password, addresses, wishlist.
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User, Address, Wishlist, Product, ProductImage, Variant } from '../models.js';
import { validate, requireAuth, fail } from '../middleware.js';
import { phoneSchema, passwordSchema } from './auth.js';
import { serializeProductCard } from './products.js';

const r = Router();
r.use(requireAuth);

r.get('/profile', (req, res) => res.json({ user: req.user }));

r.patch('/profile', validate({
  body: z.object({ name: z.string().trim().min(2).max(120), phone: phoneSchema.optional().or(z.literal('')) }),
}), async (req, res) => {
  await req.user.update({ name: req.body.name, phone: req.body.phone || null });
  res.json({ user: req.user });
});

r.post('/password', validate({ body: z.object({ current_password: z.string().min(1).max(72), new_password: passwordSchema }) }), async (req, res) => {
  const user = await User.scope('withSecrets').findByPk(req.user.id);
  if (!(await bcrypt.compare(req.body.current_password, user.password_hash))) fail(400, 'Current password is incorrect');
  await user.update({ password_hash: await bcrypt.hash(req.body.new_password, 12) });
  res.json({ message: 'Password updated' });
});

export const addressSchema = z.object({
  label: z.string().trim().max(40).optional().default('Home'),
  name: z.string().trim().min(2).max(120),
  phone: phoneSchema,
  line1: z.string().trim().min(3).max(200),
  line2: z.string().trim().max(200).optional().or(z.literal('')),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/, 'Enter a valid 6-digit pincode'),
  is_default: z.boolean().optional().default(false),
});

const listAddresses = (userId) => Address.findAll({ where: { user_id: userId }, order: [['is_default', 'DESC'], ['updated_at', 'DESC']] });
const clearDefault = (userId) => Address.update({ is_default: false }, { where: { user_id: userId } });

r.get('/addresses', async (req, res) => res.json({ addresses: await listAddresses(req.user.id) }));

r.post('/addresses', validate({ body: addressSchema }), async (req, res) => {
  const count = await Address.count({ where: { user_id: req.user.id } });
  if (count >= 10) fail(422, 'You can save up to 10 addresses');
  if (req.body.is_default || count === 0) { await clearDefault(req.user.id); req.body.is_default = true; }
  await Address.create({ ...req.body, user_id: req.user.id });
  res.status(201).json({ addresses: await listAddresses(req.user.id) });
});

r.put('/addresses/:id', validate({ body: addressSchema }), async (req, res) => {
  const address = await Address.findOne({ where: { id: req.params.id, user_id: req.user.id } });
  if (!address) fail(404, 'Address not found');
  if (req.body.is_default) await clearDefault(req.user.id);
  await address.update(req.body);
  res.json({ addresses: await listAddresses(req.user.id) });
});

r.delete('/addresses/:id', async (req, res) => {
  const address = await Address.findOne({ where: { id: req.params.id, user_id: req.user.id } });
  if (!address) fail(404, 'Address not found');
  await address.destroy();
  if (address.is_default) {
    const next = await Address.findOne({ where: { user_id: req.user.id }, order: [['updated_at', 'DESC']] });
    await next?.update({ is_default: true });
  }
  res.json({ addresses: await listAddresses(req.user.id) });
});

// --- Wishlist ---
const wishlistProducts = async (userId) => {
  const rows = await Wishlist.findAll({
    where: { user_id: userId },
    include: [{ model: Product, as: 'product', where: { is_active: true }, include: [{ model: ProductImage, as: 'images' }, { model: Variant, as: 'variants' }] }],
    order: [['created_at', 'DESC']],
  });
  return rows.map((w) => serializeProductCard(w.product));
};

r.get('/wishlist', async (req, res) => res.json({ products: await wishlistProducts(req.user.id) }));

r.post('/wishlist', validate({ body: z.object({ product_id: z.coerce.number().int().positive() }) }), async (req, res) => {
  if (!(await Product.count({ where: { id: req.body.product_id, is_active: true } }))) fail(404, 'Product not found');
  await Wishlist.findOrCreate({ where: { user_id: req.user.id, product_id: req.body.product_id } });
  res.status(201).json({ products: await wishlistProducts(req.user.id) });
});

r.delete('/wishlist/:productId', async (req, res) => {
  await Wishlist.destroy({ where: { user_id: req.user.id, product_id: req.params.productId } });
  res.json({ products: await wishlistProducts(req.user.id) });
});

export default r;

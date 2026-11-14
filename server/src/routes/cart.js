// Cart for guests (X-Cart-Token header) and logged-in users.
import { Router } from 'express';
import { z } from 'zod';
import { CartItem, Variant, Product } from '../models.js';
import { validate, optionalAuth, fail, HttpError } from '../middleware.js';
import { findCart, loadItems, serializeItem, mergeGuestCart } from '../services/cart.js';
import { computeTotals, findValidCoupon } from '../services/pricing.js';
import { getSetting } from '../services/settings.js';

const r = Router();
r.use(optionalAuth);

async function cartResponse(req, cart) {
  const items = cart ? (await loadItems(cart.id)).map(serializeItem) : [];
  const store = await getSetting('store');
  const payable = items.filter((i) => i.available);
  let coupon = null; let couponError = null;
  const code = typeof req.query.coupon === 'string' ? req.query.coupon.slice(0, 40) : '';
  if (code) {
    try {
      const subtotal = payable.reduce((s, i) => s + i.unit_price * i.quantity, 0);
      const c = await findValidCoupon(code, { subtotal, email: req.user?.email });
      coupon = { code: c.code, type: c.type, value: c.value, description: c.description, row: c };
    } catch (err) {
      if (!(err instanceof HttpError)) throw err;
      couponError = err.message;
    }
  }
  const totals = computeTotals(payable, coupon?.row, store);
  if (coupon) delete coupon.row;
  return { token: cart?.token || null, items, totals, coupon, coupon_error: couponError };
}

r.get('/', async (req, res) => res.json(await cartResponse(req, await findCart(req))));

const itemBody = z.object({ variant_id: z.coerce.number().int().positive(), quantity: z.coerce.number().int().min(1).max(10).default(1) });

async function sellableVariant(variantId) {
  const variant = await Variant.findByPk(variantId, { include: [{ model: Product, as: 'product', attributes: ['is_active'] }] });
  if (!variant || !variant.product.is_active) fail(404, 'This product is no longer available');
  if (variant.stock < 1) fail(409, `Size ${variant.size} in ${variant.color} is sold out`);
  return variant;
}

r.post('/items', validate({ body: itemBody }), async (req, res) => {
  const variant = await sellableVariant(req.body.variant_id);
  const cart = await findCart(req, { create: true });
  const [item, created] = await CartItem.findOrCreate({ where: { cart_id: cart.id, variant_id: variant.id }, defaults: { quantity: Math.min(req.body.quantity, variant.stock) } });
  if (!created) await item.update({ quantity: Math.min(10, variant.stock, item.quantity + req.body.quantity) });
  res.status(201).json(await cartResponse(req, cart));
});

// Change quantity, or swap to another variant (size/colour) of the same product.
r.patch('/items/:id', validate({
  body: z.object({ quantity: z.coerce.number().int().min(1).max(10).optional(), variant_id: z.coerce.number().int().positive().optional() }),
}), async (req, res) => {
  const cart = await findCart(req);
  const item = cart && (await CartItem.findOne({ where: { id: req.params.id, cart_id: cart.id }, include: [{ model: Variant, as: 'variant' }] }));
  if (!item) fail(404, 'Item not in your cart');
  let variant = item.variant;
  if (req.body.variant_id && req.body.variant_id !== item.variant_id) {
    variant = await sellableVariant(req.body.variant_id);
    if (variant.product_id !== item.variant.product_id) fail(422, 'You can only switch size or colour of the same product');
    const existing = await CartItem.findOne({ where: { cart_id: cart.id, variant_id: variant.id } });
    if (existing) { // merging into a line that already has this variant
      await existing.update({ quantity: Math.min(10, variant.stock, existing.quantity + (req.body.quantity || item.quantity)) });
      await item.destroy();
      return res.json(await cartResponse(req, cart));
    }
  }
  const quantity = req.body.quantity || item.quantity;
  if (quantity > variant.stock) fail(409, `Only ${variant.stock} left in size ${variant.size}`);
  await item.update({ variant_id: variant.id, quantity });
  res.json(await cartResponse(req, cart));
});

r.delete('/items/:id', async (req, res) => {
  const cart = await findCart(req);
  if (cart) await CartItem.destroy({ where: { id: req.params.id, cart_id: cart.id } });
  res.json(await cartResponse(req, cart));
});

// Called right after login with the guest token still in the header.
r.post('/merge', async (req, res) => {
  if (!req.user) fail(401, 'Please log in');
  await mergeGuestCart(req);
  res.json(await cartResponse(req, await findCart(req)));
});

export default r;
export { cartResponse };

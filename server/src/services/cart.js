// A cart belongs either to a logged-in user or to a guest token sent as the X-Cart-Token header.
import crypto from 'node:crypto';
import { Cart, CartItem, Variant, Product, ProductImage } from '../models.js';
import { unitPrice } from './pricing.js';

const TOKEN_RE = /^[a-f0-9]{48}$/;
export const guestToken = (req) => {
  const t = req.get('x-cart-token');
  return t && TOKEN_RE.test(t) ? t : null;
};

const itemInclude = [{
  model: Variant, as: 'variant',
  include: [{
    model: Product, as: 'product',
    attributes: ['id', 'name', 'slug', 'price', 'discount_price', 'is_active'],
    include: [
      { model: ProductImage, as: 'images', attributes: ['url', 'kind', 'color', 'sort_order'], required: false },
      { model: Variant, as: 'variants', attributes: ['id', 'color', 'color_hex', 'size', 'stock'], required: false },
    ],
  }],
}];

/** Finds the caller's cart, or creates one when `create` is set. Returns null for a guest without a token. */
export async function findCart(req, { create = false, transaction } = {}) {
  const where = req.user ? { user_id: req.user.id } : guestToken(req) ? { token: guestToken(req) } : null;
  let cart = where && (await Cart.findOne({ where, transaction }));
  if (!cart && create) {
    cart = await Cart.create(req.user ? { user_id: req.user.id } : { token: guestToken(req) || crypto.randomBytes(24).toString('hex') }, { transaction });
  }
  return cart;
}

export const loadItems = (cartId, transaction) =>
  CartItem.findAll({ where: { cart_id: cartId }, include: itemInclude, order: [['created_at', 'ASC']], transaction });

export const pickImage = (images = [], color) => {
  const sorted = [...images].sort((a, b) => a.sort_order - b.sort_order);
  const front = (c) => sorted.find((i) => i.kind === 'front' && (!c || i.color === c));
  return (front(color) || front() || sorted.find((i) => i.kind !== 'video'))?.url || null;
};

export function serializeItem(item) {
  const v = item.variant;
  const p = v.product;
  return {
    id: item.id,
    variant_id: v.id,
    quantity: item.quantity,
    size: v.size,
    color: v.color,
    color_hex: v.color_hex,
    sku: v.sku,
    stock: v.stock,
    unit_price: unitPrice(p),
    available: p.is_active && v.stock >= item.quantity,
    product: { id: p.id, name: p.name, slug: p.slug, price: p.price, discount_price: p.discount_price, image: pickImage(p.images, v.color) },
    options: (p.variants || []).map((o) => ({ id: o.id, color: o.color, color_hex: o.color_hex, size: o.size, stock: o.stock })),
  };
}

/** Moves a guest cart's items into the user's cart (quantities add up, capped by stock and 10). */
export async function mergeGuestCart(req) {
  const token = guestToken(req);
  if (!token || !req.user) return;
  const guest = await Cart.findOne({ where: { token } });
  if (!guest) return;
  const cart = await findCart(req, { create: true });
  const items = await CartItem.findAll({ where: { cart_id: guest.id }, include: [{ model: Variant, as: 'variant' }] });
  for (const it of items) {
    const [row, created] = await CartItem.findOrCreate({ where: { cart_id: cart.id, variant_id: it.variant_id }, defaults: { quantity: it.quantity } });
    if (!created) await row.update({ quantity: Math.min(10, it.variant.stock || 1, row.quantity + it.quantity) });
  }
  await guest.destroy();
}

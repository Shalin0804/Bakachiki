// Money math. All amounts are whole rupees (integers).
import { Op } from 'sequelize';
import { Coupon, CouponUsage } from '../models.js';
import { HttpError } from '../middleware.js';

export const unitPrice = (p) => (p.discount_price && p.discount_price < p.price ? p.discount_price : p.price);

export function couponDiscount(coupon, subtotal) {
  if (!coupon || subtotal <= 0) return 0;
  let d = coupon.type === 'percent' ? Math.floor((subtotal * coupon.value) / 100) : coupon.value;
  if (coupon.max_discount) d = Math.min(d, coupon.max_discount);
  return Math.min(d, subtotal);
}

/** lines: [{ unit_price, quantity }] */
export function computeTotals(lines, coupon, store) {
  const subtotal = lines.reduce((sum, l) => sum + l.unit_price * l.quantity, 0);
  const discount = couponDiscount(coupon, subtotal);
  const afterDiscount = subtotal - discount;
  const shipping = subtotal === 0 || afterDiscount >= store.free_shipping_threshold ? 0 : store.shipping_flat;
  return {
    count: lines.reduce((n, l) => n + l.quantity, 0),
    subtotal, discount, shipping, total: afterDiscount + shipping,
    free_shipping_remaining: Math.max(0, store.free_shipping_threshold - afterDiscount),
  };
}

/** Returns the coupon if usable for this subtotal/email, otherwise throws 422 with a customer-friendly reason. */
export async function findValidCoupon(code, { subtotal, email, transaction, lock = false }) {
  const coupon = await Coupon.findOne({
    where: { code: String(code).trim().toUpperCase(), is_active: true },
    transaction, lock: lock ? transaction.LOCK.UPDATE : undefined,
  });
  const reject = (msg) => { throw new HttpError(422, msg); };
  if (!coupon) reject('This coupon code is not valid');
  const now = new Date();
  if (coupon.starts_at && coupon.starts_at > now) reject('This coupon is not active yet');
  if (coupon.expires_at && coupon.expires_at < now) reject('This coupon has expired');
  if (coupon.usage_limit != null && coupon.used_count >= coupon.usage_limit) reject('This coupon has reached its usage limit');
  if (subtotal < coupon.min_order) reject(`Add ₹${coupon.min_order - subtotal} more to use this coupon`);
  if (email && coupon.per_user_limit != null) {
    const used = await CouponUsage.count({ where: { coupon_id: coupon.id, email: { [Op.eq]: email.toLowerCase() } }, transaction });
    if (used >= coupon.per_user_limit) reject('You have already used this coupon');
  }
  return coupon;
}

// Checkout, order lookup and Razorpay payment verification.
import { Router } from 'express';
import { z } from 'zod';
import { sequelize } from '../db.js';
import { Order, OrderItem, Payment, Variant, Product, Coupon, CouponUsage, CartItem, Address } from '../models.js';
import { validate, optionalAuth, requireAuth, fail } from '../middleware.js';
import { findCart, loadItems, serializeItem } from '../services/cart.js';
import { computeTotals, findValidCoupon, unitPrice } from '../services/pricing.js';
import { getSetting } from '../services/settings.js';
import { razorpayEnabled, createRazorpayOrder, verifyPaymentSignature, verifyWebhookSignature } from '../services/razorpay.js';
import { newOrderNumber, moveStock, markRazorpayPaid } from '../services/orders.js';
import { addressSchema } from './account.js';
import { emailSchema } from './auth.js';

const r = Router();

const checkoutSchema = addressSchema.omit({ label: true, is_default: true }).extend({
  email: emailSchema,
  payment_method: z.enum(['razorpay', 'cod']),
  coupon_code: z.string().trim().max(40).optional().or(z.literal('')),
  save_address: z.boolean().optional().default(false),
});

const orderInclude = [
  { model: OrderItem, as: 'items' },
  { model: Payment, as: 'payments', attributes: ['provider', 'provider_payment_id', 'amount', 'status', 'created_at'] },
];

async function razorpayCheckout(order) {
  const rp = await createRazorpayOrder({ amountRupees: order.total, receipt: order.order_number, notes: { order_number: order.order_number } });
  await Payment.create({ order_id: order.id, provider: 'razorpay', provider_order_id: rp.id, amount: order.total, status: 'created' });
  return { key: process.env.RAZORPAY_KEY_ID, order_id: rp.id, amount: rp.amount, currency: rp.currency, name: 'BAKACHIKI', prefill: { name: order.name, email: order.email, contact: order.phone } };
}

r.post('/', optionalAuth, validate({ body: checkoutSchema }), async (req, res) => {
  const body = req.body;
  const store = await getSetting('store');
  if (body.payment_method === 'razorpay' && !razorpayEnabled()) fail(422, 'Online payment is not available right now');
  if (body.payment_method === 'cod' && !store.cod_enabled) fail(422, 'Cash on Delivery is not available right now');

  const cart = await findCart(req);
  const items = cart ? await loadItems(cart.id) : [];
  if (!items.length) fail(422, 'Your bag is empty');

  const order = await sequelize.transaction(async (transaction) => {
    // Lock every variant row so two shoppers can't buy the last unit at once.
    const lines = [];
    for (const item of items) {
      const variant = await Variant.findByPk(item.variant_id, { transaction, lock: transaction.LOCK.UPDATE, include: [{ model: Product, as: 'product' }] });
      if (!variant?.product.is_active) fail(409, `${item.variant.product.name} is no longer available — remove it to continue`);
      if (variant.stock < item.quantity) fail(409, `Only ${variant.stock} left of ${variant.product.name} (${variant.color}, ${variant.size})`);
      lines.push({ variant, quantity: item.quantity, unit_price: unitPrice(variant.product), image: serializeItem(item).product.image });
    }
    const subtotal = lines.reduce((s, l) => s + l.unit_price * l.quantity, 0);
    const coupon = body.coupon_code ? await findValidCoupon(body.coupon_code, { subtotal, email: body.email, transaction, lock: true }) : null;
    const totals = computeTotals(lines, coupon, store);
    if (body.payment_method === 'cod' && store.cod_max_order && totals.total > store.cod_max_order) {
      fail(422, `Cash on Delivery is available up to ₹${store.cod_max_order}. Please pay online.`);
    }

    const created = await Order.create({
      order_number: newOrderNumber(), user_id: req.user?.id || null,
      name: body.name, email: body.email, phone: body.phone,
      line1: body.line1, line2: body.line2 || null, city: body.city, state: body.state, pincode: body.pincode,
      subtotal: totals.subtotal, discount: totals.discount, shipping: totals.shipping, total: totals.total,
      coupon_code: coupon?.code || null, payment_method: body.payment_method,
      status: body.payment_method === 'cod' ? 'confirmed' : 'pending', payment_status: 'pending',
    }, { transaction });

    for (const l of lines) {
      await OrderItem.create({
        order_id: created.id, product_id: l.variant.product_id, variant_id: l.variant.id,
        name: l.variant.product.name, sku: l.variant.sku, color: l.variant.color, size: l.variant.size,
        image_url: l.image, unit_price: l.unit_price, quantity: l.quantity,
      }, { transaction });
      await moveStock(l.variant, -l.quantity, 'order', { transaction, orderId: created.id, note: created.order_number });
      await Product.increment('sold_count', { by: l.quantity, where: { id: l.variant.product_id }, transaction });
    }
    if (coupon) {
      await coupon.increment('used_count', { transaction });
      await CouponUsage.create({ coupon_id: coupon.id, order_id: created.id, user_id: req.user?.id || null, email: body.email }, { transaction });
    }
    if (body.payment_method === 'cod') {
      await Payment.create({ order_id: created.id, provider: 'cod', amount: totals.total, status: 'created' }, { transaction });
    }
    if (req.user && body.save_address) {
      const hasAny = await Address.count({ where: { user_id: req.user.id }, transaction });
      await Address.create({ user_id: req.user.id, name: body.name, phone: body.phone, line1: body.line1, line2: body.line2 || null, city: body.city, state: body.state, pincode: body.pincode, is_default: !hasAny }, { transaction });
    }
    await CartItem.destroy({ where: { cart_id: cart.id }, transaction });
    return created;
  });

  let razorpay = null;
  if (order.payment_method === 'razorpay') {
    try {
      razorpay = await razorpayCheckout(order);
    } catch (err) {
      // Order exists with stock held; the customer can retry payment from the order page, or it expires.
      console.error('Razorpay order creation failed', err.message);
    }
  }
  res.status(201).json({ order: { order_number: order.order_number, email: order.email, total: order.total, status: order.status, payment_status: order.payment_status }, razorpay });
});

r.get('/mine', requireAuth, async (req, res) => {
  const orders = await Order.findAll({ where: { user_id: req.user.id }, include: [{ model: OrderItem, as: 'items' }], order: [['created_at', 'DESC']] });
  res.json({ orders });
});

// Owners see their orders; guests must also supply the email used at checkout.
async function findAccessibleOrder(req) {
  const order = await Order.findOne({ where: { order_number: req.params.number }, include: orderInclude });
  const email = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : '';
  const allowed = order && ((req.user && (order.user_id === req.user.id || req.user.role === 'admin')) || (email && order.email.toLowerCase() === email));
  if (!allowed) fail(404, 'Order not found');
  return order;
}

r.get('/:number', optionalAuth, async (req, res) => res.json({ order: await findAccessibleOrder(req) }));

// Start (or restart) online payment for an unpaid order.
r.post('/:number/pay', optionalAuth, async (req, res) => {
  const order = await findAccessibleOrder(req);
  if (order.payment_method !== 'razorpay' || order.payment_status === 'paid' || order.status === 'cancelled') fail(409, 'This order cannot be paid online');
  if (!razorpayEnabled()) fail(422, 'Online payment is not available right now');
  res.json({ razorpay: await razorpayCheckout(order) });
});

r.post('/:number/verify-payment', optionalAuth, validate({
  body: z.object({ razorpay_order_id: z.string().max(80), razorpay_payment_id: z.string().max(80), razorpay_signature: z.string().max(200) }),
}), async (req, res) => {
  const order = await findAccessibleOrder(req);
  const payment = await Payment.findOne({ where: { order_id: order.id, provider: 'razorpay', provider_order_id: req.body.razorpay_order_id } });
  if (!payment) fail(400, 'Payment does not belong to this order');
  const ok = verifyPaymentSignature({ orderId: req.body.razorpay_order_id, paymentId: req.body.razorpay_payment_id, signature: req.body.razorpay_signature });
  if (!ok) {
    await payment.update({ status: 'failed', raw: { reason: 'signature_mismatch', payment_id: req.body.razorpay_payment_id } });
    fail(400, 'Payment verification failed. If money was deducted it will be refunded automatically.');
  }
  await markRazorpayPaid({ providerOrderId: req.body.razorpay_order_id, providerPaymentId: req.body.razorpay_payment_id, raw: req.body });
  res.json({ order: await Order.findByPk(order.id, { include: orderInclude }) });
});

export default r;

// Mounted separately with express.raw() — the signature is computed over the exact bytes Razorpay sent.
export async function razorpayWebhook(req, res) {
  if (!verifyWebhookSignature(req.body, req.get('x-razorpay-signature'))) return res.status(400).json({ error: 'Invalid signature' });
  const event = JSON.parse(req.body.toString('utf8'));
  const entity = event.payload?.payment?.entity;
  if (entity && ['payment.captured', 'order.paid'].includes(event.event)) {
    await markRazorpayPaid({ providerOrderId: entity.order_id, providerPaymentId: entity.id, raw: { event: event.event, id: entity.id, method: entity.method } });
  } else if (entity && event.event === 'payment.failed') {
    await Payment.update({ status: 'failed', raw: { event: event.event, error: entity.error_description } }, { where: { provider_order_id: entity.order_id, status: 'created' } });
  }
  res.json({ ok: true });
}

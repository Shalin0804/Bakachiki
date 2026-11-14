import crypto from 'node:crypto';
import { Op } from 'sequelize';
import { sequelize } from '../db.js';
import { Order, OrderItem, Variant, Inventory, Payment, Product, Coupon, CouponUsage } from '../models.js';

export const newOrderNumber = () => {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `BK${ymd}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
};

/** Changes a variant's stock and writes the inventory ledger row. Caller supplies the transaction. */
export async function moveStock(variant, change, reason, { transaction, orderId = null, userId = null, note = null }) {
  const stockAfter = variant.stock + change;
  if (stockAfter < 0) throw new Error(`Stock for ${variant.sku} would go negative`);
  await variant.update({ stock: stockAfter }, { transaction });
  await Inventory.create({ variant_id: variant.id, change, stock_after: stockAfter, reason, order_id: orderId, user_id: userId, note }, { transaction });
}

/** Cancels an order: returns stock, reverses sold counts and coupon usage. Idempotent. */
export async function cancelOrder(orderId, { userId = null, note = 'Order cancelled' } = {}) {
  return sequelize.transaction(async (transaction) => {
    const order = await Order.findByPk(orderId, { include: [{ model: OrderItem, as: 'items' }], transaction, lock: transaction.LOCK.UPDATE });
    if (!order || order.status === 'cancelled') return order;
    for (const item of order.items) {
      if (!item.variant_id) continue;
      const variant = await Variant.findByPk(item.variant_id, { transaction, lock: transaction.LOCK.UPDATE });
      if (variant) await moveStock(variant, item.quantity, 'cancel', { transaction, orderId: order.id, userId, note });
      if (item.product_id) await Product.decrement('sold_count', { by: item.quantity, where: { id: item.product_id, sold_count: { [Op.gte]: item.quantity } }, transaction });
    }
    if (order.coupon_code) {
      const coupon = await Coupon.findOne({ where: { code: order.coupon_code }, transaction });
      if (coupon) {
        await CouponUsage.destroy({ where: { coupon_id: coupon.id, order_id: order.id }, transaction });
        await Coupon.decrement('used_count', { where: { id: coupon.id, used_count: { [Op.gt]: 0 } }, transaction });
      }
    }
    await order.update({ status: 'cancelled', payment_status: order.payment_status === 'pending' ? 'failed' : order.payment_status }, { transaction });
    return order;
  });
}

/** Marks a Razorpay payment as captured. Safe to call twice (checkout handler + webhook). */
export async function markRazorpayPaid({ providerOrderId, providerPaymentId, raw }) {
  return sequelize.transaction(async (transaction) => {
    const payment = await Payment.findOne({ where: { provider: 'razorpay', provider_order_id: providerOrderId }, transaction, lock: transaction.LOCK.UPDATE });
    if (!payment) return null;
    const order = await Order.findByPk(payment.order_id, { transaction, lock: transaction.LOCK.UPDATE });
    if (payment.status !== 'paid') {
      await payment.update({ status: 'paid', provider_payment_id: providerPaymentId, raw }, { transaction });
    }
    if (order.payment_status !== 'paid') {
      const update = { payment_status: 'paid' };
      if (order.status === 'pending') update.status = 'confirmed';
      if (order.status === 'cancelled') update.admin_note = `${order.admin_note || ''}\n[auto] Payment ${providerPaymentId} captured after the order was cancelled — refund or reinstate.`.trim();
      await order.update(update, { transaction });
    }
    return order;
  });
}

/** Releases stock held by online orders that were never paid. */
export async function expireUnpaidOrders(minutes = 30) {
  const stale = await Order.findAll({
    where: { payment_method: 'razorpay', payment_status: 'pending', status: 'pending', created_at: { [Op.lt]: new Date(Date.now() - minutes * 60 * 1000) } },
    attributes: ['id'],
  });
  for (const o of stale) await cancelOrder(o.id, { note: 'Payment not completed in time' });
  return stale.length;
}

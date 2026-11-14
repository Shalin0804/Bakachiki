// Razorpay over its REST API — no SDK needed. Amounts in this app are whole rupees; Razorpay wants paise.
import crypto from 'node:crypto';
import { HttpError } from '../middleware.js';

export const razorpayEnabled = () => Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

export async function createRazorpayOrder({ amountRupees, receipt, notes }) {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: amountRupees * 100, currency: 'INR', receipt, notes }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('Razorpay order error', data);
    throw new HttpError(502, 'Payment gateway is unavailable, please try again');
  }
  return data;
}

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/** Checkout handler signature: HMAC_SHA256(order_id|payment_id, key_secret). */
export const verifyPaymentSignature = ({ orderId, paymentId, signature, secret = process.env.RAZORPAY_KEY_SECRET }) =>
  safeEqual(crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex'), signature);

/** Webhook signature: HMAC_SHA256(raw body, webhook secret). */
export const verifyWebhookSignature = (rawBody, signature, secret = process.env.RAZORPAY_WEBHOOK_SECRET) =>
  Boolean(secret) && safeEqual(crypto.createHmac('sha256', secret).update(rawBody).digest('hex'), signature);

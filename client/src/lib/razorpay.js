import { api } from './api.js';

let loader;
const loadScript = () => {
  loader ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = resolve;
    s.onerror = () => { loader = null; reject(new Error('Could not load the payment window. Check your connection.')); };
    document.body.appendChild(s);
  });
  return loader;
};

/**
 * Opens Razorpay Checkout and verifies the payment on our server.
 * Resolves with the verified order, or { dismissed: true } if the customer closed the window.
 */
export async function payWithRazorpay(rp, { orderNumber, email }) {
  await loadScript();
  return new Promise((resolve, reject) => {
    const checkout = new window.Razorpay({
      key: rp.key,
      order_id: rp.order_id,
      amount: rp.amount,
      currency: rp.currency,
      name: 'BAKACHIKI',
      description: `Order ${orderNumber}`,
      prefill: rp.prefill,
      theme: { color: '#168A32' },
      handler: async (resp) => {
        try {
          const { data } = await api.post(`/orders/${orderNumber}/verify-payment`, resp, { params: { email } });
          resolve(data.order);
        } catch (e) { reject(e); }
      },
      modal: { ondismiss: () => resolve({ dismissed: true }) },
    });
    checkout.on('payment.failed', (r) => reject(new Error(r.error?.description || 'Payment failed')));
    checkout.open();
  });
}

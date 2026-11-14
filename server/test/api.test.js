// End-to-end API checks against a throwaway MySQL database (TEST_DB_NAME, default bakachiki_test).
// Run: npm test   (needs MySQL reachable with the credentials in server/.env)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mysql from 'mysql2/promise';

process.env.DB_NAME = process.env.TEST_DB_NAME || 'bakachiki_test';
process.env.JWT_SECRET ||= 'test-secret-test-secret-test-secret-123';
process.env.RAZORPAY_KEY_ID = 'rzp_test_dummy';
process.env.RAZORPAY_KEY_SECRET = 'rzp_secret_dummy';
process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_dummy';

const conn = await mysql.createConnection({ host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '' });
await conn.query(`DROP DATABASE IF EXISTS \`${process.env.DB_NAME}\``);
await conn.query(`CREATE DATABASE \`${process.env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
await conn.end();

const { app } = await import('../src/app.js');
const { umzug } = await import('../src/migrate.js');
const { sequelize } = await import('../src/db.js');
const M = await import('../src/models.js');
const { computeTotals, couponDiscount } = await import('../src/services/pricing.js');
const bcrypt = (await import('bcryptjs')).default;

// Stub Razorpay's order API so no network is needed.
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('https://api.razorpay.com/v1/orders')) {
    const body = JSON.parse(init.body);
    return new Response(JSON.stringify({ id: `order_${crypto.randomBytes(4).toString('hex')}`, amount: body.amount, currency: 'INR' }), { status: 200 });
  }
  return realFetch(url, init);
};

let server; let base; let variant; let product;
const call = async (method, path, { body, token, cart } = {}) => {
  const res = await realFetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }), ...(cart && { 'X-Cart-Token': cart }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
};
const address = { name: 'Test Buyer', phone: '9876543210', line1: '12 MG Road', city: 'Pune', state: 'Maharashtra', pincode: '411001' };

before(async () => {
  await umzug.up();
  await M.User.create({ name: 'Admin', email: 'admin@test.in', role: 'admin', password_hash: await bcrypt.hash('Admin@1234', 4) });
  product = await M.Product.create({ name: 'Test Tee', slug: 'test-tee', sku: 'T-1', price: 1500, discount_price: 1000 });
  variant = await M.Variant.create({ product_id: product.id, color: 'Black', color_hex: '#000000', size: 'M', sku: 'T-1-M', stock: 3 });
  await M.Coupon.create({ code: 'TEN', type: 'percent', value: 10, min_order: 500, per_user_limit: 1 });
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => { server?.close(); await sequelize.close(); });

test('pricing math', () => {
  const store = { shipping_flat: 99, free_shipping_threshold: 1499 };
  assert.equal(couponDiscount({ type: 'percent', value: 10, max_discount: 50 }, 1000), 50);
  assert.equal(couponDiscount({ type: 'fixed', value: 5000 }, 1000), 1000);
  assert.deepEqual(computeTotals([{ unit_price: 1000, quantity: 1 }], null, store).total, 1099);
  assert.equal(computeTotals([{ unit_price: 1000, quantity: 2 }], null, store).shipping, 0);
  assert.equal(computeTotals([], null, store).total, 0);
});

test('guest cart → register merges → COD checkout with coupon → admin cancel restores stock', async () => {
  const add = await call('POST', '/cart/items', { body: { variant_id: variant.id, quantity: 2 } });
  assert.equal(add.status, 201);
  const guest = add.body.token;
  assert.match(guest, /^[a-f0-9]{48}$/);
  assert.equal(add.body.totals.subtotal, 2000);

  const reg = await call('POST', '/auth/register', { body: { name: 'Buyer', email: 'buyer@test.in', password: 'Buyer@1234' }, cart: guest });
  assert.equal(reg.status, 201);
  const token = reg.body.token;
  const cart = await call('GET', '/cart?coupon=TEN', { token });
  assert.equal(cart.body.items.length, 1, 'guest cart merged into user cart');
  assert.equal(cart.body.totals.discount, 200);

  const order = await call('POST', '/orders', { token, body: { ...address, email: 'buyer@test.in', payment_method: 'cod', coupon_code: 'TEN' } });
  assert.equal(order.status, 201, JSON.stringify(order.body));
  assert.equal(order.body.order.total, 1800); // 2000 − 10% = 1800 ≥ 1499 → free shipping
  await variant.reload();
  assert.equal(variant.stock, 1);
  assert.equal((await call('GET', '/cart', { token })).body.items.length, 0, 'cart cleared');

  // Coupon is single-use per email.
  await call('POST', '/cart/items', { token, body: { variant_id: variant.id, quantity: 1 } });
  const again = await call('POST', '/orders', { token, body: { ...address, email: 'buyer@test.in', payment_method: 'cod', coupon_code: 'TEN' } });
  assert.equal(again.status, 422);

  const admin = (await call('POST', '/auth/admin/login', { body: { email: 'admin@test.in', password: 'Admin@1234' } })).body.token;
  assert.equal((await call('GET', '/admin/stats', { token })).status, 401, 'customer tokens cannot reach admin');
  const list = await call('GET', `/admin/orders?q=${order.body.order.order_number}`, { token: admin });
  const id = list.body.orders[0].id;
  const cancel = await call('PATCH', `/admin/orders/${id}`, { token: admin, body: { status: 'cancelled' } });
  assert.equal(cancel.body.order.status, 'cancelled');
  await variant.reload();
  assert.equal(variant.stock, 3, 'stock returned');
  assert.equal(await M.CouponUsage.count(), 0, 'coupon usage reversed');
  const reopen = await call('PATCH', `/admin/orders/${id}`, { token: admin, body: { status: 'confirmed' } });
  assert.equal(reopen.status, 422);
});

test('two buyers racing for the last unit: exactly one wins', async () => {
  await variant.update({ stock: 1 });
  const carts = await Promise.all([1, 2].map(() => call('POST', '/cart/items', { body: { variant_id: variant.id, quantity: 1 } })));
  const results = await Promise.all(carts.map((c, i) => call('POST', '/orders', { cart: c.body.token, body: { ...address, email: `racer${i}@test.in`, payment_method: 'cod' } })));
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  await variant.reload();
  assert.equal(variant.stock, 0);
});

test('razorpay: only a valid signature marks the order paid; admin cannot fake it', async () => {
  await variant.update({ stock: 5 });
  const c = await call('POST', '/cart/items', { body: { variant_id: variant.id, quantity: 1 } });
  const res = await call('POST', '/orders', { cart: c.body.token, body: { ...address, email: 'online@test.in', payment_method: 'razorpay' } });
  assert.equal(res.status, 201);
  const { order_number: num } = res.body.order;
  const rpOrder = res.body.razorpay.order_id;
  assert.equal(res.body.order.payment_status, 'pending');

  const admin = (await call('POST', '/auth/admin/login', { body: { email: 'admin@test.in', password: 'Admin@1234' } })).body.token;
  const dbOrder = await M.Order.findOne({ where: { order_number: num } });
  assert.equal((await call('PATCH', `/admin/orders/${dbOrder.id}`, { token: admin, body: { payment_status: 'paid' } })).status, 422);

  const path = `/orders/${num}/verify-payment?email=online@test.in`;
  const bad = await call('POST', path, { body: { razorpay_order_id: rpOrder, razorpay_payment_id: 'pay_1', razorpay_signature: 'nope' } });
  assert.equal(bad.status, 400);

  const sig = crypto.createHmac('sha256', 'rzp_secret_dummy').update(`${rpOrder}|pay_1`).digest('hex');
  const good = await call('POST', path, { body: { razorpay_order_id: rpOrder, razorpay_payment_id: 'pay_1', razorpay_signature: sig } });
  assert.equal(good.status, 200);
  assert.equal(good.body.order.payment_status, 'paid');
  assert.equal(good.body.order.status, 'confirmed');

  // Webhook with a forged signature is rejected.
  const hook = await realFetch(base + '/payments/razorpay/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Razorpay-Signature': 'forged' }, body: '{}' });
  assert.equal(hook.status, 400);
});

test('guests cannot read other people\'s orders', async () => {
  const any = await M.Order.findOne();
  assert.equal((await call('GET', `/orders/${any.order_number}`)).status, 404);
  assert.equal((await call('GET', `/orders/${any.order_number}?email=wrong@x.in`)).status, 404);
});

test('customer and admin logins are separate; roles come from the database', async () => {
  const login = (path, email, password) => call('POST', path, { body: { email, password } });
  await M.User.create({ name: 'Boss', email: 'boss@test.in', role: 'super_admin', password_hash: await bcrypt.hash('Boss@12345', 4) });
  await call('POST', '/auth/register', { body: { name: 'Cust', email: 'cust@test.in', password: 'Cust@12345', role: 'super_admin' } });
  assert.equal((await M.User.findOne({ where: { email: 'cust@test.in' } })).role, 'customer', 'register ignores a supplied role');

  // Each login form only accepts its own kind of account, with the same generic error.
  assert.equal((await login('/auth/login', 'admin@test.in', 'Admin@1234')).status, 401);
  assert.equal((await login('/auth/admin/login', 'cust@test.in', 'Cust@12345')).status, 401);
  const cust = (await login('/auth/login', 'cust@test.in', 'Cust@12345')).body.token;
  const admin = (await login('/auth/admin/login', 'admin@test.in', 'Admin@1234')).body.token;
  const boss = (await login('/auth/admin/login', 'boss@test.in', 'Boss@12345')).body.token;
  assert.ok(cust && admin && boss);

  // Tokens only work on their own side.
  assert.equal((await call('GET', '/auth/me', { token: cust })).status, 200);
  assert.equal((await call('GET', '/auth/me', { token: admin })).status, 401, 'admin token is not a storefront session');
  assert.equal((await call('GET', '/admin/stats', { token: cust })).status, 401);
  assert.equal((await call('GET', '/auth/admin/me', { token: admin })).body.user.role, 'admin');
  assert.equal((await call('GET', '/admin/stats', { token: admin })).status, 200);

  // A forged token claiming a role is ignored: the role is read from MySQL.
  const jwt = (await import('jsonwebtoken')).default;
  const custId = (await M.User.findOne({ where: { email: 'cust@test.in' } })).id;
  const forged = jwt.sign({ sub: custId, role: 'super_admin' }, process.env.JWT_SECRET, { audience: 'admin' });
  assert.equal((await call('GET', '/admin/stats', { token: forged })).status, 401);

  // Only super_admin manages staff.
  assert.equal((await call('GET', '/admin/staff', { token: admin })).status, 403);
  const made = await call('POST', '/admin/staff', { token: boss, body: { name: 'New Admin', email: 'new@test.in', password: 'NewAdmin@1', role: 'admin' } });
  assert.equal(made.status, 201);
  assert.equal((await call('PATCH', `/admin/staff/${made.body.user.id}`, { token: admin, body: { role: 'super_admin' } })).status, 403);
  const bossId = (await call('GET', '/auth/admin/me', { token: boss })).body.user.id;
  assert.equal((await call('PATCH', `/admin/staff/${bossId}`, { token: boss, body: { is_active: false } })).status, 422, 'no self-lockout');

  // Deactivating cuts off both new logins and existing tokens.
  const newTok = (await login('/auth/admin/login', 'new@test.in', 'NewAdmin@1')).body.token;
  assert.equal((await call('PATCH', `/admin/staff/${made.body.user.id}`, { token: boss, body: { is_active: false } })).status, 200);
  assert.equal((await call('GET', '/admin/stats', { token: newTok })).status, 401);
  assert.equal((await login('/auth/admin/login', 'new@test.in', 'NewAdmin@1')).status, 401);
  assert.equal((await call('PATCH', `/admin/customers/${custId}`, { token: admin, body: { is_active: false } })).status, 200);
  assert.equal((await call('GET', '/auth/me', { token: cust })).status, 401);
});

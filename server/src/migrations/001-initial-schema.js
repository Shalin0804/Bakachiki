// Initial schema. Never edit after it has run anywhere — add a new migration instead.
import { DataTypes as T } from 'sequelize';

const pk = { type: T.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true };
const ts = {
  created_at: { type: T.DATE, allowNull: false, defaultValue: T.NOW },
  updated_at: { type: T.DATE, allowNull: false, defaultValue: T.NOW },
};
const ref = (table, onDelete = 'CASCADE', allowNull = false) => ({
  type: T.INTEGER.UNSIGNED, allowNull, references: { model: table, key: 'id' }, onUpdate: 'CASCADE', onDelete,
});
const money = (allowNull = false) => ({ type: T.INTEGER.UNSIGNED, allowNull });
const str = (len, allowNull = true) => ({ type: T.STRING(len), allowNull });
const bool = (def = false) => ({ type: T.BOOLEAN, allowNull: false, defaultValue: def });
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

export async function up({ context: qi }) {
  const opts = { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci', engine: 'InnoDB' };
  const create = (name, cols) => qi.createTable(name, cols, opts);

  await create('users', {
    id: pk, name: str(120, false), email: { ...str(190, false), unique: true }, phone: str(20),
    password_hash: str(100, false), role: { type: T.ENUM('customer', 'admin'), allowNull: false, defaultValue: 'customer' },
    reset_token_hash: str(64), reset_expires: T.DATE, ...ts,
  });
  await create('user_addresses', {
    id: pk, user_id: ref('users'), label: { ...str(40), defaultValue: 'Home' }, name: str(120, false), phone: str(20, false),
    line1: str(200, false), line2: str(200), city: str(80, false), state: str(80, false), pincode: str(6, false),
    is_default: bool(), ...ts,
  });
  await create('categories', {
    id: pk, name: str(80, false), slug: { ...str(100, false), unique: true }, description: T.TEXT, image_url: str(500),
    sort_order: { type: T.INTEGER, allowNull: false, defaultValue: 0 }, ...ts,
  });
  await create('collections', {
    id: pk, name: str(80, false), slug: { ...str(100, false), unique: true }, tagline: str(200), description: T.TEXT,
    image_url: str(500), is_active: bool(true), sort_order: { type: T.INTEGER, allowNull: false, defaultValue: 0 }, ...ts,
  });
  await create('products', {
    id: pk, name: str(150, false), slug: { ...str(170, false), unique: true }, sku: { ...str(60, false), unique: true },
    description: T.TEXT, price: money(), discount_price: money(true), category_id: ref('categories', 'SET NULL', true),
    fabric: str(120), gsm: T.SMALLINT.UNSIGNED, fit: str(80), print_type: str(80), hotspots: T.JSON,
    is_featured: bool(), is_new_arrival: bool(), is_best_seller: bool(), is_active: bool(true),
    sold_count: { type: T.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    meta_title: str(160), meta_description: str(300), ...ts,
  });
  await create('product_collections', {
    product_id: { ...ref('products'), primaryKey: true }, collection_id: { ...ref('collections'), primaryKey: true },
  });
  await create('product_images', {
    id: pk, product_id: ref('products'),
    kind: { type: T.ENUM('front', 'back', 'side', 'fabric', 'print', 'model', 'gallery', 'frame', 'video'), allowNull: false, defaultValue: 'gallery' },
    url: str(500, false), storage_key: str(300), alt: str(200), color: str(40),
    sort_order: { type: T.INTEGER, allowNull: false, defaultValue: 0 }, ...ts,
  });
  await create('product_variants', {
    id: pk, product_id: ref('products'), color: str(40, false), color_hex: { ...str(7), defaultValue: '#000000' },
    size: { type: T.ENUM(...SIZES), allowNull: false }, sku: { ...str(80, false), unique: true },
    stock: { type: T.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 }, ...ts,
  });
  await create('inventory', {
    id: pk, variant_id: ref('product_variants'), change: { type: T.INTEGER, allowNull: false },
    stock_after: { type: T.INTEGER.UNSIGNED, allowNull: false },
    reason: { type: T.ENUM('initial', 'restock', 'adjustment', 'order', 'cancel'), allowNull: false },
    order_id: { type: T.INTEGER.UNSIGNED, allowNull: true }, user_id: ref('users', 'SET NULL', true), note: str(255),
    created_at: ts.created_at,
  });
  await create('carts', {
    id: pk, user_id: { ...ref('users', 'CASCADE', true), unique: true }, token: { ...str(64), unique: true }, ...ts,
  });
  await create('cart_items', {
    id: pk, cart_id: ref('carts'), variant_id: ref('product_variants'),
    quantity: { type: T.SMALLINT.UNSIGNED, allowNull: false, defaultValue: 1 }, ...ts,
  });
  await create('wishlists', { id: pk, user_id: ref('users'), product_id: ref('products'), ...ts });
  await create('orders', {
    id: pk, order_number: { ...str(24, false), unique: true }, user_id: ref('users', 'SET NULL', true),
    name: str(120, false), email: str(190, false), phone: str(20, false), line1: str(200, false), line2: str(200),
    city: str(80, false), state: str(80, false), pincode: str(6, false),
    subtotal: money(), discount: { ...money(), defaultValue: 0 }, shipping: { ...money(), defaultValue: 0 }, total: money(),
    coupon_code: str(40), payment_method: { type: T.ENUM('razorpay', 'cod'), allowNull: false },
    payment_status: { type: T.ENUM('pending', 'paid', 'failed', 'refunded'), allowNull: false, defaultValue: 'pending' },
    status: { type: T.ENUM('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'), allowNull: false, defaultValue: 'pending' },
    tracking_carrier: str(80), tracking_number: str(80), tracking_url: str(500), admin_note: T.TEXT, ...ts,
  });
  await qi.addConstraint('inventory', { type: 'foreign key', fields: ['order_id'], references: { table: 'orders', field: 'id' }, onDelete: 'SET NULL', name: 'inventory_order_fk' });
  await create('order_items', {
    id: pk, order_id: ref('orders'), product_id: ref('products', 'SET NULL', true), variant_id: ref('product_variants', 'SET NULL', true),
    name: str(150, false), sku: str(80), color: str(40), size: str(5), image_url: str(500),
    unit_price: money(), quantity: { type: T.SMALLINT.UNSIGNED, allowNull: false }, ...ts,
  });
  await create('payments', {
    id: pk, order_id: ref('orders'), provider: { type: T.ENUM('razorpay', 'cod'), allowNull: false },
    provider_order_id: str(80), provider_payment_id: str(80), amount: money(), currency: { ...str(3), defaultValue: 'INR' },
    status: { type: T.ENUM('created', 'paid', 'failed', 'refunded'), allowNull: false, defaultValue: 'created' }, raw: T.JSON, ...ts,
  });
  await create('coupons', {
    id: pk, code: { ...str(40, false), unique: true }, description: str(200), type: { type: T.ENUM('percent', 'fixed'), allowNull: false },
    value: { type: T.INTEGER.UNSIGNED, allowNull: false }, min_order: { type: T.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    max_discount: T.INTEGER.UNSIGNED, starts_at: T.DATE, expires_at: T.DATE, usage_limit: T.INTEGER.UNSIGNED,
    per_user_limit: T.INTEGER.UNSIGNED, used_count: { type: T.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    is_active: bool(true), ...ts,
  });
  await create('coupon_usage', {
    id: pk, coupon_id: ref('coupons'), order_id: ref('orders'), user_id: ref('users', 'SET NULL', true),
    email: str(190, false), created_at: ts.created_at,
  });
  await create('product_reviews', {
    id: pk, product_id: ref('products'), user_id: ref('users'), rating: { type: T.TINYINT.UNSIGNED, allowNull: false },
    title: str(120), body: T.TEXT, is_approved: bool(true), ...ts,
  });
  await create('site_settings', { id: pk, key: { ...str(80, false), unique: true }, value: T.JSON, ...ts });

  // Indexes for the hot query paths (unique columns are already indexed).
  await qi.addIndex('user_addresses', ['user_id']);
  await qi.addIndex('products', ['category_id']);
  await qi.addIndex('products', ['is_active', 'created_at']);
  await qi.addIndex('products', ['is_active', 'sold_count']);
  await qi.addIndex('products', ['is_active', 'price']);
  await qi.addIndex('product_images', ['product_id', 'kind', 'sort_order']);
  await qi.addIndex('product_variants', ['product_id', 'color', 'size'], { unique: true });
  await qi.addIndex('product_variants', ['size']);
  await qi.addIndex('product_variants', ['color']);
  await qi.addIndex('inventory', ['variant_id', 'created_at']);
  await qi.addIndex('cart_items', ['cart_id', 'variant_id'], { unique: true });
  await qi.addIndex('wishlists', ['user_id', 'product_id'], { unique: true });
  await qi.addIndex('orders', ['user_id', 'created_at']);
  await qi.addIndex('orders', ['email']);
  await qi.addIndex('orders', ['status', 'created_at']);
  await qi.addIndex('orders', ['payment_status']);
  await qi.addIndex('order_items', ['order_id']);
  await qi.addIndex('payments', ['order_id']);
  await qi.addIndex('payments', ['provider_order_id']);
  await qi.addIndex('coupon_usage', ['coupon_id', 'email']);
  await qi.addIndex('product_reviews', ['product_id', 'user_id'], { unique: true });
}

export async function down({ context: qi }) {
  const tables = ['site_settings', 'product_reviews', 'coupon_usage', 'coupons', 'payments', 'order_items', 'inventory', 'orders',
    'wishlists', 'cart_items', 'carts', 'product_variants', 'product_images', 'product_collections', 'products',
    'collections', 'categories', 'user_addresses', 'users'];
  for (const t of tables) await qi.dropTable(t);
}

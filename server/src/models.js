// All Sequelize models. Attributes are snake_case so API JSON matches DB columns 1:1.
// Schema changes go into a new file in src/migrations, then mirror them here.
import { DataTypes as T } from 'sequelize';
import { sequelize } from './db.js';

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
export const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
export const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'];
export const MEDIA_KINDS = ['front', 'back', 'side', 'fabric', 'print', 'model', 'gallery', 'frame', 'video'];
export { SIZES };

const id = { type: T.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true };
const fk = (allowNull = false) => ({ type: T.INTEGER.UNSIGNED, allowNull });
const money = (allowNull = false) => ({ type: T.INTEGER.UNSIGNED, allowNull, validate: { min: 0 } });

export const User = sequelize.define('User', {
  id,
  name: { type: T.STRING(120), allowNull: false },
  email: { type: T.STRING(190), allowNull: false, unique: true, validate: { isEmail: true } },
  phone: T.STRING(20),
  password_hash: { type: T.STRING(100), allowNull: false },
  role: { type: T.ENUM('customer', 'admin'), allowNull: false, defaultValue: 'customer' },
  reset_token_hash: T.STRING(64),
  reset_expires: T.DATE,
}, {
  tableName: 'users',
  defaultScope: { attributes: { exclude: ['password_hash', 'reset_token_hash', 'reset_expires'] } },
  scopes: { withSecrets: { attributes: { include: ['password_hash', 'reset_token_hash', 'reset_expires'] } } },
});

export const Address = sequelize.define('Address', {
  id,
  user_id: fk(),
  label: { type: T.STRING(40), defaultValue: 'Home' },
  name: { type: T.STRING(120), allowNull: false },
  phone: { type: T.STRING(20), allowNull: false },
  line1: { type: T.STRING(200), allowNull: false },
  line2: T.STRING(200),
  city: { type: T.STRING(80), allowNull: false },
  state: { type: T.STRING(80), allowNull: false },
  pincode: { type: T.STRING(6), allowNull: false, validate: { is: /^\d{6}$/ } },
  is_default: { type: T.BOOLEAN, defaultValue: false },
}, { tableName: 'user_addresses' });

export const Category = sequelize.define('Category', {
  id,
  name: { type: T.STRING(80), allowNull: false },
  slug: { type: T.STRING(100), allowNull: false, unique: true },
  description: T.TEXT,
  image_url: T.STRING(500),
  sort_order: { type: T.INTEGER, defaultValue: 0 },
}, { tableName: 'categories' });

export const Collection = sequelize.define('Collection', {
  id,
  name: { type: T.STRING(80), allowNull: false },
  slug: { type: T.STRING(100), allowNull: false, unique: true },
  tagline: T.STRING(200),
  description: T.TEXT,
  image_url: T.STRING(500),
  is_active: { type: T.BOOLEAN, defaultValue: true },
  sort_order: { type: T.INTEGER, defaultValue: 0 },
}, { tableName: 'collections' });

export const Product = sequelize.define('Product', {
  id,
  name: { type: T.STRING(150), allowNull: false },
  slug: { type: T.STRING(170), allowNull: false, unique: true },
  sku: { type: T.STRING(60), allowNull: false, unique: true },
  description: T.TEXT,
  price: money(),
  discount_price: money(true),
  category_id: fk(true),
  fabric: T.STRING(120),
  gsm: T.SMALLINT.UNSIGNED,
  fit: T.STRING(80),
  print_type: T.STRING(80),
  hotspots: { type: T.JSON, defaultValue: [] }, // [{ x, y, title, body }] in % of the viewer
  is_featured: { type: T.BOOLEAN, defaultValue: false },
  is_new_arrival: { type: T.BOOLEAN, defaultValue: false },
  is_best_seller: { type: T.BOOLEAN, defaultValue: false },
  is_active: { type: T.BOOLEAN, defaultValue: true },
  sold_count: { type: T.INTEGER.UNSIGNED, defaultValue: 0 },
  meta_title: T.STRING(160),
  meta_description: T.STRING(300),
}, { tableName: 'products' });

export const ProductImage = sequelize.define('ProductImage', {
  id,
  product_id: fk(),
  kind: { type: T.ENUM(...MEDIA_KINDS), allowNull: false, defaultValue: 'gallery' },
  url: { type: T.STRING(500), allowNull: false },
  storage_key: T.STRING(300),
  alt: T.STRING(200),
  color: T.STRING(40), // null = applies to every colour
  sort_order: { type: T.INTEGER, defaultValue: 0 },
}, { tableName: 'product_images' });

export const Variant = sequelize.define('Variant', {
  id,
  product_id: fk(),
  color: { type: T.STRING(40), allowNull: false },
  color_hex: { type: T.STRING(7), defaultValue: '#000000' },
  size: { type: T.ENUM(...SIZES), allowNull: false },
  sku: { type: T.STRING(80), allowNull: false, unique: true },
  stock: { type: T.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
}, { tableName: 'product_variants' });

export const Inventory = sequelize.define('Inventory', {
  id,
  variant_id: fk(),
  change: { type: T.INTEGER, allowNull: false },
  stock_after: { type: T.INTEGER.UNSIGNED, allowNull: false },
  reason: { type: T.ENUM('initial', 'restock', 'adjustment', 'order', 'cancel'), allowNull: false },
  order_id: fk(true),
  user_id: fk(true),
  note: T.STRING(255),
}, { tableName: 'inventory', updatedAt: false });

export const Cart = sequelize.define('Cart', {
  id,
  user_id: { ...fk(true), unique: true },
  token: { type: T.STRING(64), unique: true }, // guest carts
}, { tableName: 'carts' });

export const CartItem = sequelize.define('CartItem', {
  id,
  cart_id: fk(),
  variant_id: fk(),
  quantity: { type: T.SMALLINT.UNSIGNED, allowNull: false, defaultValue: 1, validate: { min: 1, max: 10 } },
}, { tableName: 'cart_items' });

export const Wishlist = sequelize.define('Wishlist', {
  id,
  user_id: fk(),
  product_id: fk(),
}, { tableName: 'wishlists' });

export const Order = sequelize.define('Order', {
  id,
  order_number: { type: T.STRING(24), allowNull: false, unique: true },
  user_id: fk(true),
  name: { type: T.STRING(120), allowNull: false },
  email: { type: T.STRING(190), allowNull: false },
  phone: { type: T.STRING(20), allowNull: false },
  line1: { type: T.STRING(200), allowNull: false },
  line2: T.STRING(200),
  city: { type: T.STRING(80), allowNull: false },
  state: { type: T.STRING(80), allowNull: false },
  pincode: { type: T.STRING(6), allowNull: false },
  subtotal: money(),
  discount: { ...money(), defaultValue: 0 },
  shipping: { ...money(), defaultValue: 0 },
  total: money(),
  coupon_code: T.STRING(40),
  payment_method: { type: T.ENUM('razorpay', 'cod'), allowNull: false },
  payment_status: { type: T.ENUM(...PAYMENT_STATUSES), allowNull: false, defaultValue: 'pending' },
  status: { type: T.ENUM(...ORDER_STATUSES), allowNull: false, defaultValue: 'pending' },
  tracking_carrier: T.STRING(80),
  tracking_number: T.STRING(80),
  tracking_url: T.STRING(500),
  admin_note: T.TEXT,
}, { tableName: 'orders' });

export const OrderItem = sequelize.define('OrderItem', {
  id,
  order_id: fk(),
  product_id: fk(true),
  variant_id: fk(true),
  name: { type: T.STRING(150), allowNull: false },
  sku: T.STRING(80),
  color: T.STRING(40),
  size: T.STRING(5),
  image_url: T.STRING(500),
  unit_price: money(),
  quantity: { type: T.SMALLINT.UNSIGNED, allowNull: false },
}, { tableName: 'order_items' });

export const Payment = sequelize.define('Payment', {
  id,
  order_id: fk(),
  provider: { type: T.ENUM('razorpay', 'cod'), allowNull: false },
  provider_order_id: T.STRING(80),
  provider_payment_id: T.STRING(80),
  amount: money(), // rupees
  currency: { type: T.STRING(3), defaultValue: 'INR' },
  status: { type: T.ENUM('created', 'paid', 'failed', 'refunded'), allowNull: false, defaultValue: 'created' },
  raw: T.JSON,
}, { tableName: 'payments' });

export const Coupon = sequelize.define('Coupon', {
  id,
  code: { type: T.STRING(40), allowNull: false, unique: true },
  description: T.STRING(200),
  type: { type: T.ENUM('percent', 'fixed'), allowNull: false },
  value: { type: T.INTEGER.UNSIGNED, allowNull: false },
  min_order: { type: T.INTEGER.UNSIGNED, defaultValue: 0 },
  max_discount: T.INTEGER.UNSIGNED,
  starts_at: T.DATE,
  expires_at: T.DATE,
  usage_limit: T.INTEGER.UNSIGNED,
  per_user_limit: T.INTEGER.UNSIGNED,
  used_count: { type: T.INTEGER.UNSIGNED, defaultValue: 0 },
  is_active: { type: T.BOOLEAN, defaultValue: true },
}, { tableName: 'coupons' });

export const CouponUsage = sequelize.define('CouponUsage', {
  id,
  coupon_id: fk(),
  order_id: fk(),
  user_id: fk(true),
  email: { type: T.STRING(190), allowNull: false },
}, { tableName: 'coupon_usage', updatedAt: false });

export const Review = sequelize.define('Review', {
  id,
  product_id: fk(),
  user_id: fk(),
  rating: { type: T.TINYINT.UNSIGNED, allowNull: false, validate: { min: 1, max: 5 } },
  title: T.STRING(120),
  body: T.TEXT,
  is_approved: { type: T.BOOLEAN, defaultValue: true },
}, { tableName: 'product_reviews' });

export const Setting = sequelize.define('Setting', {
  id,
  key: { type: T.STRING(80), allowNull: false, unique: true },
  value: T.JSON,
}, { tableName: 'site_settings' });

// --- Associations (foreign keys spelled out because attributes are snake_case) ---
User.hasMany(Address, { foreignKey: 'user_id', as: 'addresses' });
User.hasMany(Order, { foreignKey: 'user_id', as: 'orders' });
User.hasOne(Cart, { foreignKey: 'user_id' });
Address.belongsTo(User, { foreignKey: 'user_id' });

Category.hasMany(Product, { foreignKey: 'category_id', as: 'products' });
Product.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });
Product.belongsToMany(Collection, { through: 'product_collections', foreignKey: 'product_id', otherKey: 'collection_id', as: 'collections', timestamps: false });
Collection.belongsToMany(Product, { through: 'product_collections', foreignKey: 'collection_id', otherKey: 'product_id', as: 'products', timestamps: false });
Product.hasMany(ProductImage, { foreignKey: 'product_id', as: 'images' });
Product.hasMany(Variant, { foreignKey: 'product_id', as: 'variants' });
Product.hasMany(Review, { foreignKey: 'product_id', as: 'reviews' });
ProductImage.belongsTo(Product, { foreignKey: 'product_id' });
Variant.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
Variant.hasMany(Inventory, { foreignKey: 'variant_id', as: 'movements' });
Inventory.belongsTo(Variant, { foreignKey: 'variant_id', as: 'variant' });

Cart.hasMany(CartItem, { foreignKey: 'cart_id', as: 'items' });
CartItem.belongsTo(Cart, { foreignKey: 'cart_id' });
CartItem.belongsTo(Variant, { foreignKey: 'variant_id', as: 'variant' });

Wishlist.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
User.hasMany(Wishlist, { foreignKey: 'user_id' });

Order.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Order.hasMany(OrderItem, { foreignKey: 'order_id', as: 'items' });
Order.hasMany(Payment, { foreignKey: 'order_id', as: 'payments' });
OrderItem.belongsTo(Order, { foreignKey: 'order_id' });
Payment.belongsTo(Order, { foreignKey: 'order_id' });

Coupon.hasMany(CouponUsage, { foreignKey: 'coupon_id', as: 'usages' });
CouponUsage.belongsTo(Coupon, { foreignKey: 'coupon_id' });

Review.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Review.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

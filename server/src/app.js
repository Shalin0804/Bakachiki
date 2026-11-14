import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { Product, Category, Collection, ProductImage } from './models.js';
import { notFound, errorHandler } from './middleware.js';
import { UPLOAD_ROOT } from './services/storage.js';
import { getSetting } from './services/settings.js';
import authRoutes from './routes/auth.js';
import accountRoutes from './routes/account.js';
import productRoutes from './routes/products.js';
import cartRoutes from './routes/cart.js';
import orderRoutes, { razorpayWebhook } from './routes/orders.js';
import adminRoutes from './routes/admin.js';

const CLIENT_DIST = path.resolve(import.meta.dirname, '../../client/dist');
const origins = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((s) => s.trim());
const siteUrl = () => origins[0].replace(/\/$/, '');

export const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // let the Vite dev origin load /uploads images
  contentSecurityPolicy: {
    directives: {
      'script-src': ["'self'", 'https://checkout.razorpay.com'],
      'frame-src': ["'self'", 'https://api.razorpay.com', 'https://checkout.razorpay.com'],
      'img-src': ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
      'media-src': ["'self'", 'blob:', 'https://res.cloudinary.com'],
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'https://fonts.gstatic.com'],
      'connect-src': ["'self'", 'https://api.razorpay.com', 'https://lumberjack.razorpay.com'],
    },
  },
}));
app.use(cors({ origin: origins, exposedHeaders: ['RateLimit'] }));

// Webhook needs the raw body for signature verification — register before express.json().
app.post('/api/payments/razorpay/webhook', express.raw({ type: 'application/json', limit: '1mb' }), razorpayWebhook);

app.use(express.json({ limit: '1mb' }));
app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many requests, slow down a little' } }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', productRoutes);
app.use('/api', notFound);

app.use('/uploads', express.static(UPLOAD_ROOT, { maxAge: '30d', fallthrough: false }));

// --- SEO ---
app.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /account\nDisallow: /checkout\nDisallow: /cart\n\nSitemap: ${siteUrl()}/sitemap.xml\n`);
});

app.get('/sitemap.xml', async (_req, res) => {
  const [products, categories, collections] = await Promise.all([
    Product.findAll({ where: { is_active: true }, attributes: ['slug', 'updated_at'] }),
    Category.findAll({ attributes: ['slug', 'updated_at'] }),
    Collection.findAll({ where: { is_active: true }, attributes: ['slug', 'updated_at'] }),
  ]);
  const url = (loc, lastmod, priority) => `<url><loc>${siteUrl()}${loc}</loc>${lastmod ? `<lastmod>${new Date(lastmod).toISOString().slice(0, 10)}</lastmod>` : ''}<priority>${priority}</priority></url>`;
  const urls = [
    url('/', null, '1.0'), url('/shop', null, '0.9'), url('/new-drops', null, '0.9'), url('/collections', null, '0.7'),
    url('/about', null, '0.5'), url('/contact', null, '0.4'),
    ...categories.map((c) => url(`/shop/${c.slug}`, c.updated_at, '0.7')),
    ...collections.map((c) => url(`/collections/${c.slug}`, c.updated_at, '0.7')),
    ...products.map((p) => url(`/product/${p.slug}`, p.updated_at, '0.8')),
  ];
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`);
});

// --- Production: serve the built React app, with per-product meta tags for crawlers that don't run JS ---
if (fs.existsSync(path.join(CLIENT_DIST, 'index.html'))) {
  const html = fs.readFileSync(path.join(CLIENT_DIST, 'index.html'), 'utf8');
  const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const withMeta = ({ title, description, image, url }) => html
    .replace(/<title>.*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*/, `$1${esc(description)}`)
    .replace(/(<meta property="og:title" content=")[^"]*/, `$1${esc(title)}`)
    .replace(/(<meta property="og:description" content=")[^"]*/, `$1${esc(description)}`)
    .replace(/(<meta property="og:image" content=")[^"]*/, `$1${esc(image)}`)
    .replace(/(<meta property="og:url" content=")[^"]*/, `$1${esc(url)}`);

  app.use(express.static(CLIENT_DIST, { index: false, maxAge: '1y', immutable: true }));
  app.get(/^(?!\/api|\/uploads).*/, async (req, res) => {
    const seo = await getSetting('seo');
    const abs = (u) => (u?.startsWith('http') ? u : `${siteUrl()}${u || ''}`);
    let meta = { title: seo.title, description: seo.description, image: abs(seo.og_image), url: `${siteUrl()}${req.path}` };
    const m = req.path.match(/^\/product\/([\w-]+)$/);
    if (m) {
      const p = await Product.findOne({ where: { slug: m[1], is_active: true }, include: [{ model: ProductImage, as: 'images' }] });
      if (p) {
        const img = p.images.sort((a, b) => a.sort_order - b.sort_order).find((i) => i.kind === 'front') || p.images[0];
        meta = { ...meta, title: p.meta_title || `${p.name} | BAKACHIKI`, description: p.meta_description || (p.description || '').slice(0, 160), image: abs(img?.url) };
      }
    }
    res.set('Cache-Control', 'no-cache').send(withMeta(meta));
  });
}

app.use(notFound);
app.use(errorHandler);

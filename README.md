# BAKACHIKI — Hindi Streetwear Store

Full-stack e-commerce site for **BAKACHIKI**, an Indian streetwear label making oversized tees with loud Hindi typography and raised puff print.

| Layer | Stack |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS 4, Framer Motion, Lucide, React Router, Axios |
| Backend | Node.js 20+, Express 5 (REST), Zod validation, JWT + bcrypt, Helmet, rate limiting |
| Database | MySQL 8, Sequelize ORM, Umzug migrations |
| Payments | Razorpay (server-verified) + admin-toggleable Cash on Delivery |
| Media | Local disk (`server/uploads`) or Cloudinary, switchable via env |

```
bakachiki/
├─ client/                 React storefront + admin (admin is a separate lazy-loaded app at /admin)
│  └─ src/
│     ├─ pages/            Home, Shop, Product, Cart, Checkout, OrderView, Auth, Account, About, Contact
│     ├─ components/       Header, Footer, ProductCard, ProductViewer (360°), PurchasePanel, QuickView, ui
│     ├─ admin/            Dashboard, Products, Orders (+ invoice), Customers, Coupons, Catalog, Content, Reviews
│     ├─ context/store.jsx Auth, cart, wishlist, settings and UI state
│     └─ lib/              api client, SEO hook, Razorpay checkout
└─ server/
   ├─ src/
   │  ├─ migrations/       Umzug migrations (schema lives here)
   │  ├─ routes/           auth, account, products, cart, orders, admin
   │  ├─ services/         pricing, cart, orders (stock/cancel/payment), razorpay, storage, settings, mail
   │  ├─ models.js         Sequelize models + associations
   │  ├─ app.js            Express app (security, routes, sitemap/robots, prod static + meta tags)
   │  └─ seed.js           Admin, categories, collections, launch products
   ├─ scripts/generate-seed-art.js   Placeholder SVG product art
   └─ test/api.test.js    End-to-end API tests (checkout, stock races, payments, auth)
```

## 1. Install

Requires **Node.js 20+** and **MySQL 8**.

```bash
npm run install:all        # installs server/ and client/
```

## 2. Database

Use your own MySQL 8 server, or start one with Docker:

```bash
docker compose up -d       # MySQL 8.0 on :3306, db "bakachiki", root password "bakachiki"
```

With your own server, create the database first:

```sql
CREATE DATABASE bakachiki CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## 3. Environment

```bash
cp server/.env.example server/.env
```

Edit `server/.env`:

| Variable | Notes |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | MySQL connection (Docker: password `bakachiki`) |
| `JWT_SECRET` | **Required.** Long random string: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `CLIENT_URL` | Site origin(s), comma-separated. Used for CORS, reset links, sitemap |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Admin account created by the seed |
| `STORAGE_DRIVER` | `local` (default) or `cloudinary` + `CLOUDINARY_*` keys |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Leave empty to hide online payment. Use `rzp_test_…` keys while testing |
| `RAZORPAY_WEBHOOK_SECRET` | Secret configured on the Razorpay webhook (see Deployment) |
| `SMTP_*`, `MAIL_FROM` | For password-reset emails. If empty, reset links are printed to the server console |

Secrets live only in `server/.env`. The client never sees them; the only payment value it receives is the public Razorpay key id.

## 4. Migrate & seed

```bash
npm run db:setup           # = migrate + seed (both idempotent)
```

- `npm run migrate --prefix server`: applies pending migrations.
- `npm run migrate:down --prefix server`: reverts the last migration.
- `npm run seed --prefix server`: creates the admin, two categories, two collections, the Black and Beige *Hindi Puff Oversized Tee* (sizes XS–XXL with stock) and a sample coupon `BAKA10`.

## 5. Run in development

Two terminals:

```bash
npm run dev:server         # API on http://localhost:5000 (auto-restarts on change)
npm run dev:client         # Store on http://localhost:5173 (proxies /api and /uploads)
```

## 6. Admin account

Log in at `/login` with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `server/.env` (defaults: `admin@bakachiki.in` / `ChangeMe@123`), then open **/admin**. **Change the password** from *My account → Password* right away.

To promote another user to admin, set `ADMIN_EMAIL` to their email and run `npm run seed --prefix server`. An existing account is promoted and keeps its password.

From the admin you can manage, without touching code:

- **Products**: details, price/discount, SKU, category, collections, fabric/GSM/fit/print type, featured/new/best-seller flags, colour × size variants with stock (every change is logged in the inventory ledger), media (front/back/side/fabric/print/model/gallery, videos, **360° frame sequences**), and the viewer's **hotspots** (click on the image to place them).
- **Orders**: status, payment status (COD only; online payments are set by Razorpay verification), courier/tracking, internal notes, printable invoice. Cancelling an order returns its stock and reverses coupon usage.
- **Customers**: profile, addresses, order history, lifetime spend.
- **Coupons**: percentage/fixed, minimum order, max discount, start/expiry, total and per-customer limits.
- **Categories & collections**, **Reviews** (hide/delete), and **Website content**: hero, announcement bar, scrolling banner, promo section, About, contact details, shipping fees / free-shipping threshold / COD toggle and limit, size guide, SEO defaults.

### Product imagery

The seed ships **placeholder SVG art** generated by `server/scripts/generate-seed-art.js`. Replace it with real photography in *Admin → Products → Media*.

**360° viewer:** upload 24–72 images as type **frame** for a colour in one go, named in order (`frame-01.jpg` … `frame-36.jpg`). With fewer than 8 frames, the viewer rotates through the real front → side → back shots with a crossfade instead; it never fakes rotation from a single image.

## 7. Tests

```bash
npm test                   # needs MySQL; creates/drops a throwaway DB "bakachiki_test"
```

The tests cover: pricing math, guest cart → account merge, coupon rules, COD checkout and stock deduction, two buyers racing for the last unit, admin cancel restoring stock, Razorpay signature verification (valid, forged, and admin trying to mark an online order paid), the webhook signature, and guest order privacy.

## 8. Build & deploy

The Express server serves the built React app, so a single Node process is enough:

```bash
npm run build              # builds client/dist
NODE_ENV=production npm start
```

In production the server:

- serves `client/dist` with long-lived caching and an SPA fallback;
- injects per-product `<title>`, description and Open Graph tags into the HTML for crawlers;
- serves `/sitemap.xml` and `/robots.txt` built from the database;
- needs `CLIENT_URL` set to your public origin, e.g. `https://bakachiki.in`.

**Checklist**

1. MySQL 8 (managed, e.g. AWS RDS / DigitalOcean / PlanetScale-compatible), then `npm run db:setup` once.
2. Set every variable in `server/.env` on the host. `JWT_SECRET` must be at least 32 characters in production.
3. Use `STORAGE_DRIVER=cloudinary` on hosts with ephemeral disks (Render, Railway, Heroku). Otherwise mount a persistent volume at `server/uploads`.
4. Razorpay: switch to live keys and add a webhook to `https://<your-domain>/api/payments/razorpay/webhook` with events `payment.captured`, `order.paid` and `payment.failed`, using `RAZORPAY_WEBHOOK_SECRET`. The webhook confirms payments even if the customer closes the tab before the browser callback.
5. Run behind HTTPS (Nginx, Caddy or the platform's proxy). `trust proxy` is already enabled for correct rate limiting.
6. Run with a process manager (`pm2 start server/src/index.js --name bakachiki`, or the platform's own).

Unpaid online orders hold their stock for 30 minutes, then are cancelled automatically and the stock is released. This runs inside the API process; if you scale beyond one instance, move it to a single cron worker.

**Split hosting** (static client on Vercel/Netlify, API elsewhere): build the client with `VITE_API_URL=https://api.your-domain`, add the site origin to `CLIENT_URL`, and add an SPA rewrite to `index.html`.

## Security notes

- Passwords hashed with bcrypt (cost 12). JWT bearer auth. Role checks on every `/api/admin` route.
- Every request body, query and param is validated with Zod. Sequelize parameterises all queries.
- Helmet with a CSP limited to self, Razorpay and Google Fonts. CORS limited to `CLIENT_URL`. Rate limits: global 300/min, auth 30/15 min.
- Orders are marked paid **only** after the HMAC-SHA256 signature check (checkout callback or webhook), using constant-time comparison.
- Checkout locks variant rows (`SELECT … FOR UPDATE`) inside a transaction, so stock can't oversell.
- Unexpected errors return a generic message; details stay in server logs.
- SVG uploads are rejected (they could carry scripts). Password-reset tokens are stored hashed and expire in 1 hour.

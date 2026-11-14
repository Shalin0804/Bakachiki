# BAKACHIKI — agent guide

Project root (absolute): `D:\CF\Codes\Client code\Bakachiki`

When calling the claude-code MCP tool, always pass absolute paths under this project root — the tool's working directory is Antigravity's install folder, not this project.

## What this is
Full-stack streetwear e-commerce store. `client/` = React 19 + Vite + Tailwind 4 + Framer Motion (storefront + lazy `/admin` app). `server/` = Express 5 REST API + Sequelize + MySQL 8. See README.md for setup.

## Commands
- Install: `npm run install:all`
- DB: `npm run db:setup` (migrate + seed, idempotent)
- Dev: `npm run dev:server` (API :5000) and `npm run dev:client` (Vite :5173, proxies /api and /uploads)
- Test: `npm test` (server end-to-end tests against throwaway DB `bakachiki_test`)
- Build: `npm run build` (client/dist, served by Express in production)

## Rules
- Brand palette (do not drift): bg `#080A08`, panel `#101410`, green `#168A32`, neon `#39D353`, text `#FFFFFF`, muted `#A5A5A5`, border `#252B25`. Tokens live in `client/src/index.css` `@theme`.
- Fonts: Anton (display), Teko (Devanagari/Hindi), Space Grotesk (body).
- All product, order, user and inventory data comes from MySQL via the API. No hardcoded catalogue in the client.
- Schema changes: add a new file in `server/src/migrations/`, then mirror it in `server/src/models.js`. Never edit a migration that has already run.
- Attributes and JSON are snake_case end to end. Money is whole rupees (integers); Razorpay gets paise.
- Stock changes go through `moveStock()` in `server/src/services/orders.js`, which writes the inventory ledger.
- Auth: one `users` table, roles `customer` / `admin` / `super_admin`. Storefront tokens (aud `store`) only authenticate customers via `optionalAuth`/`requireAuth`; admin tokens (aud `admin`) via `requireAdmin`/`requireSuperAdmin`. Never read the role from the token or request — the middleware reloads the user. Client keeps `bk_token` and `bk_admin_token` separately; `/admin*` and `/auth/admin*` calls use the admin one.
- Orders become `paid` only via Razorpay signature verification (`markRazorpayPaid`); admins can mark COD orders paid.
- Admin-editable content belongs in `DEFAULT_SETTINGS` (`server/src/services/settings.js`). The admin Content editor renders its fields from that shape.
- Validate every request with Zod via `validate()`; throw errors with `fail(status, message)`.
- Secrets only in `server/.env`. Never import server env values into the client.

import { app } from './app.js';
import { sequelize } from './db.js';
import { umzug } from './migrate.js';
import { expireUnpaidOrders } from './services/orders.js';

if (!process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET.length < 32)) {
  console.error('JWT_SECRET is missing or too short. Set it in server/.env');
  process.exit(1);
}

await sequelize.authenticate();
const pending = await umzug.pending();
if (pending.length) console.warn(`⚠ ${pending.length} migration(s) pending — run "npm run migrate"`);

const port = Number(process.env.PORT || 5000);
app.listen(port, () => console.log(`BAKACHIKI API on http://localhost:${port}`));

// ponytail: in-process timer; move to a cron/queue worker if you run more than one API instance.
setInterval(() => expireUnpaidOrders().catch((e) => console.error('expire job', e)), 10 * 60 * 1000).unref();

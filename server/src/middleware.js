import jwt from 'jsonwebtoken';
import { ValidationError, UniqueConstraintError, ForeignKeyConstraintError } from 'sequelize';
import { z } from 'zod';
import { MulterError } from 'multer';
import { User, STAFF_ROLES } from './models.js';

export class HttpError extends Error {
  constructor(status, message, details) { super(message); this.status = status; this.details = details; }
}
export const fail = (status, message, details) => { throw new HttpError(status, message, details); };

const secret = () => process.env.JWT_SECRET || fail(500, 'JWT_SECRET is not configured');

// Two audiences share one users table: storefront tokens ('store') and admin-panel tokens ('admin').
// The role is never read from the token — every request reloads the user and checks the role in MySQL.
export const signToken = (user, aud = 'store') => jwt.sign({ sub: user.id }, secret(), {
  audience: aud, expiresIn: aud === 'admin' ? process.env.ADMIN_JWT_EXPIRES_IN || '12h' : process.env.JWT_EXPIRES_IN || '7d',
});

async function userFromToken(req, aud) {
  const header = req.get('authorization') || '';
  if (!header.startsWith('Bearer ')) return null;
  try {
    const { sub } = jwt.verify(header.slice(7), secret(), { audience: aud });
    const user = await User.findByPk(sub);
    return user?.is_active ? user : null;
  } catch { return null; }
}

// Storefront: attaches req.user for a valid, active customer token; never rejects.
export async function optionalAuth(req, _res, next) {
  const user = await userFromToken(req, 'store');
  if (user?.role === 'customer') req.user = user;
  next();
}
export const requireAuth = [optionalAuth, (req, _res, next) => (req.user ? next() : fail(401, 'Please log in to continue'))];

// Admin panel: needs an admin-audience token whose user is still active staff in the database.
const staffOnly = (roles) => async (req, _res, next) => {
  const user = await userFromToken(req, 'admin');
  if (!user || !STAFF_ROLES.includes(user.role)) fail(401, 'Please sign in to the admin panel');
  if (!roles.includes(user.role)) fail(403, 'You do not have permission to do this');
  req.user = user;
  next();
};
export const requireAdmin = staffOnly(STAFF_ROLES);
export const requireSuperAdmin = staffOnly(['super_admin']);

// validate({ body: schema, query: schema, params: schema }) → parsed values replace the raw ones.
export const validate = (schemas) => (req, _res, next) => {
  for (const [part, schema] of Object.entries(schemas)) {
    const result = schema.safeParse(req[part] ?? {});
    if (!result.success) fail(422, 'Please check the highlighted fields', z.flattenError(result.error).fieldErrors);
    if (part === 'query') req.q = result.data; // req.query is read-only in Express 5
    else req[part] = result.data;
  }
  next();
};

export function notFound(req, _res, next) { next(new HttpError(404, `No route for ${req.method} ${req.path}`)); }

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof UniqueConstraintError) return res.status(409).json({ error: 'That value is already taken', details: Object.keys(err.fields || {}) });
  if (err instanceof ForeignKeyConstraintError) return res.status(409).json({ error: 'This record is linked to other data' });
  if (err instanceof ValidationError) return res.status(422).json({ error: err.errors.map((e) => e.message).join(', ') });
  if (err instanceof z.ZodError) return res.status(422).json({ error: 'Please check the highlighted fields', details: z.flattenError(err).fieldErrors });
  if (err instanceof MulterError) return res.status(413).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON body' });
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  // Never leak internals of unexpected errors to the client.
  res.status(status).json({ error: status >= 500 ? 'Something went wrong on our side' : err.message, details: err.details });
}

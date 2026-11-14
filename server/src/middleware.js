import jwt from 'jsonwebtoken';
import { ValidationError, UniqueConstraintError, ForeignKeyConstraintError } from 'sequelize';
import { z } from 'zod';
import { MulterError } from 'multer';
import { User } from './models.js';

export class HttpError extends Error {
  constructor(status, message, details) { super(message); this.status = status; this.details = details; }
}
export const fail = (status, message, details) => { throw new HttpError(status, message, details); };

const secret = () => process.env.JWT_SECRET || fail(500, 'JWT_SECRET is not configured');
export const signToken = (user) => jwt.sign({ sub: user.id, role: user.role }, secret(), { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// Attaches req.user when a valid bearer token is present; never rejects.
export async function optionalAuth(req, _res, next) {
  const header = req.get('authorization') || '';
  if (header.startsWith('Bearer ')) {
    try {
      const { sub } = jwt.verify(header.slice(7), secret());
      req.user = await User.findByPk(sub);
    } catch { /* invalid/expired token → treated as guest */ }
  }
  next();
}
export const requireAuth = [optionalAuth, (req, _res, next) => (req.user ? next() : fail(401, 'Please log in to continue'))];
export const requireAdmin = [...requireAuth, (req, _res, next) => (req.user.role === 'admin' ? next() : fail(403, 'Admins only'))];

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

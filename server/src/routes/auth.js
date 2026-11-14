import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { Op } from 'sequelize';
import { User, STAFF_ROLES } from '../models.js';
import { validate, requireAuth, requireAdmin, signToken, fail, optionalAuth } from '../middleware.js';
import { mergeGuestCart } from '../services/cart.js';
import { sendMail } from '../services/mail.js';

const r = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many attempts, try again in a few minutes' } });

const DUMMY_HASH = bcrypt.hashSync('timing-equaliser', 12);
const email = z.string().trim().toLowerCase().email('Enter a valid email').max(190);
const password = z.string().min(8, 'Use at least 8 characters').max(72, 'Use at most 72 characters');
const phone = z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a 10-digit Indian mobile number');

const publicUser = (user) => ({ id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role });
const session = (user, aud = 'store') => ({ token: signToken(user, aud), user: publicUser(user) });

// Shared credential check. Wrong password, unknown email, wrong account type and disabled accounts all
// get the same answer, so neither login form reveals which emails exist or which ones are staff.
async function checkCredentials({ email: mail, password: pw }, roles) {
  const user = await User.scope('withSecrets').findOne({ where: { email: mail } });
  // Compare against a dummy hash when the user is missing so timing doesn't reveal which emails exist.
  const ok = await bcrypt.compare(pw, user?.password_hash || DUMMY_HASH);
  if (!user || !ok || !user.is_active || !roles.includes(user.role)) fail(401, 'Wrong email or password');
  return user;
}
const loginBody = z.object({ email, password: z.string().min(1).max(72) });

r.post('/register', authLimiter, optionalAuth, validate({
  body: z.object({ name: z.string().trim().min(2).max(120), email, password, phone: phone.optional().or(z.literal('')) }),
}), async (req, res) => {
  const { name, email: mail, password: pw, phone: ph } = req.body;
  if (await User.count({ where: { email: mail } })) fail(409, 'An account with this email already exists');
  const user = await User.create({ name, email: mail, phone: ph || null, role: 'customer', password_hash: await bcrypt.hash(pw, 12) });
  req.user = user;
  await mergeGuestCart(req);
  res.status(201).json(session(user));
});

// ---------- Customers (storefront) ----------
r.post('/login', authLimiter, validate({ body: loginBody }), async (req, res) => {
  req.user = await checkCredentials(req.body, ['customer']);
  await mergeGuestCart(req);
  res.json(session(req.user));
});

r.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

// ---------- Staff (admin panel) ----------
// No registration route for staff: admins are created by a super_admin (POST /api/admin/staff) or the seed.
r.post('/admin/login', authLimiter, validate({ body: loginBody }), async (req, res) => {
  const user = await checkCredentials(req.body, STAFF_ROLES);
  res.json(session(user, 'admin'));
});

r.get('/admin/me', requireAdmin, (req, res) => res.json({ user: publicUser(req.user) }));

r.post('/admin/password', authLimiter, requireAdmin, validate({ body: z.object({ current_password: z.string().min(1).max(72), new_password: password }) }), async (req, res) => {
  const user = await User.scope('withSecrets').findByPk(req.user.id);
  if (!(await bcrypt.compare(req.body.current_password, user.password_hash))) fail(422, 'Current password is wrong', { current_password: ['Current password is wrong'] });
  await user.update({ password_hash: await bcrypt.hash(req.body.new_password, 12) });
  res.json({ message: 'Password updated' });
});

r.post('/forgot-password', authLimiter, validate({ body: z.object({ email }) }), async (req, res) => {
  // Storefront reset is for customers only; staff passwords are reset by a super_admin.
  const user = await User.findOne({ where: { email: req.body.email, role: 'customer', is_active: true } });
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    await user.update({
      reset_token_hash: crypto.createHash('sha256').update(token).digest('hex'),
      reset_expires: new Date(Date.now() + 60 * 60 * 1000),
    });
    const base = (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0];
    await sendMail({
      to: user.email,
      subject: 'Reset your BAKACHIKI password',
      text: `Hey ${user.name},\n\nReset your password here (valid for 1 hour):\n${base}/reset-password/${token}\n\nIf you didn't ask for this, ignore this email.`,
    });
  }
  // Same response either way: don't reveal which emails are registered.
  res.json({ message: 'If that email has an account, a reset link is on its way.' });
});

r.post('/reset-password', authLimiter, validate({ body: z.object({ token: z.string().regex(/^[a-f0-9]{64}$/, 'Invalid link'), password }) }), async (req, res) => {
  const user = await User.scope('withSecrets').findOne({
    where: { reset_token_hash: crypto.createHash('sha256').update(req.body.token).digest('hex'), reset_expires: { [Op.gt]: new Date() }, role: 'customer', is_active: true },
  });
  if (!user) fail(400, 'This reset link is invalid or has expired');
  await user.update({ password_hash: await bcrypt.hash(req.body.password, 12), reset_token_hash: null, reset_expires: null });
  res.json(session(user));
});

export default r;
export { phone as phoneSchema, email as emailSchema, password as passwordSchema };

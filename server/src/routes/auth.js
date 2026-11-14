import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { Op } from 'sequelize';
import { User } from '../models.js';
import { validate, requireAuth, signToken, fail, optionalAuth } from '../middleware.js';
import { mergeGuestCart } from '../services/cart.js';
import { sendMail } from '../services/mail.js';

const r = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many attempts, try again in a few minutes' } });

const DUMMY_HASH = bcrypt.hashSync('timing-equaliser', 12);
const email = z.string().trim().toLowerCase().email('Enter a valid email').max(190);
const password = z.string().min(8, 'Use at least 8 characters').max(72, 'Use at most 72 characters');
const phone = z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a 10-digit Indian mobile number');

const session = (user) => ({ token: signToken(user), user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role } });

r.post('/register', authLimiter, optionalAuth, validate({
  body: z.object({ name: z.string().trim().min(2).max(120), email, password, phone: phone.optional().or(z.literal('')) }),
}), async (req, res) => {
  const { name, email: mail, password: pw, phone: ph } = req.body;
  if (await User.count({ where: { email: mail } })) fail(409, 'An account with this email already exists');
  const user = await User.create({ name, email: mail, phone: ph || null, password_hash: await bcrypt.hash(pw, 12) });
  req.user = user;
  await mergeGuestCart(req);
  res.status(201).json(session(user));
});

r.post('/login', authLimiter, validate({ body: z.object({ email, password: z.string().min(1).max(72) }) }), async (req, res) => {
  const user = await User.scope('withSecrets').findOne({ where: { email: req.body.email } });
  // Compare against a dummy hash when the user is missing so timing doesn't reveal which emails exist.
  const ok = await bcrypt.compare(req.body.password, user?.password_hash || DUMMY_HASH);
  if (!user || !ok) fail(401, 'Wrong email or password');
  req.user = user;
  await mergeGuestCart(req);
  res.json(session(user));
});

r.get('/me', requireAuth, (req, res) => res.json({ user: session(req.user).user }));

r.post('/forgot-password', authLimiter, validate({ body: z.object({ email }) }), async (req, res) => {
  const user = await User.findOne({ where: { email: req.body.email } });
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
    where: { reset_token_hash: crypto.createHash('sha256').update(req.body.token).digest('hex'), reset_expires: { [Op.gt]: new Date() } },
  });
  if (!user) fail(400, 'This reset link is invalid or has expired');
  await user.update({ password_hash: await bcrypt.hash(req.body.password, 12), reset_token_hash: null, reset_expires: null });
  res.json(session(user));
});

export default r;
export { phone as phoneSchema, email as emailSchema, password as passwordSchema };

const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { requireAuth } = require('../middleware/auth');
const User = require('../models/User');
const Business = require('../models/Business');

const router = express.Router();

// Slow down password guessing
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });

const sign = (user) =>
  jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

const publicUser = (u) => ({ id: u._id, name: u.name, email: u.email, role: u.role, businessId: u.businessId });

// Sign-up creates a new business (tenant) + its owner account
router.post('/register', limiter, asyncHandler(async (req, res) => {
  const { businessName, name, email, password, phone } = req.body;
  if (!businessName || !name || !email || !password) {
    throw new HttpError(400, 'Business name, your name, email and password are required');
  }
  if (String(password).length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
  if (await User.exists({ email: String(email).toLowerCase().trim() })) {
    throw new HttpError(409, 'An account with this email already exists');
  }

  const business = await Business.create({ name: businessName, phone, email });
  const user = await User.create({
    businessId: business._id,
    name,
    email,
    passwordHash: await User.hashPassword(password),
  });
  res.status(201).json({ token: sign(user), user: publicUser(user), business });
}));

router.post('/login', limiter, asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new HttpError(400, 'Email and password are required');

  const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select('+passwordHash');
  if (!user || !(await user.checkPassword(String(password)))) {
    throw new HttpError(401, 'Wrong email or password');
  }
  const business = await Business.findById(user.businessId).lean();
  res.json({ token: sign(user), user: publicUser(user), business });
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const business = await Business.findById(req.businessId).lean();
  res.json({ user: publicUser(req.user), business });
}));

router.post('/change-password', requireAuth, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || String(newPassword).length < 8) throw new HttpError(400, 'New password must be at least 8 characters');
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!(await user.checkPassword(String(currentPassword || '')))) throw new HttpError(400, 'Current password is wrong');
  user.passwordHash = await User.hashPassword(newPassword);
  await user.save();
  res.json({ ok: true });
}));

module.exports = router;

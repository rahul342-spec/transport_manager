const jwt = require('jsonwebtoken');
const User = require('../models/User');
const HttpError = require('../utils/httpError');

// Verifies the JWT and loads the user from the DB.
// req.businessId ALWAYS comes from the user record — never from the browser (spec section 17).
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new HttpError(401, 'Please log in');

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).lean();
    if (!user) throw new HttpError(401, 'Account not found');

    req.user = user;
    req.businessId = user.businessId;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return next(new HttpError(401, 'Session expired, please log in again'));
    }
    next(err);
  }
}

module.exports = { requireAuth };

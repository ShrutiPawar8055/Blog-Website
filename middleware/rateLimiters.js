const rateLimit = require('express-rate-limit');

// trust proxy is set in app.js so req.ip is the real client IP.

// slows brute-force logins; only failed attempts count.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    error: 'Too many login attempts. Please try again in a few minutes.'
  }
});

// limits mass account registration.
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many accounts created from this address. Please try again later.'
  }
});

// throttles content writes (articles, comments, likes).
const writeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests. Please slow down.'
  }
});

module.exports = {
  loginLimiter,
  registerLimiter,
  writeLimiter
};

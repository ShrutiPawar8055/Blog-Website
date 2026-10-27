const express = require('express');
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

// Auth routes (/api/auth); POSTs also need the CSRF token.

// GET /api/auth/csrf - get this session's CSRF token
router.get('/csrf', authController.getCsrfToken);

// POST /api/auth/register - sign up and sign in
router.post('/register', registerLimiter, authController.register);

// POST /api/auth/login - sign in (rate limited)
router.post('/login', loginLimiter, authController.login);

// POST /api/auth/logout - destroy the session
router.post('/logout', requireAuth, authController.logout);

// GET /api/auth/me - current user (401 if anonymous)
router.get('/me', authController.getCurrentUser);

module.exports = router;

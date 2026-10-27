const express = require('express');
const likeController = require('../controllers/likeController');
const { requireAuth } = require('../middleware/authMiddleware');
const { writeLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

// Like routes (/api/likes); toggling needs a signed-in user.

router.get('/article/:articleId', likeController.getLikesByArticle);

router.post(
  '/toggle',
  writeLimiter,
  requireAuth,
  likeController.toggleLike
);

module.exports = router;

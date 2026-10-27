const express = require('express');
const commentController = require('../controllers/commentController');
const { requireAuth } = require('../middleware/authMiddleware');
const { writeLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

// Comment routes (/api/comments); writes need a signed-in user.

router.get('/article/:articleId', commentController.getCommentsByArticle);

router.post(
  '/',
  writeLimiter,
  requireAuth,
  commentController.createComment
);

router.delete(
  '/:id',
  writeLimiter,
  requireAuth,
  commentController.deleteComment
);

module.exports = router;

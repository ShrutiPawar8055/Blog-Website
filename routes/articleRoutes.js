const express = require('express');
const articleController = require('../controllers/articleController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const { writeLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

// Article routes (/api/articles); writes need author or admin.

// GET /api/articles - list all (?tag= and ?date= filters)
// POST /api/articles - create (author/admin)
router.route('/')
  .get(articleController.getAllArticles)
  .post(
    writeLimiter,
    requireAuth,
    requireRole('author', 'admin'),
    articleController.createArticle
  );

// GET /api/articles/:id - get one
// PUT /api/articles/:id - update (owner/admin)
// DELETE /api/articles/:id - delete (owner/admin)
router.route('/:id')
  .get(articleController.getArticleById)
  .put(
    writeLimiter,
    requireAuth,
    requireRole('author', 'admin'),
    articleController.updateArticle
  )
  .delete(
    writeLimiter,
    requireAuth,
    requireRole('author', 'admin'),
    articleController.deleteArticle
  );

module.exports = router;

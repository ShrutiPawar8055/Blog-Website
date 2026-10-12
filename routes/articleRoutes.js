const express = require('express');
const articleController = require('../controllers/articleController');

const router = express.Router();

/**
 * Article Routes (/api/articles)
 */

// GET /api/articles - Fetch all articles (supports ?tag= tag and ?date= YYYY-MM-DD filters)
// POST /api/articles - Create a new article
router.route('/')
  .get(articleController.getAllArticles)
  .post(articleController.createArticle);

// GET /api/articles/:id - Fetch article by ID
// PUT /api/articles/:id - Update article by ID
// DELETE /api/articles/:id - Delete article by ID
router.route('/:id')
  .get(articleController.getArticleById)
  .put(articleController.updateArticle)
  .delete(articleController.deleteArticle);

module.exports = router;

// Importing Article model for database operations
const Article = require('../models/articleModel');

/**
 * Article Controller
 * Connects client HTTP requests to database model operations.
 */

// @desc    Fetch all articles (supports optional tag & date query parameters)
// @route   GET /api/articles
exports.getAllArticles = async (req, res) => {
  try {
    const filters = {
      tag: req.query.tag,
      date: req.query.date
    };

    const articles = await Article.getAllArticles(filters);
    res.status(200).json({
      success: true,
      count: articles.length,
      data: articles
    });
  } catch (error) {
    console.error('Error fetching articles:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch articles' });
  }
};

// @desc    Fetch single article by ID
// @route   GET /api/articles/:id
exports.getArticleById = async (req, res) => {
  try {
    const { id } = req.params;
    const article = await Article.getArticleById(id);

    if (!article) {
      return res.status(404).json({ success: false, error: 'Article not found' });
    }

    res.status(200).json({
      success: true,
      data: article
    });
  } catch (error) {
    console.error('Error fetching article by ID:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch article' });
  }
};

// @desc    Create a new article
// @route   POST /api/articles
exports.createArticle = async (req, res) => {
  try {
    const { user_id, title, content, tags } = req.body;

    // Basic Input Validation
    if (!user_id || !title || !content) {
      return res.status(400).json({
        success: false,
        error: 'Please provide user_id, title, and content'
      });
    }

    const articleId = await Article.createArticle({ user_id, title, content, tags });

    res.status(201).json({
      success: true,
      message: 'Article created successfully',
      id: articleId
    });
  } catch (error) {
    console.error('Error creating article:', error);
    res.status(500).json({ success: false, error: 'Failed to create article' });
  }
};

// @desc    Update an existing article by ID
// @route   PUT /api/articles/:id
exports.updateArticle = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, tags } = req.body;

    const existing = await Article.getArticleById(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Article not found' });
    }

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: 'Please provide title and content for update'
      });
    }

    await Article.updateArticle(id, { title, content, tags });

    res.status(200).json({
      success: true,
      message: 'Article updated successfully'
    });
  } catch (error) {
    console.error('Error updating article:', error);
    res.status(500).json({ success: false, error: 'Failed to update article' });
  }
};

// @desc    Delete an article by ID
// @route   DELETE /api/articles/:id
exports.deleteArticle = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await Article.getArticleById(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Article not found' });
    }

    await Article.deleteArticle(id);

    res.status(200).json({
      success: true,
      message: 'Article deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting article:', error);
    res.status(500).json({ success: false, error: 'Failed to delete article' });
  }
};

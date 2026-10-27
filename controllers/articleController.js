const Article = require('../models/articleModel');
const { isText, isOptionalText, toPositiveInt } = require('../middleware/validate');
const { isOwnerOrAdmin } = require('../middleware/authMiddleware');

// Article controller: public reads, owner/admin writes.

/** @type {import('express').RequestHandler} */
exports.getAllArticles = async (req, res) => {
  try {
    const filters = {
      // Sanitise query params; SQL binding prevents injection.
      tag: typeof req.query.tag === 'string' ? req.query.tag.trim().slice(0, 100) : undefined,
      date: typeof req.query.date === 'string' ? req.query.date.trim() : undefined
    };

    // Validate YYYY-MM-DD format for the date filter.
    if (filters.date && !/^\d{4}-\d{2}-\d{2}$/.test(filters.date)) {
      return res.status(400).json({ success: false, error: 'Date filter must use the YYYY-MM-DD format.' });
    }

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

/** @type {import('express').RequestHandler} */
exports.getArticleById = async (req, res) => {
  try {
    const id = toPositiveInt(req.params.id);
    if (id === null) {
      return res.status(400).json({ success: false, error: 'Invalid article id' });
    }

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

/** @type {import('express').RequestHandler} */
exports.createArticle = async (req, res) => {
  try {
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const content = typeof req.body.content === 'string' ? req.body.content : '';
    const image_url = typeof req.body.image_url === 'string' ? req.body.image_url.trim() : '';
    const image_data = typeof req.body.image_data === 'string' ? req.body.image_data : '';
    const tags = typeof req.body.tags === 'string' ? req.body.tags.trim() : '';

    // ── Input validation ──
    if (!isText(title, { min: 1, max: 255 })) {
      return res.status(400).json({
        success: false,
        error: 'Title is required and must be 255 characters or fewer.'
      });
    }

    // Stay under the TEXT column's 65,535-byte limit.
    if (!isText(content, { min: 1, max: 60000 })) {
      return res.status(400).json({ success: false, error: 'Content is required.' });
    }

    if (!isOptionalText(image_url, { max: 2048 })) {
      return res.status(400).json({
        success: false,
        error: 'Image URL must be 2048 characters or fewer.'
      });
    }

    // Cap image data at 5MB even though LONGTEXT allows more.
    if (image_data && image_data.length > 5 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        error: 'Uploaded image is too large (max 5MB).'
      });
    }

    if (!isOptionalText(tags, { max: 255 })) {
      return res.status(400).json({
        success: false,
        error: 'Tags must be 255 characters or fewer.'
      });
    }

    // Author id comes from the session, not the request body.
    const articleId = await Article.createArticle({
      user_id: req.user.id,
      title,
      content,
      image_url,
      image_data,
      tags
    });

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

/** @type {import('express').RequestHandler} */
exports.updateArticle = async (req, res) => {
  try {
    const id = toPositiveInt(req.params.id);
    if (id === null) {
      return res.status(400).json({ success: false, error: 'Invalid article id' });
    }

    const existing = await Article.getArticleById(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Article not found' });
    }

    // Only the owner or an admin may edit.
    if (!isOwnerOrAdmin(req.user, existing.user_id)) {
      return res.status(403).json({
        success: false,
        error: 'You can only edit your own articles.'
      });
    }

    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const content = typeof req.body.content === 'string' ? req.body.content : '';
    const image_url = typeof req.body.image_url === 'string' ? req.body.image_url.trim() : '';
    // Empty image_data means keep the stored image.
    const hasNewImageData = typeof req.body.image_data === 'string' && req.body.image_data.length > 0;
    const image_data = hasNewImageData ? req.body.image_data : existing.image_data;
    const tags = typeof req.body.tags === 'string' ? req.body.tags.trim() : '';

    if (!isText(title, { min: 1, max: 255 }) || !isText(content, { min: 1, max: 60000 })) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid title (max 255 chars) and content for the update.'
      });
    }

    if (!isOptionalText(image_url, { max: 2048 })) {
      return res.status(400).json({
        success: false,
        error: 'Image URL must be 2048 characters or fewer.'
      });
    }

    // Cap image data at 5MB even though LONGTEXT allows more.
    if (hasNewImageData && image_data.length > 5 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        error: 'Uploaded image is too large (max 5MB).'
      });
    }

    if (!isOptionalText(tags, { max: 255 })) {
      return res.status(400).json({
        success: false,
        error: 'Tags must be 255 characters or fewer.'
      });
    }

    await Article.updateArticle(id, { title, content, image_url, image_data, tags });

    res.status(200).json({
      success: true,
      message: 'Article updated successfully'
    });
  } catch (error) {
    console.error('Error updating article:', error);
    res.status(500).json({ success: false, error: 'Failed to update article' });
  }
};

/** @type {import('express').RequestHandler} */
exports.deleteArticle = async (req, res) => {
  try {
    const id = toPositiveInt(req.params.id);
    if (id === null) {
      return res.status(400).json({ success: false, error: 'Invalid article id' });
    }

    const existing = await Article.getArticleById(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Article not found' });
    }

    // Only the owner or an admin may delete.
    if (!isOwnerOrAdmin(req.user, existing.user_id)) {
      return res.status(403).json({
        success: false,
        error: 'You can only delete your own articles.'
      });
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

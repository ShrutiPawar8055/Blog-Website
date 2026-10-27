const Like = require('../models/likeModel');
const Article = require('../models/articleModel');
const { toPositiveInt } = require('../middleware/validate');

// Like endpoints; liker id comes from the session.

/** @type {import('express').RequestHandler} */
exports.getLikesByArticle = async (req, res) => {
  try {
    const articleId = toPositiveInt(req.params.articleId);
    if (articleId === null) {
      return res.status(400).json({ success: false, error: 'Invalid article id' });
    }

    const data = await Like.getLikesByArticleId(articleId);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching likes:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch likes' });
  }
};

/** @type {import('express').RequestHandler} */
exports.toggleLike = async (req, res) => {
  try {
    const articleId = toPositiveInt(req.body.article_id);

    if (articleId === null) {
      return res.status(400).json({ success: false, error: 'A valid article_id is required.' });
    }

    // Check the article exists before liking.
    const article = await Article.getArticleById(articleId);
    if (!article) {
      return res.status(404).json({ success: false, error: 'Article not found' });
    }

    // Liker is the session user, never client-supplied.
    const result = await Like.toggleLike(articleId, req.user.id);

    res.status(200).json({
      success: true,
      liked: result.liked,
      message: result.message
    });
  } catch (error) {
    console.error('Error toggling like:', error);
    res.status(500).json({ success: false, error: 'Failed to toggle like' });
  }
};

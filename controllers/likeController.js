// Importing Like model
const Like = require('../models/likeModel');

/**
 * Like Controller
 * Handles article liking/unliking logic.
 */

// @desc    Get like count & users for an article
// @route   GET /api/likes/article/:articleId
exports.getLikesByArticle = async (req, res) => {
  try {
    const { articleId } = req.params;
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

// @desc    Toggle like on an article (like if not liked, remove if already liked)
// @route   POST /api/likes/toggle
exports.toggleLike = async (req, res) => {
  try {
    const { article_id, user_id } = req.body;

    if (!article_id || !user_id) {
      return res.status(400).json({
        success: false,
        error: 'Please provide article_id and user_id'
      });
    }

    const result = await Like.toggleLike(article_id, user_id);

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

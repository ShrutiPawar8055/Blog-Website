// Importing Comment model
const Comment = require('../models/commentModel');

/**
 * Comment Controller
 * Handles article comments endpoints.
 */

// @desc    Get comments for an article
// @route   GET /api/comments/article/:articleId
exports.getCommentsByArticle = async (req, res) => {
  try {
    const { articleId } = req.params;
    const comments = await Comment.getCommentsByArticleId(articleId);

    res.status(200).json({
      success: true,
      count: comments.length,
      data: comments
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch comments' });
  }
};

// @desc    Add a comment to an article
// @route   POST /api/comments
exports.createComment = async (req, res) => {
  try {
    const { article_id, user_id, content } = req.body;

    if (!article_id || !user_id || !content) {
      return res.status(400).json({
        success: false,
        error: 'Please provide article_id, user_id, and content'
      });
    }

    const commentId = await Comment.createComment({ article_id, user_id, content });

    res.status(201).json({
      success: true,
      message: 'Comment posted successfully',
      id: commentId
    });
  } catch (error) {
    console.error('Error posting comment:', error);
    res.status(500).json({ success: false, error: 'Failed to post comment' });
  }
};

// @desc    Delete a comment by ID
// @route   DELETE /api/comments/:id
exports.deleteComment = async (req, res) => {
  try {
    const { id } = req.params;
    await Comment.deleteComment(id);

    res.status(200).json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ success: false, error: 'Failed to delete comment' });
  }
};

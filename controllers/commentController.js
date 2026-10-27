const Comment = require('../models/commentModel');
const Article = require('../models/articleModel');
const { isText, toPositiveInt } = require('../middleware/validate');
const { isOwnerOrAdmin } = require('../middleware/authMiddleware');

// Comment endpoints; deletes are permission-checked.

/** @type {import('express').RequestHandler} */
exports.getCommentsByArticle = async (req, res) => {
  try {
    const articleId = toPositiveInt(req.params.articleId);
    if (articleId === null) {
      return res.status(400).json({ success: false, error: 'Invalid article id' });
    }

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

/** @type {import('express').RequestHandler} */
exports.createComment = async (req, res) => {
  try {
    const articleId = toPositiveInt(req.body.article_id);
    const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';

    if (articleId === null) {
      return res.status(400).json({ success: false, error: 'A valid article_id is required.' });
    }

    if (!isText(content, { min: 1, max: 5000 })) {
      return res.status(400).json({
        success: false,
        error: 'Comment content is required (max 5000 characters).'
      });
    }

    // Check article exists so we return 404, not a FK error.
    const article = await Article.getArticleById(articleId);
    if (!article) {
      return res.status(404).json({ success: false, error: 'Article not found' });
    }

    // Commenter is the session user, not client-supplied.
    const commentId = await Comment.createComment({
      article_id: articleId,
      user_id: req.user.id,
      content
    });

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

/** @type {import('express').RequestHandler} */
exports.deleteComment = async (req, res) => {
  try {
    const id = toPositiveInt(req.params.id);
    if (id === null) {
      return res.status(400).json({ success: false, error: 'Invalid comment id' });
    }

    const existing = await Comment.getCommentById(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }

    // Commenter, article author, or admin may delete.
    const isCommentAuthor = isOwnerOrAdmin(req.user, existing.user_id);
    const isArticleAuthor = isOwnerOrAdmin(req.user, existing.article_user_id);

    if (!isCommentAuthor && !isArticleAuthor) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to delete this comment.'
      });
    }

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

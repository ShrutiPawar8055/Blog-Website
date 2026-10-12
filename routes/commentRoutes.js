const express = require('express');
const commentController = require('../controllers/commentController');

const router = express.Router();

/**
 * Comment Routes (/api/comments)
 */

router.get('/article/:articleId', commentController.getCommentsByArticle);
router.post('/', commentController.createComment);
router.delete('/:id', commentController.deleteComment);

module.exports = router;

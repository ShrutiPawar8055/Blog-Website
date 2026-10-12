const express = require('express');
const likeController = require('../controllers/likeController');

const router = express.Router();

/**
 * Like Routes (/api/likes)
 */

router.get('/article/:articleId', likeController.getLikesByArticle);
router.post('/toggle', likeController.toggleLike);

module.exports = router;

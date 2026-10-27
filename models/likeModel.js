// Importing the MySQL connection pool
const db = require('../config/dbConfig');

// Handles database operations for likes.
class Like {
  // Get like count and the users who liked an article.
  static async getLikesByArticleId(articleId) {
    const [rows] = await db.execute(
      `SELECT l.id, l.user_id, u.username, l.created_at
       FROM likes l
       JOIN users u ON l.user_id = u.id
       WHERE l.article_id = ?`,
      [articleId]
    );

    return {
      count: rows.length,
      likes: rows
    };
  }

  // Check if a user has liked an article.
  static async hasUserLiked(articleId, userId) {
    const [rows] = await db.execute(
      'SELECT id FROM likes WHERE article_id = ? AND user_id = ?',
      [articleId, userId]
    );
    return rows.length > 0;
  }

  // Add a like for a user on an article.
  static async addLike(articleId, userId) {
    await db.execute(
      'INSERT IGNORE INTO likes (article_id, user_id) VALUES (?, ?)',
      [articleId, userId]
    );
    return true;
  }

  // Remove a user's like from an article.
  static async removeLike(articleId, userId) {
    await db.execute(
      'DELETE FROM likes WHERE article_id = ? AND user_id = ?',
      [articleId, userId]
    );
    return true;
  }

  // Toggle a user's like on an article.
  static async toggleLike(articleId, userId) {
    const isLiked = await this.hasUserLiked(articleId, userId);
    if (isLiked) {
      await this.removeLike(articleId, userId);
      return { liked: false, message: 'Like removed' };
    } else {
      await this.addLike(articleId, userId);
      return { liked: true, message: 'Article liked successfully' };
    }
  }
}

module.exports = Like;

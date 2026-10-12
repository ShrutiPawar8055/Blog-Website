// Importing the MySQL connection pool
const db = require('../config/dbConfig');

/**
 * Like Model
 * Handles database operations for the 'likes' table.
 */
class Like {
  /**
   * Fetch total likes and list of users who liked an article
   * @param {number} articleId - Article ID
   * @returns {Promise<Object>} { count, users }
   */
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

  /**
   * Check if a specific user has liked an article
   * @param {number} articleId 
   * @param {number} userId 
   * @returns {Promise<boolean>}
   */
  static async hasUserLiked(articleId, userId) {
    const [rows] = await db.execute(
      'SELECT id FROM likes WHERE article_id = ? AND user_id = ?',
      [articleId, userId]
    );
    return rows.length > 0;
  }

  /**
   * Add a like to an article by a user
   * @param {number} articleId 
   * @param {number} userId 
   * @returns {Promise<boolean>} True if added
   */
  static async addLike(articleId, userId) {
    await db.execute(
      'INSERT IGNORE INTO likes (article_id, user_id) VALUES (?, ?)',
      [articleId, userId]
    );
    return true;
  }

  /**
   * Remove a like from an article by a user
   * @param {number} articleId 
   * @param {number} userId 
   * @returns {Promise<boolean>} True if removed
   */
  static async removeLike(articleId, userId) {
    await db.execute(
      'DELETE FROM likes WHERE article_id = ? AND user_id = ?',
      [articleId, userId]
    );
    return true;
  }

  /**
   * Toggle like state (Adds like if not present, removes if present)
   * @param {number} articleId 
   * @param {number} userId 
   * @returns {Promise<Object>} { liked: boolean, message: string }
   */
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

// Importing the MySQL connection pool
const db = require('../config/dbConfig');

/**
 * Comment Model
 * Handles database operations for the 'comments' table.
 */
class Comment {
  /**
   * Fetch all comments for a specific article, including commenter username
   * @param {number} articleId - Article ID
   * @returns {Promise<Array>} List of comments
   */
  static async getCommentsByArticleId(articleId) {
    const [rows] = await db.execute(
      `SELECT 
        c.id, 
        c.article_id, 
        c.user_id, 
        u.username AS author_name, 
        c.content, 
        c.created_at
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.article_id = ?
       ORDER BY c.created_at ASC`,
      [articleId]
    );
    return rows;
  }

  /**
   * Insert a new comment on an article
   * @param {Object} data - { article_id, user_id, content }
   * @returns {Promise<number>} Inserted comment ID
   */
  static async createComment(data) {
    const { article_id, user_id, content } = data;

    const [result] = await db.execute(
      `INSERT INTO comments (article_id, user_id, content)
       VALUES (?, ?, ?)`,
      [article_id, user_id, content]
    );

    return result.insertId;
  }

  /**
   * Delete a comment by ID
   * @param {number} id - Comment ID
   */
  static async deleteComment(id) {
    await db.execute('DELETE FROM comments WHERE id = ?', [id]);
  }
}

module.exports = Comment;

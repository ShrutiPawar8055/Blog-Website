// Importing the MySQL connection pool
const db = require('../config/dbConfig');

// Handles database operations for comments.
class Comment {
  // Fetch all comments for an article.
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

  // Fetch one comment plus its article's author, for auth checks.
  static async getCommentById(id) {
    const [rows] = await db.execute(
      `SELECT c.id, c.user_id, c.article_id, a.user_id AS article_user_id
       FROM comments c
       JOIN articles a ON c.article_id = a.id
       WHERE c.id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  // Insert a new comment and return its id.
  static async createComment(data) {
    const { article_id, user_id, content } = data;

    const [result] = await db.execute(
      `INSERT INTO comments (article_id, user_id, content)
       VALUES (?, ?, ?)`,
      [article_id, user_id, content]
    );

    return result.insertId;
  }

  // Delete a comment by id.
  static async deleteComment(id) {
    await db.execute('DELETE FROM comments WHERE id = ?', [id]);
  }
}

module.exports = Comment;

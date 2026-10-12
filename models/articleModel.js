// Importing the MySQL connection pool
const db = require('../config/dbConfig');

/**
 * Article Model
 * Handles all database operations for the 'articles' table.
 */
class Article {
  /**
   * Retrieve all articles with optional tag and date filtering.
   * Joins with users table to return author username, comment count, and like count.
   * 
   * @param {Object} filters - Query filters ({ tag, date })
   * @returns {Promise<Array>} List of articles with author details & stats
   */
  static async getAllArticles(filters = {}) {
    const { tag, date } = filters;

    let query = `
      SELECT 
        a.id, 
        a.user_id, 
        u.username AS author_name,
        a.title, 
        a.content, 
        a.tags, 
        a.published_at, 
        a.updated_at,
        COUNT(DISTINCT c.id) AS comment_count,
        COUNT(DISTINCT l.id) AS like_count
      FROM articles a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN comments c ON a.id = c.article_id
      LEFT JOIN likes l ON a.id = l.article_id
      WHERE 1=1
    `;
    const params = [];

    // Filter by tag (e.g. tag=express matches 'express,nodejs')
    if (tag) {
      query += ' AND FIND_IN_SET(?, a.tags)';
      params.push(tag.trim());
    }

    // Filter by publication date (YYYY-MM-DD)
    if (date) {
      query += ' AND DATE(a.published_at) = ?';
      params.push(date.trim());
    }

    query += ' GROUP BY a.id ORDER BY a.published_at DESC';

    const [rows] = await db.execute(query, params);
    return rows;
  }

  /**
   * Fetch a single article by ID along with author username and stats
   * @param {number} id - Article ID
   * @returns {Promise<Object|null>} Article details or null if not found
   */
  static async getArticleById(id) {
    const query = `
      SELECT 
        a.id, 
        a.user_id, 
        u.username AS author_name,
        u.email AS author_email,
        a.title, 
        a.content, 
        a.tags, 
        a.published_at, 
        a.updated_at,
        COUNT(DISTINCT c.id) AS comment_count,
        COUNT(DISTINCT l.id) AS like_count
      FROM articles a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN comments c ON a.id = c.article_id
      LEFT JOIN likes l ON a.id = l.article_id
      WHERE a.id = ?
      GROUP BY a.id
    `;

    const [rows] = await db.execute(query, [id]);
    return rows[0] || null;
  }

  /**
   * Insert a new article into the database
   * @param {Object} data - { user_id, title, content, tags }
   * @returns {Promise<number>} Inserted article ID
   */
  static async createArticle(data) {
    const { user_id, title, content, tags } = data;

    const [result] = await db.execute(
      `INSERT INTO articles (user_id, title, content, tags)
       VALUES (?, ?, ?, ?)`,
      [user_id, title, content, tags || '']
    );

    return result.insertId;
  }

  /**
   * Update an existing article by ID
   * @param {number} id - Article ID
   * @param {Object} data - { title, content, tags }
   */
  static async updateArticle(id, data) {
    const { title, content, tags } = data;

    await db.execute(
      `UPDATE articles
       SET title = ?, content = ?, tags = ?
       WHERE id = ?`,
      [title, content, tags || '', id]
    );
  }

  /**
   * Delete an article by ID
   * @param {number} id - Article ID
   */
  static async deleteArticle(id) {
    await db.execute('DELETE FROM articles WHERE id = ?', [id]);
  }
}

module.exports = Article;

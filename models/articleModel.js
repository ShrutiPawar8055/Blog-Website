// Importing the MySQL connection pool
const db = require('../config/dbConfig');

// Handles database operations for articles.
class Article {
  // Fetch all articles with optional tag/date filters.
  static async getAllArticles(filters = {}) {
    const { tag, date } = filters;

    let query = `
      SELECT 
        a.id, 
        a.user_id, 
        u.username AS author_name,
        a.title, 
        a.content, 
        a.image_url,
        a.image_data,
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

    // Filter by tag.
    if (tag) {
      query += ' AND FIND_IN_SET(?, a.tags)';
      params.push(tag.trim());
    }

    // Filter by publication date (YYYY-MM-DD).
    if (date) {
      query += ' AND DATE(a.published_at) = ?';
      params.push(date.trim());
    }

    query += ' GROUP BY a.id, a.user_id, u.username, a.title, a.content, a.image_url, a.image_data, a.tags, a.published_at, a.updated_at ORDER BY a.published_at DESC';

    const [rows] = await db.execute(query, params);
    return rows;
  }

  // Fetch one article by id with author and stats.
  static async getArticleById(id) {
    const query = `
      SELECT 
        a.id, 
        a.user_id, 
        u.username AS author_name,
        u.email AS author_email,
        a.title, 
        a.content, 
        a.image_url,
        a.image_data,
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
      GROUP BY a.id, a.user_id, u.username, u.email, a.title, a.content, a.image_url, a.image_data, a.tags, a.published_at, a.updated_at
    `;

    const [rows] = await db.execute(query, [id]);
    return rows[0] || null;
  }

  // Insert a new article and return its id.
  static async createArticle(data) {
    const { user_id, title, content, image_url, image_data, tags } = data;

    const [result] = await db.execute(
      `INSERT INTO articles (user_id, title, content, image_url, image_data, tags)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [user_id, title, content, image_url || null, image_data || null, tags || '']
    );

    return result.insertId;
  }

  // Update an article by id.
  static async updateArticle(id, data) {
    const { title, content, image_url, image_data, tags } = data;

    await db.execute(
      `UPDATE articles
       SET title = ?, content = ?, image_url = ?, image_data = ?, tags = ?
       WHERE id = ?`,
      [title, content, image_url || null, image_data || null, tags || '', id]
    );
  }

  // Delete an article by id.
  static async deleteArticle(id) {
    await db.execute('DELETE FROM articles WHERE id = ?', [id]);
  }
}

module.exports = Article;

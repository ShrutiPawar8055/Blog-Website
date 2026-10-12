// Importing the MySQL connection pool
const db = require('../config/dbConfig');

/**
 * User Model
 * Handles all database operations for the 'users' table.
 */
class User {
  /**
   * Retrieve all registered users
   * @returns {Promise<Array>} List of user objects without sensitive passwords
   */
  static async getAllUsers() {
    const [rows] = await db.execute(
      'SELECT id, username, email, created_at, updated_at FROM users ORDER BY id DESC'
    );
    return rows;
  }

  /**
   * Fetch a single user by their primary key ID
   * @param {number} id - User ID
   * @returns {Promise<Object|null>} User object or null if not found
   */
  static async getUserById(id) {
    const [rows] = await db.execute(
      'SELECT id, username, email, created_at, updated_at FROM users WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  }

  /**
   * Insert a new user into the database
   * @param {Object} userData - { username, email, password }
   * @returns {Promise<number>} Inserted user ID
   */
  static async createUser(userData) {
    const { username, email, password } = userData;

    const [result] = await db.execute(
      `INSERT INTO users (username, email, password)
       VALUES (?, ?, ?)`,
      [username, email, password]
    );

    return result.insertId;
  }

  /**
   * Update an existing user's information
   * @param {number} id - User ID
   * @param {Object} userData - { username, email }
   */
  static async updateUser(id, userData) {
    const { username, email } = userData;

    await db.execute(
      `UPDATE users
       SET username = ?, email = ?
       WHERE id = ?`,
      [username, email, id]
    );
  }

  /**
   * Delete a user by ID (Triggers cascading deletion on articles, comments, likes)
   * @param {number} id - User ID
   */
  static async deleteUser(id) {
    await db.execute('DELETE FROM users WHERE id = ?', [id]);
  }
}

module.exports = User;

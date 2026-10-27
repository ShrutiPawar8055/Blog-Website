// Importing the MySQL connection pool
const db = require('../config/dbConfig');

// Columns safe to send to clients (never includes the password hash)
const PUBLIC_COLUMNS = 'id, username, email, role, created_at, updated_at';

// Handles database operations for users (roles: user, author, admin).
class User {
  // Retrieve all users without password hashes.
  static async getAllUsers() {
    const [rows] = await db.execute(
      `SELECT ${PUBLIC_COLUMNS} FROM users ORDER BY id DESC`
    );
    return rows;
  }

  // Fetch one user's public data by id.
  static async getUserById(id) {
    const [rows] = await db.execute(
      `SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  // Fetch user with password hash for login; never expose it.
  static async findByEmailWithPassword(email) {
    const [rows] = await db.execute(
      `SELECT ${PUBLIC_COLUMNS}, password FROM users WHERE email = ? LIMIT 1`,
      [email]
    );
    return rows[0] || null;
  }

  // Check if an email is already registered.
  static async emailExists(email) {
    const [rows] = await db.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    return rows.length > 0;
  }

  // Check if a username is already taken.
  static async usernameExists(username) {
    const [rows] = await db.execute('SELECT id FROM users WHERE username = ? LIMIT 1', [username]);
    return rows.length > 0;
  }

  // Insert a new user (password must be pre-hashed).
  static async createUser(userData) {
    const { username, email, passwordHash, role } = userData;

    const [result] = await db.execute(
      `INSERT INTO users (username, email, password, role)
       VALUES (?, ?, ?, ?)`,
      [username, email, passwordHash, role || 'user']
    );

    return result.insertId;
  }

  // Update a user's profile (never role or password).
  static async updateUser(id, userData) {
    const { username, email } = userData;

    await db.execute(
      `UPDATE users
       SET username = ?, email = ?
       WHERE id = ?`,
      [username, email, id]
    );
  }

  // Change a user's role (admin-only).
  static async updateUserRole(id, role) {
    const [result] = await db.execute(
      'UPDATE users SET role = ? WHERE id = ?',
      [role, id]
    );
    return result.affectedRows > 0;
  }

  // Delete a user (cascades to their articles, comments, likes).
  static async deleteUser(id) {
    await db.execute('DELETE FROM users WHERE id = ?', [id]);
  }
}

module.exports = User;

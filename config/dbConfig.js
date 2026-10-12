// Importing required modules for MySQL database connection
const mysql = require('mysql2');
require('dotenv').config();

/**
 * Connection Pool Setup:
 * Reuses database connections instead of opening/closing a connection per request.
 * Improves performance, concurrency handling, and system scalability.
 */
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'personal_blog',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Export promise-enabled pool wrapper for seamless async/await execution
module.exports = pool.promise();

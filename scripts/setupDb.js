const mysql = require('mysql2/promise');
require('dotenv').config();

/**
 * Database Initialization and Seed Script
 * - Connects to MySQL server
 * - Creates `personal_blog` database if it doesn't exist
 * - Creates schema tables: users, articles, comments, likes
 * - Inserts sample seed data for testing
 */
async function setupDatabase() {
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const dbName = process.env.DB_NAME || 'personal_blog';

  console.log(`Connecting to MySQL server at ${host}:${port}...`);

  let connection;
  try {
    // Initial connection without specifying database to create it if needed
    connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      multipleStatements: true
    });

    console.log(`Creating database '${dbName}' if not exists...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
    await connection.query(`USE \`${dbName}\`;`);

    console.log('Creating database tables...');

    // 1. Users Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `);

    // 2. Articles Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS articles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        tags VARCHAR(255),
        published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // 3. Comments Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        article_id INT NOT NULL,
        user_id INT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // 4. Likes Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS likes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        article_id INT NOT NULL,
        user_id INT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_article_like (article_id, user_id),
        FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    console.log('Tables created successfully!');

    // Check if sample users already exist
    const [userRows] = await connection.query('SELECT COUNT(*) AS count FROM users');
    if (userRows[0].count === 0) {
      console.log('Inserting sample seed data...');

      // Seed Users
      await connection.query(`
        INSERT INTO users (username, email, password) VALUES
        ('alex_dev', 'alex@example.com', 'hashed_pass_123'),
        ('sarah_tech', 'sarah@example.com', 'hashed_pass_456'),
        ('coder_sam', 'sam@example.com', 'hashed_pass_789');
      `);

      // Seed Articles
      await connection.query(`
        INSERT INTO articles (user_id, title, content, tags) VALUES
        (1, 'Mastering Express.js and MVC Architecture', 'Express.js is a minimal and flexible Node.js web application framework that provides a robust set of features for web and mobile applications. When combined with MVC, your codebase stays clean, modular, and easy to maintain.', 'express,nodejs,javascript,mvc'),
        (2, 'Optimizing SQL Queries for Scalability', 'Database indexing, connection pooling, and proper join structures are essential skills for backend engineering. In this post we explore query execution plans and indexing techniques.', 'sql,database,mysql,performance'),
        (1, 'Building Modern RESTful APIs in Node.js', 'REST APIs serve as the backbone for web and mobile clients. Learn best practices for standard status codes, parameter handling, and data validation.', 'nodejs,api,rest,express');
      `);

      // Seed Comments
      await connection.query(`
        INSERT INTO comments (article_id, user_id, content) VALUES
        (1, 2, 'Great explanation of MVC! Clean separation of concerns makes scaling so much easier.'),
        (1, 3, 'Super helpful guide. Thanks for sharing!'),
        (2, 1, 'Indexing turned my slow 3-second query into 15 milliseconds. Essential read!');
      `);

      // Seed Likes
      await connection.query(`
        INSERT INTO likes (article_id, user_id) VALUES
        (1, 2),
        (1, 3),
        (2, 1);
      `);

      console.log('Seed data inserted successfully!');
    } else {
      console.log('Database already contains data, skipping seed step.');
    }

    console.log('Database setup complete!');
  } catch (error) {
    console.error('Error during database setup:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

if (require.main === module) {
  setupDatabase();
}

module.exports = setupDatabase;

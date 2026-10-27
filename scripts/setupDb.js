const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Creates tables and seeds sample data.

// Returns the first DB_* env var that is set, else the fallback.
function firstDefined(...keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (value !== undefined && value !== '') return value;
  }
  return undefined;
}

// Builds mysql2 connection options, including TiDB TLS settings.
function buildConnectionOptions({ withDatabase = true } = {}) {
  const sslEnabled = String(firstDefined('DB_SSL') || '').toLowerCase() === 'true';

  const config = {
    host: firstDefined('DB_HOST') || 'localhost',
    port: Number(firstDefined('DB_PORT') || 3306),
    user: firstDefined('DB_USER') || 'root',
    password: firstDefined('DB_PASSWORD') ?? '',
    multipleStatements: true
  };

  if (withDatabase) {
    config.database = firstDefined('DB_NAME') || 'personal_blog';
  }

  if (sslEnabled) {
    config.ssl = {
      // TiDB Cloud only accepts TLS 1.2+
      minVersion: 'TLSv1.2',
      rejectUnauthorized:
        String(firstDefined('DB_SSL_REJECT_UNAUTHORIZED') || 'true').toLowerCase() !== 'false',
      ...(process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA } : {})
    };
  }

  return config;
}

// Sample account password (development only).
const SEED_PASSWORD = 'Password123!';

// Sample users, each with an explicit role.
const SEED_USERS = [
  { username: 'alex_dev', email: 'alex@example.com', role: 'admin' },
  { username: 'sarah_tech', email: 'sarah@example.com', role: 'author' },
  { username: 'coder_sam', email: 'sam@example.com', role: 'author' }
];

async function setupDatabase() {
  const options = buildConnectionOptions({ withDatabase: false });
  const dbName = firstDefined('DB_NAME') || 'personal_blog';

  console.log(`Connecting to MySQL server at ${options.host}:${options.port}...`);

  let connection;
  try {
    // Initial connection without a database so we can create it if needed
    connection = await mysql.createConnection(options);

    // CREATE DATABASE may be denied on managed providers; not fatal.
    try {
      await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
      console.log(`Database '${dbName}' is ready.`);
    } catch (createError) {
      console.log(
        `Skipping CREATE DATABASE (${createError.code || createError.message}). ` +
        `Assuming '${dbName}' already exists.`
      );
    }

    await connection.query(`USE \`${dbName}\`;`);

    console.log('Creating database tables...');

    // 1. Users Table
    //    role drives role-based access control.
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role ENUM('user', 'author', 'admin') NOT NULL DEFAULT 'user',
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
        image_url VARCHAR(2048),
        image_data LONGTEXT,
        tags VARCHAR(255),
        published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_articles_user_id (user_id),
        INDEX idx_articles_published_at (published_at)
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
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_comments_article_id (article_id),
        INDEX idx_comments_user_id (user_id)
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

    // ── Migration for databases created before RBAC existed ──
    // CREATE TABLE IF NOT EXISTS won't add a missing column.
    const [roleColumn] = await connection.query(
      `SELECT COLUMN_NAME
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'`,
      [dbName]
    );

    if (roleColumn.length === 0) {
      console.log("Adding missing 'role' column to users table...");
      await connection.query(`
        ALTER TABLE users
        ADD COLUMN role ENUM('user', 'author', 'admin') NOT NULL DEFAULT 'user'
        AFTER password;
      `);
      // Promote the oldest account to admin.
      await connection.query('UPDATE users SET role = ? WHERE id = (SELECT MIN(id) FROM (SELECT id FROM users) AS t)', ['admin']);
      console.log('Role column added. The first user account was promoted to admin.');
    }

    // ── Migration: Add image_url to articles ──
    const [imageColumn] = await connection.query(
      `SELECT COLUMN_NAME
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'articles' AND COLUMN_NAME = 'image_url'`,
      [dbName]
    );

    if (imageColumn.length === 0) {
      console.log("Adding missing 'image_url' column to articles table...");
      await connection.query(`
        ALTER TABLE articles
        ADD COLUMN image_url VARCHAR(2048) AFTER content;
      `);
      console.log('image_url column added.');
    }

    // ── Migration: Add image_data to articles ──
    const [imageDataColumn] = await connection.query(
      `SELECT COLUMN_NAME
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'articles' AND COLUMN_NAME = 'image_data'`,
      [dbName]
    );

    if (imageDataColumn.length === 0) {
      console.log("Adding missing 'image_data' column to articles table...");
      await connection.query(`
        ALTER TABLE articles
        ADD COLUMN image_data LONGTEXT AFTER image_url;
      `);
      console.log('image_data column added.');
    }

    // Seed only when the database is empty
    const [userRows] = await connection.query('SELECT COUNT(*) AS count FROM users');
    if (userRows[0].count === 0) {
      console.log('Inserting sample seed data...');

      // Seed users with hashed passwords (ids derived from insertId below).
      const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
      const userValues = SEED_USERS.map((u) => [u.username, u.email, passwordHash, u.role]);
      const [userInsert] = await connection.query(
        'INSERT INTO users (username, email, password, role) VALUES ?',
        [userValues]
      );

      // Ids from a single multi-row INSERT are consecutive
      const userId = (index) => userInsert.insertId + index;
      const [ALEX, SARAH, SAM] = [userId(0), userId(1), userId(2)];

      // Seed Articles
      const [articleInsert] = await connection.query(
        'INSERT INTO articles (user_id, title, content, image_url, tags) VALUES ?',
        [[
          [ALEX, 'Mastering Express.js and MVC Architecture', `Model-View-Controller (MVC) is a software architectural pattern commonly used for developing user interfaces that divides the related program logic into three interconnected elements. This is done to separate internal representations of information from the ways information is presented to and accepted from the user. The Model is the central component of the pattern. It is the application's dynamic data structure, independent of the user interface. It directly manages the data, logic and rules of the application. The View is any representation of information such as a chart, diagram or table. Multiple views of the same information are possible, such as a bar chart for management and a tabular view for accountants. The Controller accepts input and converts it to commands for the model or view. In addition to dividing the application into these components, the model-view-controller design defines the interactions between them.`, 'https://developer.mozilla.org/en-US/docs/Glossary/MVC/model-view-controller-light-blue.png', 'express,nodejs,javascript,mvc'],
          [SARAH, 'Optimizing SQL Queries for Scalability', `Structured Query Language (SQL) is a domain-specific language used in programming and designed for managing data held in a relational database management system (RDBMS), or for stream processing in a relational data stream management system (RDSMS). It is particularly useful in handling structured data, i.e., data incorporating relations among entities and variables. SQL offers two main advantages over older read-write APIs like ISAM or VSAM. First, it introduced the concept of accessing many records with one single command. Second, it eliminates the need to specify how to reach a record, e.g. with or without an index. Originally based upon relational algebra and tuple relational calculus, SQL consists of many types of statements, which may be informally classified as sublanguages: a data query language (DQL), a data definition language (DDL), a data control language (DCL), and a data manipulation language (DML). The scope of SQL includes data query, data manipulation (insert, update and delete), data definition (schema creation and modification), and data access control.`, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQfGakdxqqhUMXckpSGLyZyQGz5fFnTLJUNXnUS5tfRqA&s=10', 'sql,database,mysql,performance'],
          [ALEX, 'Building Modern RESTful APIs in Node.js', `Representational State Transfer (REST) is a software architectural style that was created to guide the design and development of the architecture for the World Wide Web. REST defines a set of constraints for how the architecture of a distributed hypermedia system, such as the Web, should behave. The REST architectural style is applied to the development of web services. RESTful web services provide interoperability between computer systems on the internet. RESTful web services allow the requesting systems to access and manipulate textual representations of web resources by using a uniform and predefined set of stateless operations. Other kinds of web services, such as SOAP web services, expose their own arbitrary sets of operations. By using a stateless protocol and standard operations, RESTful systems aim for fast performance, reliability, and the ability to grow by reusing components that can be managed and updated without affecting the system as a whole, even while it is running.`, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSRWf3LdalZsfKmE1IftEe7VtGCATTvnb8U1eMh67-JLw&s=10', 'nodejs,api,rest,express']
        ]]
      );

      const articleId = (index) => articleInsert.insertId + index;
      const [ARTICLE_1, ARTICLE_2] = [articleId(0), articleId(1)];

      // Seed Comments
      await connection.query(
        'INSERT INTO comments (article_id, user_id, content) VALUES ?',
        [[
          [ARTICLE_1, SARAH, 'Great explanation of MVC! Clean separation of concerns makes scaling so much easier.'],
          [ARTICLE_1, SAM, 'Super helpful guide. Thanks for sharing!'],
          [ARTICLE_2, ALEX, 'Indexing turned my slow 3-second query into 15 milliseconds. Essential read!']
        ]]
      );

      // Seed Likes
      await connection.query(
        'INSERT INTO likes (article_id, user_id) VALUES ?',
        [
          [
            [ARTICLE_1, SARAH],
            [ARTICLE_1, SAM],
            [ARTICLE_2, ALEX]
          ]
        ]
      );

      console.log('Seed data inserted successfully!');
      console.log(`Sample login — email: ${SEED_USERS[0].email} | password: ${SEED_PASSWORD}`);
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

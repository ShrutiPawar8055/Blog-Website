const mysql = require('mysql2');
require('dotenv').config();

// Returns the first env var that is set.
function firstDefined(...keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (value !== undefined && value !== '') return value;
  }
  return undefined;
}

// ─── Connection settings (all sourced from the environment) ───
// same vars work for local MySQL and TiDB Cloud
const dbHost     = firstDefined('DB_HOST') || 'localhost';
const dbPort     = Number(firstDefined('DB_PORT') || 3306);
const dbUser     = firstDefined('DB_USER') || 'root';
const dbPassword = firstDefined('DB_PASSWORD') ?? '';
const dbName     = firstDefined('DB_NAME') || 'personal_blog';

// TiDB Cloud requires TLS 1.2+; set DB_SSL=true to enable.
const sslEnabled = String(firstDefined('DB_SSL') || '').toLowerCase() === 'true';
const sslOptions = sslEnabled
  ? {
      minVersion: 'TLSv1.2',
      // only disabled when explicitly configured
      rejectUnauthorized:
        String(firstDefined('DB_SSL_REJECT_UNAUTHORIZED') || 'true').toLowerCase() !== 'false',
      // optional CA certificate
      ...(process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA } : {})
    }
  : undefined;

// pool reuses connections instead of opening one per request
const pool = mysql.createPool({
  host: dbHost,
  port: dbPort,
  user: dbUser,
  password: dbPassword,
  database: dbName,
  waitForConnections: true,
  connectionLimit: Number(firstDefined('DB_CONNECTION_LIMIT') || 10),
  queueLimit: 0,
  // keep idle connections alive
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  charset: 'utf8mb4',
  // only set when TLS is enabled
  ...(sslOptions ? { ssl: sslOptions } : {})
});

const promisePool = pool.promise();

// boot probe: resolves once a connection succeeds
promisePool.testConnection = async function testConnection() {
  const connection = await promisePool.getConnection();
  try {
    await connection.query('SELECT 1');
  } finally {
    connection.release();
  }
};

module.exports = promisePool;

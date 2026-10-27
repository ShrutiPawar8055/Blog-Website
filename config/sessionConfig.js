const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const db = require('./dbConfig');

const isProduction = process.env.NODE_ENV === 'production';

// single source for the session cookie name
const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'sid';

// session lifetime, default 24 hours
const SESSION_MAX_AGE_MS = Number(process.env.SESSION_MAX_AGE_MS || 24 * 60 * 60 * 1000);

// refuses to start in prod without a proper secret
function resolveSecret() {
  const secret = process.env.SESSION_SECRET;

  if (secret && secret.length >= 16) return secret;

  if (isProduction) {
    throw new Error(
      'SESSION_SECRET must be set to a random string of at least 16 characters when NODE_ENV=production.'
    );
  }

  console.warn(
    '[session] SESSION_SECRET is missing or shorter than 16 characters. ' +
    'Using an INSECURE development-only fallback. Add SESSION_SECRET to your .env file.'
  );
  return 'insecure-development-only-session-secret';
}

// secure cookies in production unless overridden
function resolveSecureCookie() {
  if (process.env.COOKIE_SECURE !== undefined) {
    return String(process.env.COOKIE_SECURE).toLowerCase() === 'true';
  }
  return isProduction;
}

// builds the express-session middleware.
function createSessionMiddleware() {
  // reuse the app's mysql2 pool
  const store = new MySQLStore(
    {
      createDatabaseTable: true,
      clearExpired: true,
      checkExpirationInterval: 15 * 60 * 1000, // purge expired sessions
      expiration: SESSION_MAX_AGE_MS,
      schema: { tableName: 'sessions' }
    },
    db
  );

  return session({
    name: SESSION_COOKIE_NAME,
    secret: resolveSecret(),
    store,
    resave: false,
    saveUninitialized: false,
    // trust the reverse proxy in production
    proxy: isProduction,
    cookie: {
      httpOnly: true,                 // blocks XSS cookie theft
      sameSite: 'lax',                // blocks cross-site POST cookies
      secure: resolveSecureCookie(),  // HTTPS-only in production
      maxAge: SESSION_MAX_AGE_MS,
      path: '/'
    }
  });
}

module.exports = {
  createSessionMiddleware,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_MS,
  isProduction
};

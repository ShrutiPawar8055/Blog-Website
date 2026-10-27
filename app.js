const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

// Import configuration & middleware
const db = require('./config/dbConfig');
const { createSessionMiddleware, isProduction } = require('./config/sessionConfig');
const { loadSessionUser } = require('./middleware/authMiddleware');
const { ensureCsrfToken, verifyCsrfToken } = require('./middleware/csrf');

// Import Router modules
const authRoutes = require('./routes/authRoutes');
const articleRoutes = require('./routes/articleRoutes');
const userRoutes = require('./routes/userRoutes');
const commentRoutes = require('./routes/commentRoutes');
const likeRoutes = require('./routes/likeRoutes');

// Initialize Express application
const app = express();

// Trust one proxy hop so req.ip and secure cookies work behind a host proxy.
app.set('trust proxy', 1);
app.disable('x-powered-by'); // don't advertise the framework

// ─── CORS ────────────────────────────────────────────────
// Same-origin by default; list extra domains in ALLOWED_ORIGINS if needed.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // No Origin header: same-origin request, curl, or server-to-server call
      if (!origin) return callback(null, true);

      if (allowedOrigins.length === 0) {
        // In development any origin is reflected; in production only listed ones.
        return callback(null, !isProduction);
      }

      return callback(null, allowedOrigins.includes(origin));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
  })
);

// Body parsers — 8 MB limit covers base64 image uploads.
app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: true, limit: '8mb' }));

// Static frontend (before sessions so assets don't create sessions).
app.use(express.static(path.join(__dirname, 'public')));

// Project-level images folder served at /images.
app.use('/images', express.static(path.join(__dirname, 'images')));

// ─── Sessions, CSRF and authentication context ───────────
app.use(createSessionMiddleware()); // server-side session + HttpOnly cookie
app.use(ensureCsrfToken);           // create a CSRF token per session
app.use(verifyCsrfToken);           // reject unsafe requests without a token
app.use(loadSessionUser);           // load the signed-in user from the DB

// ─── Mount API Routes ────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/users', userRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/likes', likeRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.originalUrl} not found`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  // Let Express handle it if the response already started
  if (res.headersSent) return next(err);

  // Malformed JSON
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: 'Invalid JSON in request body.' });
  }

  // Payload too large
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, error: 'Request body is too large.' });
  }

  const statusCode = err.status || err.statusCode || 500;

  console.error('Unhandled Application Error:', err);

  // Hide internal details in production
  const message =
    statusCode >= 500 && isProduction
      ? 'Internal Server Error'
      : err.message || 'Internal Server Error';

  return res.status(statusCode).json({ success: false, error: message });
});

// Start Server Listening
const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log('=================================================');
    console.log('  Personal Blogging Platform Server Running!');
    console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`  URL: http://localhost:${PORT}`);
    console.log('  API Endpoints:');
    console.log(`    - Auth     : http://localhost:${PORT}/api/auth`);
    console.log(`    - Articles : http://localhost:${PORT}/api/articles`);
    console.log(`    - Users    : http://localhost:${PORT}/api/users`);
    console.log(`    - Comments : http://localhost:${PORT}/api/comments`);
    console.log(`    - Likes    : http://localhost:${PORT}/api/likes`);
    console.log('=================================================');

    // Check database reachability at boot.
    db.testConnection()
      .then(() => console.log('  Database : connected ✓'))
      .catch((error) => {
        console.error('  Database : CONNECTION FAILED ✗');
        console.error(`  ${error.code || ''} ${error.message}`);
        console.error('  Check DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME in your .env');
      });
  });
}

module.exports = app;

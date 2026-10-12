const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

// Import Router modules
const articleRoutes = require('./routes/articleRoutes');
const userRoutes = require('./routes/userRoutes');
const commentRoutes = require('./routes/commentRoutes');
const likeRoutes = require('./routes/likeRoutes');

// Initialize Express application
const app = express();

// Middleware Configuration
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // Parse incoming JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Serve static frontend files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Mount API Routes
app.use('/api/articles', articleRoutes);
app.use('/api/users', userRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/likes', likeRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// Global 404 Route Handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.originalUrl} not found`
  });
});

// Global Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Application Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

// Start Server Listening
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`  Personal Blogging Platform Server Running!`);
  console.log(`  URL: http://localhost:${PORT}`);
  console.log(`  API Endpoints:`);
  console.log(`    - Articles : http://localhost:${PORT}/api/articles`);
  console.log(`    - Users    : http://localhost:${PORT}/api/users`);
  console.log(`    - Comments : http://localhost:${PORT}/api/comments`);
  console.log(`    - Likes    : http://localhost:${PORT}/api/likes`);
  console.log(`=================================================`);
});

module.exports = app;

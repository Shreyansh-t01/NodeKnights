const multer = require('multer');

/**
 * Authentication Middleware
 * Temporarily bypasses authentication during development
 */

const authenticate = (req, res, next) => {
  req.user = {
    userId: req.headers['x-user-id'] || 'dev-user',
    authDisabled: true,
  };

  next();
};

/**
 * Error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err.message);

  if (err instanceof multer.MulterError) {
    if (err.code === 'FILE_TOO_LARGE') {
      return res.status(413).json({ error: 'File too large' });
    }
    return res.status(400).json({ error: err.message });
  }

  res.status(500).json({ error: 'Internal server error' });
};

/**
 * Request logging middleware
 */
const requestLogger = (req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
};

/**
 * Compression middleware
 */
const compression = require('compression');

module.exports = {
  authenticate,
  errorHandler,
  requestLogger,
  compression,
};

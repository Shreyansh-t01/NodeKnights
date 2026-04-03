const multer = require('multer');

/**
 * Authentication Middleware
 * Verifies user identity and JWT tokens
 */

const authenticate = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // TODO: Verify JWT token
    // For now, extract userId from token (implement proper JWT verification)
    const userId = req.headers['x-user-id'];

    if (!userId) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = { userId };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

/**
 * Error handling middleware
 */
const errorHandler = (err, req, res) => {
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

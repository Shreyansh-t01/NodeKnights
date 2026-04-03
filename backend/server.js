require('dotenv').config();
const express = require('express');
const compression = require('compression');
const { requestLogger, errorHandler } = require('./src/middleware');
const apiRoutes = require('./src/routes');
const { logger } = require('./src/utils');

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// Middleware Configuration
// ============================================

// Compression middleware
app.use(compression());

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Logging
app.use(requestLogger);

// CORS (configure as needed)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// ============================================
// API Routes
// ============================================

app.use('/api', apiRoutes);

// ============================================
// Health Check
// ============================================

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ============================================
// 404 Handler
// ============================================

app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
    method: req.method,
  });
});

// ============================================
// Error Handler (Last middleware)
// ============================================

app.use(errorHandler);

// ============================================
// Server Startup
// ============================================

app.listen(PORT, () => {
  logger.info(`Server started on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`API available at http://localhost:${PORT}/api`);
});

// ============================================
// Graceful Shutdown
// ============================================

process.on('SIGTERM', () => {
  logger.warn('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.warn('SIGINT signal received: closing HTTP server');
  process.exit(0);
});

module.exports = app;

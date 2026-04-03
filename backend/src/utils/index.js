const Logger = require('../helpers/logger');

// Create logger instance
const logger = new Logger('NodeKnights');

/**
 * Async error wrapper for Express route handlers
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Retry logic with exponential backoff
 */
const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      const delay = baseDelay * Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, delay));
      logger.warn(`Retry attempt ${i + 1} after ${delay}ms`, error.message);
    }
  }
};

/**
 * Batch processing utility
 */
const processBatch = async (items, batchSize = 10, processor) => {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const processed = await Promise.all(batch.map(processor));
    results.push(...processed);
  }
  return results;
};

/**
 * Cache with TTL
 */
class CacheManager {
  constructor(ttl = 60000) { // Default 60 seconds
    this.cache = new Map();
    this.ttl = ttl;
  }

  set(key, value) {
    this.cache.set(key, {
      value,
      expiry: Date.now() + this.ttl,
    });
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  clear() {
    this.cache.clear();
  }
}

module.exports = {
  logger,
  asyncHandler,
  retryWithBackoff,
  processBatch,
  CacheManager,
};

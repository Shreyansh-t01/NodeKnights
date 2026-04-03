/**
 * Logger Utility
 * Centralized logging with levels and formatting
 */

const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG',
};

class Logger {
  constructor(name = 'App') {
    this.name = name;
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] [${this.name}] ${message}`;

    if (data) {
      console.log(logEntry, data);
    } else {
      console.log(logEntry);
    }
  }

  error(message, error = null) {
    this.log(LOG_LEVELS.ERROR, message, error);
  }

  warn(message, data = null) {
    this.log(LOG_LEVELS.WARN, message, data);
  }

  info(message, data = null) {
    this.log(LOG_LEVELS.INFO, message, data);
  }

  debug(message, data = null) {
    if (process.env.DEBUG) {
      this.log(LOG_LEVELS.DEBUG, message, data);
    }
  }
}

module.exports = Logger;

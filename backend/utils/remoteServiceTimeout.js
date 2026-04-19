const AppError = require('../errors/AppError');
const { env } = require('../config/env');

async function withRemoteServiceTimeout(label, operation, details = {}) {
  const timeoutMs = Math.max(1000, Number(env.remoteServiceTimeoutMs) || 15000);
  let timeoutId = null;

  try {
    return await Promise.race([
      Promise.resolve().then(() => operation()),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new AppError(504, `${label} timed out after ${timeoutMs}ms.`, {
            timeoutMs,
            ...details,
          }));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

module.exports = {
  withRemoteServiceTimeout,
};

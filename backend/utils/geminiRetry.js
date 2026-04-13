function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function safeJsonParse(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

function parseRetryDelayMs(value) {
  if (value === undefined || value === null || value === '') {
    return 0;
  }

  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();

  if (!normalized) {
    return 0;
  }

  if (/^\d+$/.test(normalized)) {
    return Number(normalized) * 1000;
  }

  const durationMatch = normalized.match(/^(\d+(?:\.\d+)?)(ms|s|m)$/);

  if (!durationMatch) {
    return 0;
  }

  const amount = Number(durationMatch[1]);

  if (!Number.isFinite(amount) || amount < 0) {
    return 0;
  }

  if (durationMatch[2] === 'ms') {
    return amount;
  }

  if (durationMatch[2] === 'm') {
    return amount * 60 * 1000;
  }

  return amount * 1000;
}

function extractRetryDelayMs(payload = {}, headers = null) {
  const retryAfterHeader = headers?.get?.('retry-after');
  const retryAfterMs = parseRetryDelayMs(retryAfterHeader);

  if (retryAfterMs > 0) {
    return retryAfterMs;
  }

  const details = Array.isArray(payload?.error?.details)
    ? payload.error.details
    : Array.isArray(payload?.details)
      ? payload.details
      : [];

  for (const detail of details) {
    const retryDelayMs = parseRetryDelayMs(detail?.retryDelay);

    if (retryDelayMs > 0) {
      return retryDelayMs;
    }
  }

  return 0;
}

function computeRetryDelayMs({
  attempt = 1,
  baseMs = 1500,
  maxMs = 12000,
  explicitRetryMs = 0,
}) {
  if (explicitRetryMs > 0) {
    return explicitRetryMs;
  }

  const exponent = Math.max(0, attempt - 1);
  const backoffMs = Math.min(baseMs * (2 ** exponent), maxMs);
  const jitterMs = Math.round(backoffMs * (0.2 * Math.random()));

  return Math.min(backoffMs + jitterMs, maxMs);
}

function isRetryableGeminiStatus(status) {
  return [429, 500, 502, 503, 504].includes(Number(status));
}

function isRetryableGeminiError(error) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  return isRetryableGeminiStatus(error.details?.status || error.statusCode);
}

module.exports = {
  computeRetryDelayMs,
  extractRetryDelayMs,
  isRetryableGeminiError,
  isRetryableGeminiStatus,
  parseRetryDelayMs,
  safeJsonParse,
  sleep,
};

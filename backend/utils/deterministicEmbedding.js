const crypto = require('node:crypto');

function normalizeText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function tokenize(value = '') {
  const normalized = normalizeText(value);
  const tokens = normalized
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1);

  if (tokens.length) {
    return tokens;
  }

  return normalized
    .split('')
    .map((char, index, chars) => chars.slice(index, index + 3).join(''))
    .filter((token) => token.length > 0);
}

function applyFeature(values, feature, weight = 1) {
  const digest = crypto.createHash('sha256').update(feature).digest();
  const index = digest.readUInt32BE(0) % values.length;
  const sign = (digest[4] & 1) === 0 ? 1 : -1;

  values[index] += sign * weight;
}

function normalizeVector(values = []) {
  const magnitude = Math.sqrt(values.reduce((sum, value) => sum + (value ** 2), 0));

  if (!magnitude) {
    return values;
  }

  return values.map((value) => value / magnitude);
}

function buildDeterministicEmbeddingValues(text, dimension = 128) {
  const resolvedDimension = Math.max(8, Number(dimension) || 128);
  const values = new Array(resolvedDimension).fill(0);
  const tokens = tokenize(text);

  tokens.forEach((token, index) => {
    applyFeature(values, `token:${token}`, 1);

    if (index < tokens.length - 1) {
      applyFeature(values, `bigram:${token}_${tokens[index + 1]}`, 0.5);
    }
  });

  if (!tokens.length) {
    applyFeature(values, 'empty-text', 1);
  }

  return normalizeVector(values);
}

module.exports = {
  buildDeterministicEmbeddingValues,
};

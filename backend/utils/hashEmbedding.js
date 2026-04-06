const crypto = require('node:crypto');

function createDeterministicEmbedding(text, dimension = 128) {
  const vector = new Array(dimension).fill(0);
  const normalizedText = String(text || '').toLowerCase().trim();

  if (!normalizedText) {
    return vector;
  }

  const tokens = normalizedText.split(/\s+/).filter(Boolean);

  tokens.forEach((token) => {
    const digest = crypto.createHash('sha256').update(token).digest();

    for (let index = 0; index < dimension; index += 1) {
      const digestValue = digest[index % digest.length];
      const centered = (digestValue / 255) * 2 - 1;
      vector[index] += centered;
    }
  });

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value ** 2, 0)) || 1;
  return vector.map((value) => Number((value / magnitude).toFixed(6)));
}

module.exports = {
  createDeterministicEmbedding,
};

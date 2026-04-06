const { env } = require('../config/env');
const { createDeterministicEmbedding } = require('../utils/hashEmbedding');

async function embedText(text) {
  return {
    provider: 'deterministic-hash',
    values: createDeterministicEmbedding(text, env.embeddingDimension),
  };
}

module.exports = {
  embedText,
};

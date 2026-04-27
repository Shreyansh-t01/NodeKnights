const AppError = require('../errors/AppError');
const { env } = require('../config/env');
const { buildDeterministicEmbeddingValues } = require('../utils/deterministicEmbedding');

function normalizeText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function buildDeterministicResult(text, options = {}) {
  return {
    provider: env.embeddingProvider === 'local' ? 'local' : 'local-fallback',
    model: `deterministic-hash-${env.embeddingDimension}`,
    taskType: options.taskType || 'TASK_TYPE_UNSPECIFIED',
    values: buildDeterministicEmbeddingValues(text, env.embeddingDimension),
  };
}

async function embedText(text, options = {}) {
  const normalizedText = normalizeText(text);

  if (!normalizedText) {
    throw new AppError(400, 'Text is required for embedding.');
  }

  return buildDeterministicResult(normalizedText, options);
}

async function embedTexts(entries = [], options = {}) {
  const normalizedEntries = entries
    .map((entry) => (typeof entry === 'string'
      ? {
        text: entry,
      }
      : {
        text: entry?.text,
        taskType: entry?.taskType,
      }))
    .map((entry) => ({
      ...entry,
      text: normalizeText(entry.text),
      taskType: entry.taskType || options.taskType,
    }))
    .filter((entry) => entry.text);

  return normalizedEntries.map((entry) => buildDeterministicResult(entry.text, entry));
}

module.exports = {
  embedText,
  embedTexts,
};

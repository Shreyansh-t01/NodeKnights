const crypto = require('node:crypto');
const path = require('node:path');

const AppError = require('../errors/AppError');
const { env, featureFlags } = require('../config/env');
const { buildDeterministicEmbeddingValues } = require('../utils/deterministicEmbedding');
const { readJsonFile, writeJsonFile } = require('../utils/jsonStore');
const {
  computeRetryDelayMs,
  extractRetryDelayMs,
  isRetryableGeminiError,
  safeJsonParse,
  sleep,
} = require('../utils/geminiRetry');

const EMBEDDING_CACHE_LIMIT = 1000;
const embeddingCachePath = path.join(env.tempStorageDir, 'local-store', 'embedding-cache.json');
const embeddingCache = new Map();
let embeddingCacheLoaded = false;
let embeddingCacheLoadPromise = null;
let embeddingCachePersistChain = Promise.resolve();

function buildEmbeddingModelName() {
  const model = String(env.embeddingModel || '').trim();
  return model.startsWith('models/') ? model : `models/${model}`;
}

function buildEmbeddingUrl(methodName) {
  const baseUrl = String(env.genAiBaseUrl || '').replace(/\/+$/, '');
  return `${baseUrl}/${buildEmbeddingModelName()}:${methodName}`;
}

function normalizeText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

async function ensureEmbeddingCacheLoaded() {
  if (embeddingCacheLoaded) {
    return;
  }

  if (!embeddingCacheLoadPromise) {
    embeddingCacheLoadPromise = readJsonFile(embeddingCachePath, { entries: [] })
      .then((payload) => {
        const entries = Array.isArray(payload?.entries) ? payload.entries : [];

        embeddingCache.clear();
        entries.forEach((entry) => {
          if (entry?.key && Array.isArray(entry?.value?.values)) {
            embeddingCache.set(entry.key, entry);
          }
        });

        embeddingCacheLoaded = true;
      })
      .catch((error) => {
        console.warn('Embedding cache load failed, continuing without persisted cache:', error.message);
        embeddingCache.clear();
        embeddingCacheLoaded = true;
      })
      .finally(() => {
        embeddingCacheLoadPromise = null;
      });
  }

  await embeddingCacheLoadPromise;
}

async function persistEmbeddingCache() {
  const entries = [...embeddingCache.values()]
    .sort((left, right) => new Date(right.cachedAt || 0) - new Date(left.cachedAt || 0))
    .slice(0, EMBEDDING_CACHE_LIMIT);

  embeddingCache.clear();
  entries.forEach((entry) => {
    embeddingCache.set(entry.key, entry);
  });

  await writeJsonFile(embeddingCachePath, { entries });
}

function queueEmbeddingCachePersist() {
  embeddingCachePersistChain = embeddingCachePersistChain
    .catch(() => undefined)
    .then(() => persistEmbeddingCache());

  return embeddingCachePersistChain;
}

function buildEmbeddingCacheKey(text, options = {}) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({
      model: env.embeddingModel,
      dimension: env.embeddingDimension,
      taskType: options.taskType || 'TASK_TYPE_UNSPECIFIED',
      title: normalizeText(options.title),
      text: normalizeText(text),
    }))
    .digest('hex');
}

async function getCachedEmbedding(text, options = {}) {
  await ensureEmbeddingCacheLoaded();
  const key = buildEmbeddingCacheKey(text, options);
  return embeddingCache.get(key)?.value || null;
}

async function setCachedEmbedding(text, options = {}, value) {
  if (!Array.isArray(value?.values) || !value.values.length) {
    return;
  }

  await ensureEmbeddingCacheLoaded();

  embeddingCache.set(buildEmbeddingCacheKey(text, options), {
    key: buildEmbeddingCacheKey(text, options),
    value,
    cachedAt: new Date().toISOString(),
  });

  try {
    await queueEmbeddingCachePersist();
  } catch (error) {
    console.warn('Embedding cache persist failed, continuing with in-memory cache only:', error.message);
  }
}

function ensureEmbeddingsConfigured() {
  if (featureFlags.embeddingApi) {
    return;
  }

  throw new AppError(503, 'Gemini embeddings are not configured for this environment.', {
    configuredBaseUrl: env.genAiBaseUrl || null,
    configuredModel: env.embeddingModel || null,
  });
}

function buildEmbedRequest({ text, taskType, title }) {
  const request = {
    content: {
      parts: [
        {
          text,
        },
      ],
    },
    outputDimensionality: env.embeddingDimension,
  };

  if (taskType) {
    request.taskType = taskType;
  }

  if (title && taskType === 'RETRIEVAL_DOCUMENT') {
    request.title = title;
  }

  return request;
}

async function parseErrorResponse(response) {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      const payload = await response.json();
      return {
        message: payload.error?.message || payload.message || JSON.stringify(payload),
        payload,
        retryDelayMs: extractRetryDelayMs(payload, response.headers),
      };
    } catch (error) {
      return {
        message: `Request failed with status ${response.status}`,
        payload: null,
        retryDelayMs: 0,
      };
    }
  }

  const message = await response.text();
  const payload = safeJsonParse(message);

  return {
    message: message || `Request failed with status ${response.status}`,
    payload,
    retryDelayMs: extractRetryDelayMs(payload, response.headers),
  };
}

function shouldUseLocalEmbeddingFallback(error) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  if (!(error instanceof AppError)) {
    return /fetch failed/i.test(error.message || '');
  }

  if ([503, 504].includes(error.statusCode)) {
    return true;
  }

  return isRetryableGeminiError(error) || error.message.includes('not configured');
}

function buildLocalEmbeddingResult(text, options = {}) {
  return {
    provider: 'local-fallback',
    model: `deterministic-hash-${env.embeddingDimension}`,
    taskType: options.taskType || 'TASK_TYPE_UNSPECIFIED',
    values: buildDeterministicEmbeddingValues(text, env.embeddingDimension),
  };
}

function chunkEntries(entries = [], chunkSize = 20) {
  const normalizedChunkSize = Math.max(1, Number(chunkSize) || 1);
  const chunks = [];

  for (let index = 0; index < entries.length; index += normalizedChunkSize) {
    chunks.push(entries.slice(index, index + normalizedChunkSize));
  }

  return chunks;
}

async function postEmbeddingRequest(url, body, label) {
  ensureEmbeddingsConfigured();

  const maxAttempts = Math.max(1, env.genAiMaxRetries + 1);
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), env.genAiTimeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': env.genAiApiKey,
        },
        signal: controller.signal,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const parsedError = await parseErrorResponse(response);

        throw new AppError(502, `Gemini ${label} request failed.`, {
          status: response.status,
          model: env.embeddingModel,
          response: parsedError.message,
          payload: parsedError.payload,
          retryDelayMs: parsedError.retryDelayMs,
          attempt,
        });
      }

      return await response.json();
    } catch (error) {
      lastError = error.name === 'AbortError'
        ? new AppError(504, `Gemini ${label} request timed out.`, {
          timeoutMs: env.genAiTimeoutMs,
          model: env.embeddingModel,
          attempt,
        })
        : error instanceof AppError
          ? error
          : new AppError(502, `Gemini ${label} network request failed.`, {
            model: env.embeddingModel,
            attempt,
            originalError: error.message,
          });

      if (!isRetryableGeminiError(lastError) || attempt >= maxAttempts) {
        throw lastError;
      }

      await sleep(computeRetryDelayMs({
        attempt,
        baseMs: env.genAiRetryBaseMs,
        maxMs: env.genAiRetryMaxMs,
        explicitRetryMs: lastError.details?.retryDelayMs || 0,
      }));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError;
}

function extractEmbeddingValues(payload, label) {
  const values = payload?.embedding?.values;

  if (!Array.isArray(values) || !values.length) {
    throw new AppError(502, `Gemini ${label} returned no embedding values.`, {
      model: env.embeddingModel,
    });
  }

  return values;
}

async function embedText(text, options = {}) {
  const normalizedText = normalizeText(text);

  if (!normalizedText) {
    throw new AppError(400, 'Text is required for embedding.');
  }

  const cachedEmbedding = await getCachedEmbedding(normalizedText, options);

  if (cachedEmbedding) {
    return cachedEmbedding;
  }

  try {
    const payload = await postEmbeddingRequest(
      buildEmbeddingUrl('embedContent'),
      buildEmbedRequest({
        text: normalizedText,
        taskType: options.taskType,
        title: options.title,
      }),
      'embedding',
    );

    const result = {
      provider: 'gemini',
      model: env.embeddingModel,
      taskType: options.taskType || 'TASK_TYPE_UNSPECIFIED',
      values: extractEmbeddingValues(payload, 'embedding'),
    };

    await setCachedEmbedding(normalizedText, options, result);
    return result;
  } catch (error) {
    if (!shouldUseLocalEmbeddingFallback(error)) {
      throw error;
    }

    console.warn('Gemini embedding failed, using deterministic local fallback:', error.message);
    return buildLocalEmbeddingResult(normalizedText, options);
  }
}

async function embedTexts(entries = [], options = {}) {
  const normalizedEntries = entries
    .map((entry) => (typeof entry === 'string'
      ? {
        text: entry,
      }
      : {
        text: entry?.text,
        title: entry?.title,
        taskType: entry?.taskType,
      }))
    .map((entry) => ({
      ...entry,
      text: normalizeText(entry.text),
      title: normalizeText(entry.title),
      taskType: entry.taskType || options.taskType,
    }))
    .filter((entry) => entry.text);

  if (!normalizedEntries.length) {
    return [];
  }

  const resolvedResults = new Array(normalizedEntries.length);
  const missingEntries = [];

  for (let index = 0; index < normalizedEntries.length; index += 1) {
    const entry = normalizedEntries[index];
    const cachedEmbedding = await getCachedEmbedding(entry.text, entry);

    if (cachedEmbedding) {
      resolvedResults[index] = cachedEmbedding;
    } else {
      missingEntries.push({ index, entry });
    }
  }

  if (!missingEntries.length) {
    return resolvedResults;
  }

  const modelName = buildEmbeddingModelName();
  const batches = chunkEntries(missingEntries, env.embeddingBatchSize);

  try {
    for (const batch of batches) {
      if (batch.length === 1) {
        const singleResult = await embedText(batch[0].entry.text, batch[0].entry);
        resolvedResults[batch[0].index] = singleResult;
        continue;
      }

      const payload = await postEmbeddingRequest(
        buildEmbeddingUrl('batchEmbedContents'),
        {
          requests: batch.map(({ entry }) => ({
            model: modelName,
            ...buildEmbedRequest(entry),
          })),
        },
        'batch embedding',
      );

      const embeddings = Array.isArray(payload?.embeddings) ? payload.embeddings : [];

      if (embeddings.length !== batch.length) {
        throw new AppError(502, 'Gemini batch embedding returned an unexpected number of vectors.', {
          requested: batch.length,
          returned: embeddings.length,
          model: env.embeddingModel,
        });
      }

      const batchResults = embeddings.map((item, batchIndex) => {
        const values = Array.isArray(item?.values) ? item.values : [];

        if (!values.length) {
          throw new AppError(502, 'Gemini batch embedding returned an empty vector.', {
            index: batchIndex,
            model: env.embeddingModel,
          });
        }

        return {
          provider: 'gemini',
          model: env.embeddingModel,
          taskType: batch[batchIndex].entry.taskType || 'TASK_TYPE_UNSPECIFIED',
          values,
        };
      });

      await Promise.all(batchResults.map((result, batchIndex) => setCachedEmbedding(
        batch[batchIndex].entry.text,
        batch[batchIndex].entry,
        result,
      )));

      batch.forEach(({ index }, batchIndex) => {
        resolvedResults[index] = batchResults[batchIndex];
      });
    }

    return resolvedResults;
  } catch (error) {
    if (!shouldUseLocalEmbeddingFallback(error)) {
      throw error;
    }

    console.warn('Gemini batch embedding failed, using deterministic local fallback:', error.message);
    return normalizedEntries.map((entry, index) => (
      resolvedResults[index] || buildLocalEmbeddingResult(entry.text, entry)
    ));
  }
}

module.exports = {
  embedText,
  embedTexts,
};

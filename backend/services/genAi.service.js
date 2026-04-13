const crypto = require('node:crypto');
const path = require('node:path');

const AppError = require('../errors/AppError');
const { env, featureFlags } = require('../config/env');
const { readJsonFile, writeJsonFile } = require('../utils/jsonStore');
const {
  computeRetryDelayMs,
  extractRetryDelayMs,
  isRetryableGeminiError,
  safeJsonParse,
  sleep,
} = require('../utils/geminiRetry');

const PRIMARY_GEMINI_RESPONSE_MODEL = 'gemini-2.5-flash';
const DEFAULT_GEMINI_RESPONSE_MODELS = [
  PRIMARY_GEMINI_RESPONSE_MODEL,
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
];
const GEMINI_RESPONSE_CACHE_LIMIT = 300;
const geminiResponseCachePath = path.join(env.tempStorageDir, 'local-store', 'gemini-response-cache.json');
const pendingStructuredRequests = new Map();
const completedStructuredRequests = new Map();
let geminiResponseCacheLoaded = false;
let geminiResponseCacheLoadPromise = null;
let geminiResponseCachePersistChain = Promise.resolve();

function isGeminiEnabled() {
  return featureFlags.externalGenAi && env.genAiProvider === 'gemini';
}

function normalizeModelName(modelName) {
  return String(modelName || '').trim();
}

function getGeminiModelCandidates() {
  return [...new Set([
    normalizeModelName(env.genAiModel),
    ...(Array.isArray(env.genAiModelCandidates) ? env.genAiModelCandidates.map(normalizeModelName) : []),
    ...DEFAULT_GEMINI_RESPONSE_MODELS,
  ].filter(Boolean))];
}

async function ensureGeminiResponseCacheLoaded() {
  if (geminiResponseCacheLoaded) {
    return;
  }

  if (!geminiResponseCacheLoadPromise) {
    geminiResponseCacheLoadPromise = readJsonFile(geminiResponseCachePath, { entries: [] })
      .then((payload) => {
        const entries = Array.isArray(payload?.entries) ? payload.entries : [];

        completedStructuredRequests.clear();
        entries.forEach((entry) => {
          if (entry?.key && entry?.value !== undefined) {
            completedStructuredRequests.set(entry.key, entry);
          }
        });

        geminiResponseCacheLoaded = true;
      })
      .catch((error) => {
        console.warn('Gemini response cache load failed, continuing without persisted cache:', error.message);
        completedStructuredRequests.clear();
        geminiResponseCacheLoaded = true;
      })
      .finally(() => {
        geminiResponseCacheLoadPromise = null;
      });
  }

  await geminiResponseCacheLoadPromise;
}

async function persistGeminiResponseCache() {
  const entries = [...completedStructuredRequests.values()]
    .sort((left, right) => new Date(right.cachedAt || 0) - new Date(left.cachedAt || 0))
    .slice(0, GEMINI_RESPONSE_CACHE_LIMIT);

  completedStructuredRequests.clear();
  entries.forEach((entry) => {
    completedStructuredRequests.set(entry.key, entry);
  });

  await writeJsonFile(geminiResponseCachePath, { entries });
}

function queueGeminiResponseCachePersist() {
  geminiResponseCachePersistChain = geminiResponseCachePersistChain
    .catch(() => undefined)
    .then(() => persistGeminiResponseCache());

  return geminiResponseCachePersistChain;
}

async function getCompletedStructuredRequest(requestKey) {
  await ensureGeminiResponseCacheLoaded();
  return completedStructuredRequests.get(requestKey)?.value;
}

async function setCompletedStructuredRequest(requestKey, payload = {}) {
  await ensureGeminiResponseCacheLoaded();

  completedStructuredRequests.set(requestKey, {
    key: requestKey,
    value: payload.value,
    label: payload.label || 'response',
    cachedAt: new Date().toISOString(),
  });

  try {
    await queueGeminiResponseCachePersist();
  } catch (error) {
    console.warn('Gemini response cache persist failed, continuing with in-memory cache only:', error.message);
  }
}

function buildGeminiUrl(modelName) {
  const baseUrl = env.genAiBaseUrl.replace(/\/+$/, '');
  return `${baseUrl}/models/${encodeURIComponent(modelName)}:generateContent`;
}

function buildPlainJsonPrompt(prompt, responseSchema) {
  if (!responseSchema) {
    return prompt;
  }

  return [
    prompt,
    '',
    'Return valid JSON only.',
    'Do not wrap the JSON in markdown fences or add any explanatory text.',
    'Ensure the JSON is complete and parseable.',
    'Required JSON schema:',
    JSON.stringify(responseSchema, null, 2),
  ].join('\n');
}

function buildGenerationConfig({ responseSchema, modelName, attempt, mode = 'schema' }) {
  const lowLatencyMode = attempt > 1 || String(modelName || '').includes('flash-lite');
  const generationConfig = {
    responseMimeType: 'application/json',
    temperature: lowLatencyMode ? Math.min(env.genAiTemperature, 0.1) : env.genAiTemperature,
    maxOutputTokens: lowLatencyMode
      ? Math.min(env.genAiMaxOutputTokens, 900)
      : env.genAiMaxOutputTokens,
  };

  if (mode === 'schema' && responseSchema) {
    generationConfig.responseJsonSchema = responseSchema;
  }

  if (env.genAiThinkingBudget > 0 && !lowLatencyMode) {
    generationConfig.thinkingConfig = {
      thinkingBudget: env.genAiThinkingBudget,
    };
  }

  return generationConfig;
}

function extractResponseText(payload = {}) {
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];

  for (const candidate of candidates) {
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
    const text = parts
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
      .trim();

    if (text) {
      return text;
    }
  }

  throw new AppError(502, 'Gemini returned no usable content.', {
    finishReason: candidates[0]?.finishReason || null,
    blockReason: payload.promptFeedback?.blockReason || null,
  });
}

function extractLikelyJsonText(rawText = '') {
  const normalized = String(rawText || '').trim();

  if (!normalized) {
    return normalized;
  }

  const codeFenceMatch = normalized.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const stripped = (codeFenceMatch ? codeFenceMatch[1] : normalized).trim();

  const objectStart = stripped.indexOf('{');
  const arrayStart = stripped.indexOf('[');

  if (objectStart === -1 && arrayStart === -1) {
    return stripped;
  }

  const startsWithObject = objectStart !== -1 && (arrayStart === -1 || objectStart < arrayStart);
  const startIndex = startsWithObject ? objectStart : arrayStart;
  const endIndex = stripped.lastIndexOf(startsWithObject ? '}' : ']');

  return endIndex > startIndex
    ? stripped.slice(startIndex, endIndex + 1).trim()
    : stripped;
}

function isRetryableGeminiFailure(error) {
  return error instanceof AppError && isRetryableGeminiError(error);
}

function shouldTryPlainJsonFallback(error) {
  if (!(error instanceof AppError)) {
    return false;
  }

  const status = Number(error.details?.status || error.statusCode || 0);

  return error.message.includes('invalid JSON') || [500, 502, 503, 504].includes(status);
}

function shouldTryNextModel(error) {
  if (!(error instanceof AppError)) {
    return false;
  }

  const status = Number(error.details?.status || error.statusCode || 0);

  return isRetryableGeminiFailure(error)
    || error.message.includes('invalid JSON')
    || [400, 403, 404, 429].includes(status);
}

function shouldRetrySameModel(error) {
  if (!(error instanceof AppError) || !isRetryableGeminiFailure(error)) {
    return false;
  }

  const status = Number(error.details?.status || error.statusCode || 0);

  if ([429, 503].includes(status)) {
    return false;
  }

  return true;
}

async function runGeminiRequest({
  prompt,
  responseSchema,
  label,
  modelName,
  mode = 'schema',
  maxAttemptsOverride = null,
}) {
  const maxAttempts = Math.max(1, maxAttemptsOverride ?? (env.genAiMaxRetries + 1));
  let lastError = null;
  const requestTimeoutMs = Math.min(
    env.genAiTimeoutMs,
    mode === 'json-prompt' ? 10000 : 15000,
  );

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

    try {
      const response = await fetch(buildGeminiUrl(modelName), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': env.genAiApiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: mode === 'json-prompt'
                    ? buildPlainJsonPrompt(prompt, responseSchema)
                    : prompt,
                },
              ],
            },
          ],
          generationConfig: buildGenerationConfig({
            responseSchema,
            modelName,
            attempt,
            mode,
          }),
        }),
      });

      if (!response.ok) {
        const bodyText = await response.text();
        const payload = safeJsonParse(bodyText);

        throw new AppError(502, `Gemini ${label} request failed.`, {
          status: response.status,
          response: bodyText,
          payload,
          retryDelayMs: extractRetryDelayMs(payload, response.headers),
          model: modelName,
          attempt,
          mode,
        });
      }

      const payload = await response.json();
      const rawText = extractResponseText(payload);
      const parsedText = extractLikelyJsonText(rawText);

      try {
        return {
          model: modelName,
          value: JSON.parse(parsedText),
        };
      } catch (error) {
        throw new AppError(502, `Gemini ${label} returned invalid JSON.`, {
          model: modelName,
          originalError: error.message,
          rawText: rawText.slice(0, 2000),
          parsedText: parsedText.slice(0, 2000),
          finishReason: payload.candidates?.[0]?.finishReason || null,
          attempt,
          mode,
        });
      }
    } catch (error) {
      lastError = error.name === 'AbortError'
        ? new AppError(504, `Gemini ${label} request timed out.`, {
          timeoutMs: requestTimeoutMs,
          model: modelName,
          attempt,
          mode,
        })
        : error instanceof AppError
          ? error
          : new AppError(502, `Gemini ${label} network request failed.`, {
            model: modelName,
            attempt,
            mode,
            originalError: error.message,
          });

      if (!shouldRetrySameModel(lastError) || attempt >= maxAttempts) {
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

async function generateStructuredObjectInternal({ prompt, responseSchema, label = 'response' }) {
  const attemptedModels = [];
  let lastError = null;

  for (const modelName of getGeminiModelCandidates()) {
    attemptedModels.push(modelName);

    try {
      const result = await runGeminiRequest({
        prompt,
        responseSchema,
        label,
        modelName,
        mode: 'schema',
      });

      return result.value;
    } catch (error) {
      lastError = error;
    }

    if (shouldTryPlainJsonFallback(lastError)) {
      try {
        const result = await runGeminiRequest({
          prompt,
          responseSchema,
          label,
          modelName,
          mode: 'json-prompt',
          maxAttemptsOverride: 1,
        });

        return result.value;
      } catch (error) {
        lastError = error;
      }
    }

    if (!shouldTryNextModel(lastError)) {
      break;
    }
  }

  if (lastError instanceof AppError) {
    lastError.details = {
      ...(lastError.details || {}),
      attemptedModels,
    };
  }

  throw lastError;
}

function buildRequestKey({ prompt, responseSchema, label }) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({
      prompt,
      responseSchema,
      label,
      models: getGeminiModelCandidates(),
    }))
    .digest('hex');
}

async function generateStructuredObject({ prompt, responseSchema, label = 'response' }) {
  if (!isGeminiEnabled()) {
    throw new AppError(503, 'Gemini is not configured for this environment.', {
      provider: env.genAiProvider,
      model: env.genAiModel,
    });
  }

  const requestKey = buildRequestKey({ prompt, responseSchema, label });
  const cachedResponse = await getCompletedStructuredRequest(requestKey);

  if (cachedResponse !== undefined) {
    return cachedResponse;
  }

  if (pendingStructuredRequests.has(requestKey)) {
    return pendingStructuredRequests.get(requestKey);
  }

  const pendingRequest = generateStructuredObjectInternal({
    prompt,
    responseSchema,
    label,
  }).then(async (value) => {
    await setCompletedStructuredRequest(requestKey, {
      label,
      value,
    });

    return value;
  }).finally(() => {
    pendingStructuredRequests.delete(requestKey);
  });

  pendingStructuredRequests.set(requestKey, pendingRequest);
  return pendingRequest;
}

module.exports = {
  generateStructuredObject,
  isGeminiEnabled,
};

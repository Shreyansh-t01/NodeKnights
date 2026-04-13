const AppError = require('../errors/AppError');
const { env, featureFlags } = require('../config/env');
const {
  computeRetryDelayMs,
  extractRetryDelayMs,
  isRetryableGeminiError,
  safeJsonParse,
  sleep,
} = require('../utils/geminiRetry');

const DEFAULT_MODEL_FALLBACKS = {
  'gemini-2.5-flash': ['gemini-2.5-flash-lite'],
  'gemini-2.5-flash-lite': ['gemini-2.5-flash'],
};

function isGeminiEnabled() {
  return featureFlags.externalGenAi && env.genAiProvider === 'gemini';
}

function normalizeModelName(modelName) {
  return String(modelName || '').trim();
}

function getGeminiModelCandidates() {
  const configuredModel = normalizeModelName(env.genAiModel);
  const extraCandidates = Array.isArray(env.genAiModelCandidates)
    ? env.genAiModelCandidates.map(normalizeModelName)
    : [];
  const defaultFallbacks = DEFAULT_MODEL_FALLBACKS[configuredModel] || [];

  return [...new Set([configuredModel, ...extraCandidates, ...defaultFallbacks].filter(Boolean))];
}

function buildGeminiUrl(modelName) {
  const baseUrl = env.genAiBaseUrl.replace(/\/+$/, '');
  return `${baseUrl}/models/${encodeURIComponent(modelName)}:generateContent`;
}

function buildGenerationConfig({ responseSchema, modelName, attempt }) {
  const lowLatencyMode = attempt > 1 || String(modelName || '').includes('flash-lite');
  const generationConfig = {
    responseMimeType: 'application/json',
    responseJsonSchema: responseSchema,
    temperature: lowLatencyMode ? Math.min(env.genAiTemperature, 0.1) : env.genAiTemperature,
    maxOutputTokens: lowLatencyMode
      ? Math.min(env.genAiMaxOutputTokens, 900)
      : env.genAiMaxOutputTokens,
  };

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

function isRetryableGeminiFailure(error) {
  return error instanceof AppError && isRetryableGeminiError(error);
}

async function runGeminiRequest({ prompt, responseSchema, label, modelName }) {
  const maxAttempts = Math.max(1, env.genAiMaxRetries + 1);
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), env.genAiTimeoutMs);

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
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: buildGenerationConfig({
            responseSchema,
            modelName,
            attempt,
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
        });
      }

      const payload = await response.json();
      const rawText = extractResponseText(payload);

      try {
        return {
          model: modelName,
          value: JSON.parse(rawText),
        };
      } catch (error) {
        throw new AppError(502, `Gemini ${label} returned invalid JSON.`, {
          model: modelName,
          originalError: error.message,
          rawText: rawText.slice(0, 2000),
          attempt,
        });
      }
    } catch (error) {
      lastError = error.name === 'AbortError'
        ? new AppError(504, `Gemini ${label} request timed out.`, {
          timeoutMs: env.genAiTimeoutMs,
          model: modelName,
          attempt,
        })
        : error instanceof AppError
          ? error
          : new AppError(502, `Gemini ${label} network request failed.`, {
            model: modelName,
            attempt,
            originalError: error.message,
          });

      if (!isRetryableGeminiFailure(lastError) || attempt >= maxAttempts) {
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

async function generateStructuredObject({ prompt, responseSchema, label = 'response' }) {
  if (!isGeminiEnabled()) {
    throw new AppError(503, 'Gemini is not configured for this environment.', {
      provider: env.genAiProvider,
      model: env.genAiModel,
    });
  }

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
      });

      return result.value;
    } catch (error) {
      lastError = error;

      if (!isRetryableGeminiFailure(error)) {
        throw error;
      }
    }
  }

  if (lastError instanceof AppError) {
    lastError.details = {
      ...lastError.details,
      attemptedModels,
    };
  }

  throw lastError;
}

module.exports = {
  generateStructuredObject,
  isGeminiEnabled,
};

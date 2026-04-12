const AppError = require('../errors/AppError');
const { env, featureFlags } = require('../config/env');

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

  return [...new Set([configuredModel, ...extraCandidates].filter(Boolean))];
}

function buildGeminiUrl(modelName) {
  const baseUrl = env.genAiBaseUrl.replace(/\/+$/, '');
  return `${baseUrl}/models/${encodeURIComponent(modelName)}:generateContent`;
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
  if (!(error instanceof AppError)) {
    return false;
  }

  return [404, 429, 500, 502, 503].includes(error.details?.status);
}

async function runGeminiRequest({ prompt, responseSchema, label, modelName }) {
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
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: responseSchema,
          temperature: env.genAiTemperature,
          maxOutputTokens: env.genAiMaxOutputTokens,
          thinkingConfig: {
            thinkingBudget: env.genAiThinkingBudget,
          },
        },
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new AppError(502, `Gemini ${label} request failed.`, {
        status: response.status,
        response: message,
        model: modelName,
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
      });
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new AppError(504, `Gemini ${label} request timed out.`, {
        timeoutMs: env.genAiTimeoutMs,
        model: modelName,
      });
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
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

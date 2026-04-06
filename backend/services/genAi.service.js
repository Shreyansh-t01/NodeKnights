const AppError = require('../errors/AppError');
const { env, featureFlags } = require('../config/env');

function isGeminiEnabled() {
  return featureFlags.externalGenAi && env.genAiProvider === 'gemini';
}

function buildGeminiUrl() {
  const baseUrl = env.genAiBaseUrl.replace(/\/+$/, '');
  return `${baseUrl}/models/${encodeURIComponent(env.genAiModel)}:generateContent`;
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

async function generateStructuredObject({ prompt, responseSchema, label = 'response' }) {
  if (!isGeminiEnabled()) {
    throw new AppError(503, 'Gemini is not configured for this environment.', {
      provider: env.genAiProvider,
      model: env.genAiModel,
    });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.genAiTimeoutMs);

  try {
    const response = await fetch(buildGeminiUrl(), {
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
        model: env.genAiModel,
      });
    }

    const payload = await response.json();
    const rawText = extractResponseText(payload);

    try {
      return JSON.parse(rawText);
    } catch (error) {
      throw new AppError(502, `Gemini ${label} returned invalid JSON.`, {
        model: env.genAiModel,
        originalError: error.message,
        rawText: rawText.slice(0, 2000),
      });
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new AppError(504, `Gemini ${label} request timed out.`, {
        timeoutMs: env.genAiTimeoutMs,
        model: env.genAiModel,
      });
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = {
  generateStructuredObject,
  isGeminiEnabled,
};

const AppError = require('../errors/AppError');
const { env, featureFlags } = require('../config/env');

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
      return payload.error?.message || payload.message || JSON.stringify(payload);
    } catch (error) {
      return `Request failed with status ${response.status}`;
    }
  }

  const message = await response.text();
  return message || `Request failed with status ${response.status}`;
}

async function postEmbeddingRequest(url, body, label) {
  ensureEmbeddingsConfigured();

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
      throw new AppError(502, `Gemini ${label} request failed.`, {
        status: response.status,
        model: env.embeddingModel,
        response: await parseErrorResponse(response),
      });
    }

    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new AppError(504, `Gemini ${label} request timed out.`, {
        timeoutMs: env.genAiTimeoutMs,
        model: env.embeddingModel,
      });
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
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

  const payload = await postEmbeddingRequest(
    buildEmbeddingUrl('embedContent'),
    buildEmbedRequest({
      text: normalizedText,
      taskType: options.taskType,
      title: options.title,
    }),
    'embedding',
  );

  return {
    provider: 'gemini',
    model: env.embeddingModel,
    taskType: options.taskType || 'TASK_TYPE_UNSPECIFIED',
    values: extractEmbeddingValues(payload, 'embedding'),
  };
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

  if (normalizedEntries.length === 1) {
    const embedding = await embedText(normalizedEntries[0].text, normalizedEntries[0]);
    return [embedding];
  }

  const modelName = buildEmbeddingModelName();
  const payload = await postEmbeddingRequest(
    buildEmbeddingUrl('batchEmbedContents'),
    {
      requests: normalizedEntries.map((entry) => ({
        model: modelName,
        ...buildEmbedRequest(entry),
      })),
    },
    'batch embedding',
  );

  const embeddings = Array.isArray(payload?.embeddings) ? payload.embeddings : [];

  if (embeddings.length !== normalizedEntries.length) {
    throw new AppError(502, 'Gemini batch embedding returned an unexpected number of vectors.', {
      requested: normalizedEntries.length,
      returned: embeddings.length,
      model: env.embeddingModel,
    });
  }

  return embeddings.map((item, index) => {
    const values = Array.isArray(item?.values) ? item.values : [];

    if (!values.length) {
      throw new AppError(502, 'Gemini batch embedding returned an empty vector.', {
        index,
        model: env.embeddingModel,
      });
    }

    return {
      provider: 'gemini',
      model: env.embeddingModel,
      taskType: normalizedEntries[index].taskType || 'TASK_TYPE_UNSPECIFIED',
      values,
    };
  });
}

module.exports = {
  embedText,
  embedTexts,
};

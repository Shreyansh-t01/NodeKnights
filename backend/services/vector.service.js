const path = require('node:path');

const { env, featureFlags } = require('../config/env');
const AppError = require('../errors/AppError');
const { cosineSimilarity } = require('../utils/vectorMath');
const { readJsonFile, writeJsonFile } = require('../utils/jsonStore');

const localVectorStorePath = path.join(env.tempStorageDir, 'local-store', 'vectors.json');

function pineconeBaseUrl() {
  return env.pineconeIndexHost.startsWith('http')
    ? env.pineconeIndexHost
    : `https://${env.pineconeIndexHost}`;
}

function buildPineconeRequiredError(operation, error) {
  return new AppError(503, `Pinecone ${operation} failed and local fallback is disabled.`, {
    service: 'pinecone',
    operation,
    fallbackDisabled: true,
    originalError: error?.message || null,
  });
}

async function upsertLocalVectors(records) {
  const current = await readJsonFile(localVectorStorePath, []);
  const next = current.filter((item) => !records.some((record) => record.id === item.id));
  next.push(...records);
  await writeJsonFile(localVectorStorePath, next);

  return {
    mode: 'local-vector-store',
    count: records.length,
    location: localVectorStorePath,
  };
}

async function upsertPineconeVectors(records) {
  const response = await fetch(`${pineconeBaseUrl()}/vectors/upsert`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': env.pineconeApiKey,
    },
    body: JSON.stringify({
      namespace: env.pineconeNamespace,
      vectors: records.map((record) => ({
        id: record.id,
        values: record.values,
        metadata: record.metadata,
      })),
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Pinecone upsert failed with ${response.status}: ${message}`);
  }

  const payload = await response.json();

  return {
    mode: 'pinecone',
    count: payload.upsertedCount || records.length,
    namespace: env.pineconeNamespace,
  };
}

async function upsertClauseVectors(records) {
  if (env.strictRemoteServices && !featureFlags.pinecone) {
    throw buildPineconeRequiredError('upsert', new Error('Pinecone is not configured.'));
  }

  if (featureFlags.pinecone) {
    try {
      return await upsertPineconeVectors(records);
    } catch (error) {
      if (env.strictRemoteServices) {
        throw buildPineconeRequiredError('upsert', error);
      }

      console.warn('Falling back to local vector store:', error.message);
    }
  }

  return upsertLocalVectors(records);
}

function tokenize(text = '') {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}

function lexicalOverlapScore(queryText, clauseText) {
  const queryTokens = new Set(tokenize(queryText));
  const clauseTokens = new Set(tokenize(clauseText));

  if (!queryTokens.size || !clauseTokens.size) {
    return 0;
  }

  let intersection = 0;

  queryTokens.forEach((token) => {
    if (clauseTokens.has(token)) {
      intersection += 1;
    }
  });

  return intersection / queryTokens.size;
}

function clauseTypeBoost(queryText, clauseType = 'other') {
  const queryTokens = new Set(tokenize(queryText));
  const typeTokens = clauseType.split('_');

  return typeTokens.some((token) => queryTokens.has(token)) ? 0.25 : 0;
}

async function queryLocalVectors(vector, topK, contractId, queryText) {
  const current = await readJsonFile(localVectorStorePath, []);
  const filtered = contractId
    ? current.filter((item) => item.metadata.contractId === contractId)
    : current;

  return filtered
    .map((item) => ({
      id: item.id,
      score: (
        cosineSimilarity(vector, item.values) * 0.55
        + lexicalOverlapScore(queryText, item.metadata.clauseText) * 0.35
        + clauseTypeBoost(queryText, item.metadata.clauseType)
      ),
      metadata: item.metadata,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

async function queryPinecone(vector, topK, contractId) {
  const body = {
    namespace: env.pineconeNamespace,
    vector,
    topK,
    includeMetadata: true,
  };

  if (contractId) {
    body.filter = {
      contractId: {
        $eq: contractId,
      },
    };
  }

  const response = await fetch(`${pineconeBaseUrl()}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': env.pineconeApiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Pinecone query failed with ${response.status}: ${message}`);
  }

  const payload = await response.json();
  return payload.matches || [];
}

async function querySimilarClauses({
  vector,
  topK = 5,
  contractId,
  queryText = '',
}) {
  if (env.strictRemoteServices && !featureFlags.pinecone) {
    throw buildPineconeRequiredError('query', new Error('Pinecone is not configured.'));
  }

  if (featureFlags.pinecone) {
    try {
      return await queryPinecone(vector, topK, contractId);
    } catch (error) {
      if (env.strictRemoteServices) {
        throw buildPineconeRequiredError('query', error);
      }

      console.warn('Falling back to local semantic search:', error.message);
    }
  }

  return queryLocalVectors(vector, topK, contractId, queryText);
}

module.exports = {
  querySimilarClauses,
  upsertClauseVectors,
};

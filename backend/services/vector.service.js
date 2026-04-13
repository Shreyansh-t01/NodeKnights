const path = require('node:path');

const { env, featureFlags } = require('../config/env');
const AppError = require('../errors/AppError');
const { cosineSimilarity } = require('../utils/vectorMath');
const { readJsonFile, writeJsonFile } = require('../utils/jsonStore');

const localVectorStorePath = path.join(env.tempStorageDir, 'local-store', 'vectors.json');

function resolveNamespace(namespace) {
  return namespace || env.pineconeContractNamespace || env.pineconeNamespace;
}

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

function normalizeLocalNamespace(item = {}) {
  return item.namespace || env.pineconeContractNamespace || env.pineconeNamespace;
}

function metadataMatchesFilterValue(actualValue, expectedValue) {
  if (expectedValue && typeof expectedValue === 'object' && !Array.isArray(expectedValue)) {
    if (Object.prototype.hasOwnProperty.call(expectedValue, '$eq')) {
      return actualValue === expectedValue.$eq;
    }

    if (Object.prototype.hasOwnProperty.call(expectedValue, '$ne')) {
      return actualValue !== expectedValue.$ne;
    }

    if (Array.isArray(expectedValue.$in)) {
      if (Array.isArray(actualValue)) {
        return actualValue.some((item) => expectedValue.$in.includes(item));
      }

      return expectedValue.$in.includes(actualValue);
    }
  }

  if (Array.isArray(expectedValue)) {
    if (Array.isArray(actualValue)) {
      return actualValue.some((item) => expectedValue.includes(item));
    }

    return expectedValue.includes(actualValue);
  }

  if (Array.isArray(actualValue)) {
    return actualValue.includes(expectedValue);
  }

  return actualValue === expectedValue;
}

function matchesMetadataFilters(metadata = {}, filters = {}) {
  return Object.entries(filters).every(([key, expectedValue]) => (
    metadataMatchesFilterValue(metadata[key], expectedValue)
  ));
}

function buildPineconeFilter(filters = {}) {
  const clauses = Object.entries(filters).flatMap(([key, expectedValue]) => {
    if (expectedValue === undefined || expectedValue === null || expectedValue === '') {
      return [];
    }

    if (expectedValue && typeof expectedValue === 'object' && !Array.isArray(expectedValue)) {
      return [{ [key]: expectedValue }];
    }

    if (Array.isArray(expectedValue)) {
      return expectedValue.length ? [{ [key]: { $in: expectedValue } }] : [];
    }

    return [{ [key]: { $eq: expectedValue } }];
  });

  if (!clauses.length) {
    return null;
  }

  return clauses.length === 1 ? clauses[0] : { $and: clauses };
}

async function upsertLocalVectors(records, namespace) {
  const resolvedNamespace = resolveNamespace(namespace);
  const current = await readJsonFile(localVectorStorePath, []);
  const next = current.filter((item) => !records.some((record) => (
    record.id === item.id
      && resolveNamespace(record.namespace || resolvedNamespace) === normalizeLocalNamespace(item)
  )));
  next.push(...records.map((record) => ({
    ...record,
    namespace: resolveNamespace(record.namespace || resolvedNamespace),
  })));
  await writeJsonFile(localVectorStorePath, next);

  return {
    mode: 'local-vector-store',
    count: records.length,
    location: localVectorStorePath,
    namespace: resolvedNamespace,
  };
}

async function upsertPineconeVectors(records, namespace) {
  const resolvedNamespace = resolveNamespace(namespace);
  const response = await fetch(`${pineconeBaseUrl()}/vectors/upsert`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': env.pineconeApiKey,
    },
    body: JSON.stringify({
      namespace: resolvedNamespace,
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
    namespace: resolvedNamespace,
  };
}

async function upsertClauseVectors(records, options = {}) {
  const namespace = resolveNamespace(options.namespace || records[0]?.namespace);

  if (env.strictRemoteServices && !featureFlags.pinecone) {
    throw buildPineconeRequiredError('upsert', new Error('Pinecone is not configured.'));
  }

  if (featureFlags.pinecone) {
    try {
      return await upsertPineconeVectors(records, namespace);
    } catch (error) {
      if (env.strictRemoteServices) {
        throw buildPineconeRequiredError('upsert', error);
      }

      console.warn('Falling back to local vector store:', error.message);
    }
  }

  return upsertLocalVectors(records, namespace);
}

async function deleteLocalVectorsByFilter(filters = {}, namespace) {
  const resolvedNamespace = resolveNamespace(namespace);
  const current = await readJsonFile(localVectorStorePath, []);
  let deletedCount = 0;

  const next = current.filter((item) => {
    const shouldDelete = (
      normalizeLocalNamespace(item) === resolvedNamespace
      && matchesMetadataFilters(item.metadata || {}, filters)
    );

    if (shouldDelete) {
      deletedCount += 1;
      return false;
    }

    return true;
  });

  await writeJsonFile(localVectorStorePath, next);

  return {
    mode: 'local-vector-store',
    namespace: resolvedNamespace,
    deletedCount,
    location: localVectorStorePath,
  };
}

async function deletePineconeVectorsByFilter(filters = {}, namespace) {
  const resolvedNamespace = resolveNamespace(namespace);
  const filter = buildPineconeFilter(filters);

  if (!filter) {
    throw new AppError(400, 'A vector deletion filter is required.');
  }

  const response = await fetch(`${pineconeBaseUrl()}/vectors/delete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': env.pineconeApiKey,
    },
    body: JSON.stringify({
      namespace: resolvedNamespace,
      filter,
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Pinecone delete failed with ${response.status}: ${message}`);
  }

  return {
    mode: 'pinecone',
    namespace: resolvedNamespace,
    deletedCount: null,
    filter,
  };
}

async function deleteClauseVectorsForContract(contractId, options = {}) {
  if (!contractId) {
    throw new AppError(400, 'A contract ID is required to delete clause vectors.');
  }

  const namespace = resolveNamespace(options.namespace);
  const filters = {
    contractId,
  };

  if (env.strictRemoteServices && !featureFlags.pinecone) {
    throw buildPineconeRequiredError('delete', new Error('Pinecone is not configured.'));
  }

  if (featureFlags.pinecone) {
    try {
      return await deletePineconeVectorsByFilter(filters, namespace);
    } catch (error) {
      if (env.strictRemoteServices) {
        throw buildPineconeRequiredError('delete', error);
      }

      console.warn('Falling back to local vector delete:', error.message);
    }
  }

  return deleteLocalVectorsByFilter(filters, namespace);
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

function excludeMatch(match, excludeIds = []) {
  return excludeIds.includes(match.id) || excludeIds.includes(match.metadata?.clauseId);
}

function searchableTextFromMetadata(metadata = {}) {
  return metadata.clauseTextFull
    || metadata.clauseTextSummary
    || metadata.clauseText
    || metadata.textFull
    || metadata.textSummary
    || '';
}

function rerankMatches(matches = [], queryText = '', excludeIds = []) {
  const normalizedQuery = String(queryText || '').trim();

  return matches
    .filter((match) => !excludeMatch(match, excludeIds))
    .map((match) => ({
      ...match,
      score: (
        (typeof match.score === 'number' ? match.score : 0) * 0.6
        + lexicalOverlapScore(normalizedQuery, searchableTextFromMetadata(match.metadata || {})) * 0.3
        + clauseTypeBoost(
          normalizedQuery,
          match.metadata?.clauseType || match.metadata?.primaryClauseType || 'other',
        ) * 0.4
      ),
    }))
    .sort((left, right) => right.score - left.score);
}

async function queryLocalVectors(vector, topK, namespace, filters, queryText, excludeIds = []) {
  const resolvedNamespace = resolveNamespace(namespace);
  const current = await readJsonFile(localVectorStorePath, []);
  const filtered = current.filter((item) => (
    normalizeLocalNamespace(item) === resolvedNamespace
      && matchesMetadataFilters(item.metadata || {}, filters)
      && !excludeMatch(item, excludeIds)
  ));

  return filtered
    .map((item) => ({
      id: item.id,
      score: (
        cosineSimilarity(vector, item.values) * 0.55
        + lexicalOverlapScore(queryText, searchableTextFromMetadata(item.metadata || {})) * 0.35
        + clauseTypeBoost(queryText, item.metadata.clauseType || item.metadata.primaryClauseType || 'other')
      ),
      metadata: item.metadata,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

async function queryPinecone(vector, topK, namespace, filters, queryText = '', excludeIds = []) {
  const resolvedNamespace = resolveNamespace(namespace);
  const fetchTopK = Math.max(topK, Math.min(50, topK * 8));
  const body = {
    namespace: resolvedNamespace,
    vector,
    topK: fetchTopK,
    includeMetadata: true,
  };

  const pineconeFilter = buildPineconeFilter(filters);

  if (pineconeFilter) {
    body.filter = pineconeFilter;
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
  return rerankMatches(payload.matches || [], queryText, excludeIds).slice(0, topK);
}

async function querySimilarClauses({
  vector,
  topK = 5,
  namespace,
  filters = {},
  queryText = '',
  excludeIds = [],
}) {
  if (env.strictRemoteServices && !featureFlags.pinecone) {
    throw buildPineconeRequiredError('query', new Error('Pinecone is not configured.'));
  }

  if (featureFlags.pinecone) {
    try {
      return await queryPinecone(vector, topK, namespace, filters, queryText, excludeIds);
    } catch (error) {
      if (env.strictRemoteServices) {
        throw buildPineconeRequiredError('query', error);
      }

      console.warn('Falling back to local semantic search:', error.message);
    }
  }

  return queryLocalVectors(vector, topK, namespace, filters, queryText, excludeIds);
}

module.exports = {
  deleteClauseVectorsForContract,
  querySimilarClauses,
  upsertClauseVectors,
};

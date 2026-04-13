const crypto = require('node:crypto');

const { env } = require('../config/env');
const AppError = require('../errors/AppError');
const { embedText } = require('./embedding.service');
const { reindexContractSearchIndex } = require('./searchIndex.service');
const { querySimilarClauses } = require('./vector.service');
const { buildSemanticAnswer } = require('./insight.service');
const { saveContractCachedInsights } = require('./contract.repository');
const { getContractDetails } = require('./contract.service');

const SEMANTIC_ANSWER_CACHE_LIMIT = 20;

function normalizeSearchMatch(match = {}) {
  return {
    id: match.id,
    score: typeof match.score === 'number' ? Number(match.score.toFixed(4)) : null,
    contractId: match.metadata?.contractId || '',
    contractTitle: match.metadata?.contractTitle || '',
    title: match.metadata?.contractTitle || '',
    clauseId: match.metadata?.clauseId || match.id,
    clauseType: match.metadata?.clauseType || 'other',
    riskLabel: match.metadata?.riskLabel || 'unknown',
    clauseTextSummary: match.metadata?.clauseTextSummary || match.metadata?.clauseText || '',
    clauseTextFull: match.metadata?.clauseTextFull || match.metadata?.clauseText || '',
    position: match.metadata?.position || null,
    sourceType: match.metadata?.sourceType || 'contract',
  };
}

function isReusableGeminiSemanticAnswer(reasoning) {
  return Boolean(
    reasoning
      && reasoning.provider === 'gemini'
      && !reasoning.degraded
      && reasoning.answer,
  );
}

function buildSemanticCacheKey({ query, matches = [] }) {
  const normalizedQuery = String(query || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const matchSignature = matches.slice(0, 3).map((match) => ({
    id: match.id,
    contractId: match.contractId,
    clauseId: match.clauseId,
    score: match.score,
  }));

  return crypto
    .createHash('sha1')
    .update(JSON.stringify({
      query: normalizedQuery,
      matches: matchSignature,
    }))
    .digest('hex');
}

function buildSemanticAnswersPatch(existingEntries = {}, cacheKey, reasoning) {
  const nextEntries = {
    ...(existingEntries || {}),
    [cacheKey]: {
      ...reasoning,
      cachedAt: new Date().toISOString(),
    },
  };

  return Object.entries(nextEntries)
    .sort((left, right) => new Date(right[1]?.cachedAt || 0) - new Date(left[1]?.cachedAt || 0))
    .slice(0, SEMANTIC_ANSWER_CACHE_LIMIT)
    .reduce((accumulator, [key, value]) => {
      accumulator[key] = value;
      return accumulator;
    }, {});
}

async function runSemanticSearch({ query, contractId, topK = 5 }) {
  if (!query || !query.trim()) {
    throw new AppError(400, 'A semantic search query is required.');
  }

  let contract = null;
  let contractBundle = null;

  if (contractId) {
    try {
      contractBundle = await getContractDetails(contractId);
      contract = contractBundle.contract;
    } catch (error) {
      contract = null;
    }
  }

  const embedding = await embedText(query, {
    taskType: 'RETRIEVAL_QUERY',
  });
  const filters = contractId
    ? {
      corpusType: 'contract_clause',
      contractId,
    }
    : {
      corpusType: 'contract_clause',
    };
  let matches = await querySimilarClauses({
    vector: embedding.values,
    topK,
    namespace: env.pineconeContractNamespace,
    filters,
    queryText: query,
  });

  if (!matches.length && contractId) {
    await reindexContractSearchIndex(contractId);
    matches = await querySimilarClauses({
      vector: embedding.values,
      topK,
      namespace: env.pineconeContractNamespace,
      filters,
      queryText: query,
    });

    if (!contract && contractBundle?.contract) {
      contract = contractBundle.contract;
    }
  }

  const normalizedMatches = matches.map(normalizeSearchMatch);
  const semanticCacheKey = contract ? buildSemanticCacheKey({
    query,
    matches: normalizedMatches,
  }) : '';
  const cachedReasoning = semanticCacheKey
    ? contractBundle?.contract?.cachedInsights?.semanticAnswers?.[semanticCacheKey]
    : null;

  if (isReusableGeminiSemanticAnswer(cachedReasoning)) {
    return {
      query,
      matches: normalizedMatches,
      reasoning: cachedReasoning,
    };
  }

  const reasoning = await buildSemanticAnswer({
    query,
    matches: normalizedMatches,
    contract,
  });

  if (contractId && semanticCacheKey && isReusableGeminiSemanticAnswer(reasoning)) {
    await saveContractCachedInsights(contractId, {
      semanticAnswers: buildSemanticAnswersPatch(
        contractBundle?.contract?.cachedInsights?.semanticAnswers || {},
        semanticCacheKey,
        reasoning,
      ),
    });
  }

  return {
    query,
    matches: normalizedMatches,
    reasoning,
  };
}

module.exports = {
  runSemanticSearch,
};

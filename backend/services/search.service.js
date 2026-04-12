const { env } = require('../config/env');
const AppError = require('../errors/AppError');
const { embedText } = require('./embedding.service');
const { reindexContractSearchIndex } = require('./searchIndex.service');
const { querySimilarClauses } = require('./vector.service');
const { buildSemanticAnswer } = require('./insight.service');
const { getContractDetails } = require('./contract.service');

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

  return {
    query,
    matches: normalizedMatches,
    reasoning: await buildSemanticAnswer({
      query,
      matches: normalizedMatches,
      contract,
    }),
  };
}

module.exports = {
  runSemanticSearch,
};

const { env } = require('../config/env');
const AppError = require('../errors/AppError');
const { embedText } = require('./embedding.service');
const { querySimilarClauses } = require('./vector.service');
const { buildSemanticAnswer } = require('./insight.service');
const { getContractDetails } = require('./contract.service');

function normalizeText(value) {
  if (!value) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function buildSpeakText(reasoning, query, contract) {
  const cleanReasoning = normalizeText(reasoning);

  if (!cleanReasoning) {
    const contractTitle = contract?.title ? ` for contract ${contract.title}` : '';
    return `I could not find a strong recommendation${contractTitle}. Please try a more specific search query.`;
  }

  return cleanReasoning
    .replace(/\*\*/g, '')
    .replace(/#{1,6}\s/g, '')
    .replace(/`/g, '')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

async function runSemanticSearch({ query, contractId, topK = 5 }) {
  const cleanedQuery = normalizeText(query);

  if (!cleanedQuery) {
    throw new AppError(400, 'A semantic search query is required.');
  }

  const embedding = await embedText(cleanedQuery);

  const matches = await querySimilarClauses({
    vector: embedding.values,
    topK,
    namespace: env.pineconeContractNamespace,
    filters: contractId
      ? {
          corpusType: 'contract_clause',
          contractId,
        }
      : {
          corpusType: 'contract_clause',
        },
    queryText: cleanedQuery,
  });

  let contract = null;

  if (contractId) {
    try {
      const contractBundle = await getContractDetails(contractId);
      contract = contractBundle.contract;
    } catch (error) {
      contract = null;
    }
  }

  const reasoning = await buildSemanticAnswer({
    query: cleanedQuery,
    matches,
    contract,
  });

  const answer = normalizeText(reasoning);
  const speakText = buildSpeakText(reasoning, cleanedQuery, contract);

  return {
    query: cleanedQuery,
    contractId: contractId || null,
    contract: contract
      ? {
          id: contract.id || null,
          title: contract.title || 'Untitled contract',
        }
      : null,
    matches,
    reasoning,
    answer,
    speakText,
    voiceEnabled: true,
  };
}

module.exports = {
  runSemanticSearch,
};

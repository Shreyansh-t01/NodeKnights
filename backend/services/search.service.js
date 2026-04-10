const { env } = require('../config/env');
const AppError = require('../errors/AppError');
const { embedText } = require('./embedding.service');
const { querySimilarClauses } = require('./vector.service');
const { buildSemanticAnswer } = require('./insight.service');
const { getContractDetails } = require('./contract.service');

async function runSemanticSearch({ query, contractId, topK = 5 }) {
  if (!query || !query.trim()) {
    throw new AppError(400, 'A semantic search query is required.');
  }

  const embedding = await embedText(query);
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
    queryText: query,
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

  return {
    query,
    matches,
    reasoning: await buildSemanticAnswer({
      query,
      matches,
      contract,
    }),
  };
}

module.exports = {
  runSemanticSearch,
};

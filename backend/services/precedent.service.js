const path = require('node:path');
const { v4: uuidv4 } = require('uuid');

const { env, featureFlags } = require('../config/env');
const AppError = require('../errors/AppError');
const { extractTextFromDocument } = require('./documentExtraction.service');
const { analyzeContractText } = require('./mlAnalysis.service');
const { embedText, embedTexts } = require('./embedding.service');
const { formatClauseType } = require('./contract.helpers');
const { getContractById } = require('./contract.repository');
const { querySimilarClauses, upsertClauseVectors } = require('./vector.service');
const { getPrecedentById, listPrecedents, savePrecedentBundle } = require('./precedent.repository');

function parseTitle(value = 'Precedent') {
  return path.parse(String(value || 'Precedent')).name.replace(/[_-]+/g, ' ').trim() || 'Precedent';
}

function asText(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(
    value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean),
  )];
}

function normalizeClauseType(value = 'other') {
  return String(value || 'other').trim().toLowerCase().replace(/\s+/g, '_') || 'other';
}

function normalizeRiskLabel(value = 'low') {
  const normalized = String(value || 'low').trim().toLowerCase();
  return ['low', 'medium', 'high'].includes(normalized) ? normalized : 'low';
}

function riskScore(riskLabel = 'low') {
  if (riskLabel === 'high') {
    return 90;
  }

  if (riskLabel === 'medium') {
    return 60;
  }

  return 30;
}

function summarizeClauseTypes(clauses = []) {
  return [...new Set(clauses.map((clause) => clause.clauseType).filter(Boolean))];
}

function buildPrecedentRecord({
  precedentId,
  title,
  source,
  originalName,
  metadata = {},
  clauseTypes = [],
  clauseCount = 0,
}) {
  const createdAt = new Date().toISOString();

  return {
    id: precedentId,
    title,
    source,
    status: 'active',
    metadata: {
      originalName,
      contractType: asText(metadata.contractType),
      organization: asText(metadata.organization),
      jurisdiction: asText(metadata.jurisdiction),
      tags: asStringArray(metadata.tags),
      note: asText(metadata.note),
      clauseTypes,
      clauseCount,
    },
    createdAt,
    updatedAt: createdAt,
  };
}

function buildManualClauseRecords(precedentId, clauses = [], defaults = {}) {
  const createdAt = new Date().toISOString();

  return clauses.map((entry, index) => {
    const clauseType = normalizeClauseType(entry.clauseType || defaults.clauseType || 'other');
    const clauseTextFull = asText(
      entry.clauseTextFull || entry.text || entry.clauseText || entry.body,
    );

    if (!clauseTextFull) {
      throw new AppError(400, `Clause text is required for precedent clause ${index + 1}.`);
    }

    const clauseTextSummary = asText(entry.clauseTextSummary || entry.clauseText, clauseTextFull);
    const riskLabel = normalizeRiskLabel(entry.riskLabel || defaults.riskLabel || 'low');

    return {
      id: entry.id || `precedent_clause_${uuidv4()}`,
      precedentId,
      position: index + 1,
      clauseText: clauseTextSummary,
      clauseTextSummary,
      clauseTextFull,
      clauseType,
      clauseLabel: formatClauseType(clauseType),
      riskLabel,
      riskScore: riskScore(riskLabel),
      sectionHeading: asText(entry.sectionHeading),
      contractType: asText(entry.contractType || defaults.contractType),
      jurisdiction: asText(entry.jurisdiction || defaults.jurisdiction),
      tags: asStringArray([
        ...(Array.isArray(entry.tags) ? entry.tags : []),
        clauseType,
        riskLabel,
      ]),
      createdAt,
      updatedAt: createdAt,
    };
  });
}

function buildAnalyzedClauseRecords(precedentId, analysisClauses = [], defaults = {}) {
  const createdAt = new Date().toISOString();

  return analysisClauses.map((clause, index) => {
    const clauseType = normalizeClauseType(clause.clauseType || defaults.clauseType || 'other');
    const riskLabel = normalizeRiskLabel(clause.riskLabel || defaults.riskLabel || 'low');
    const clauseTextFull = asText(clause.clauseTextFull || clause.clauseText);
    const clauseTextSummary = asText(clause.clauseTextSummary || clause.clauseText, clauseTextFull);

    return {
      id: `precedent_clause_${uuidv4()}`,
      precedentId,
      position: index + 1,
      clauseText: clauseTextSummary,
      clauseTextSummary,
      clauseTextFull,
      clauseType,
      clauseLabel: formatClauseType(clauseType),
      riskLabel,
      riskScore: riskScore(riskLabel),
      sectionHeading: '',
      contractType: asText(defaults.contractType),
      jurisdiction: asText(defaults.jurisdiction),
      tags: asStringArray([clauseType, riskLabel]),
      createdAt,
      updatedAt: createdAt,
    };
  });
}

async function buildVectorRecords(precedent, clauses = []) {
  const embeddings = await embedTexts(
    clauses.map((clause) => ({
      text: clause.clauseTextFull || clause.clauseText,
      title: `${precedent.title} ${clause.clauseLabel || clause.clauseType || 'clause'}`.trim(),
      taskType: 'RETRIEVAL_DOCUMENT',
    })),
  );

  return clauses.map((clause, index) => ({
    id: clause.id,
    namespace: env.pineconePrecedentNamespace,
    values: embeddings[index].values,
    metadata: {
      corpusType: 'precedent_clause',
      precedentId: precedent.id,
      precedentTitle: precedent.title,
      clauseId: clause.id,
      clauseType: clause.clauseType,
      riskLabel: clause.riskLabel,
      clauseText: clause.clauseText,
      clauseTextSummary: clause.clauseTextSummary || clause.clauseText,
      clauseTextFull: clause.clauseTextFull || clause.clauseText,
      position: clause.position,
      sectionHeading: clause.sectionHeading || '',
      contractType: clause.contractType || precedent.metadata?.contractType || '',
      jurisdiction: clause.jurisdiction || precedent.metadata?.jurisdiction || '',
      sourceType: 'precedent',
      tags: clause.tags || [],
      embeddingProvider: embeddings[index].provider,
      embeddingModel: embeddings[index].model,
      embeddingTaskType: embeddings[index].taskType,
    },
  }));
}

function normalizeMatch(match) {
  return {
    id: match.id,
    score: typeof match.score === 'number' ? Number(match.score.toFixed(4)) : null,
    precedentId: match.metadata?.precedentId || '',
    title: match.metadata?.precedentTitle || '',
    clauseId: match.metadata?.clauseId || match.id,
    clauseType: match.metadata?.clauseType || 'other',
    riskLabel: match.metadata?.riskLabel || 'unknown',
    clauseTextSummary: match.metadata?.clauseTextSummary || match.metadata?.clauseText || '',
    clauseTextFull: match.metadata?.clauseTextFull || match.metadata?.clauseText || '',
    sectionHeading: match.metadata?.sectionHeading || '',
    contractType: match.metadata?.contractType || '',
    jurisdiction: match.metadata?.jurisdiction || '',
    sourceType: match.metadata?.sourceType || 'precedent',
  };
}

function mergeMatches(primary = [], secondary = [], maxItems = 3) {
  const map = new Map();

  [...primary, ...secondary].forEach((match) => {
    if (!map.has(match.id)) {
      map.set(match.id, match);
    }
  });

  return [...map.values()].slice(0, maxItems);
}

async function createPrecedentFromEntries(payload = {}) {
  if (!Array.isArray(payload.clauses) || !payload.clauses.length) {
    throw new AppError(400, 'Provide at least one precedent clause in the "clauses" array.');
  }

  if (!featureFlags.pinecone) {
    throw new AppError(503, 'Pinecone must be configured before precedents can be indexed for deployed retrieval.');
  }

  const precedentId = `precedent_${uuidv4()}`;
  const title = asText(payload.title, 'Precedent');
  const clauses = buildManualClauseRecords(precedentId, payload.clauses, payload);
  const precedent = buildPrecedentRecord({
    precedentId,
    title,
    source: payload.source || 'manual-entry',
    originalName: payload.originalName || title,
    metadata: payload,
    clauseTypes: summarizeClauseTypes(clauses),
    clauseCount: clauses.length,
  });

  const vectorRecords = await buildVectorRecords(precedent, clauses);
  const persistence = await savePrecedentBundle({ precedent, clauses });
  const vectorIndex = await upsertClauseVectors(vectorRecords, {
    namespace: env.pineconePrecedentNamespace,
  });

  return {
    precedent,
    clauses,
    diagnostics: {
      persistence,
      vectorIndex,
    },
  };
}

async function ingestPrecedentDocument(file, options = {}) {
  if (!file) {
    throw new AppError(400, 'A precedent document file is required.');
  }

  if (!featureFlags.pinecone) {
    throw new AppError(503, 'Pinecone must be configured before precedents can be indexed for deployed retrieval.');
  }

  const precedentId = `precedent_${uuidv4()}`;
  const extracted = await extractTextFromDocument(file);
  const analysis = await analyzeContractText(extracted.text);
  const clauses = buildAnalyzedClauseRecords(precedentId, analysis.clauses, options);

  if (!clauses.length) {
    throw new AppError(422, 'The uploaded precedent document did not produce any usable clause records.');
  }

  const title = asText(options.title, parseTitle(file.originalname));
  const precedent = buildPrecedentRecord({
    precedentId,
    title,
    source: options.source || 'file-upload',
    originalName: file.originalname,
    metadata: options,
    clauseTypes: summarizeClauseTypes(clauses),
    clauseCount: clauses.length,
  });

  const vectorRecords = await buildVectorRecords(precedent, clauses);
  const persistence = await savePrecedentBundle({ precedent, clauses });
  const vectorIndex = await upsertClauseVectors(vectorRecords, {
    namespace: env.pineconePrecedentNamespace,
  });

  return {
    precedent,
    clauses,
    diagnostics: {
      extraction: extracted,
      analysisSource: analysis.source,
      persistence,
      vectorIndex,
    },
  };
}

async function findPrecedentMatchesForClause({ clause, topK = 3, vector = null, queryText = '' }) {
  const searchText = asText(queryText || clause?.clauseTextFull || clause?.clauseText);

  if (!searchText || !featureFlags.pinecone) {
    return [];
  }

  try {
    const embeddingValues = Array.isArray(vector) && vector.length
      ? vector
      : (await embedText(searchText, {
        taskType: 'RETRIEVAL_QUERY',
      })).values;
    const clauseType = normalizeClauseType(clause?.clauseType || 'other');

    const primaryMatches = clauseType !== 'other'
      ? await querySimilarClauses({
        vector: embeddingValues,
        topK,
        namespace: env.pineconePrecedentNamespace,
        filters: {
          clauseType,
        },
        queryText: searchText,
      })
      : [];

    const fallbackMatches = primaryMatches.length < topK
      ? await querySimilarClauses({
        vector: embeddingValues,
        topK,
        namespace: env.pineconePrecedentNamespace,
        queryText: searchText,
      })
      : [];

    return mergeMatches(primaryMatches, fallbackMatches, topK).map(normalizeMatch);
  } catch (error) {
    console.warn('Precedent retrieval failed, continuing without precedent matches:', error.message);
    return [];
  }
}

async function findComparableContractMatchesForClause({ clause, topK = 3, vector = null, queryText = '' }) {
  const searchText = asText(queryText || clause?.clauseTextFull || clause?.clauseText);

  if (!searchText || !featureFlags.pinecone) {
    return [];
  }

  try {
    const embeddingValues = Array.isArray(vector) && vector.length
      ? vector
      : (await embedText(searchText, {
        taskType: 'RETRIEVAL_QUERY',
      })).values;
    const clauseType = normalizeClauseType(clause?.clauseType || 'other');

    const primaryMatches = await querySimilarClauses({
      vector: embeddingValues,
      topK,
      namespace: env.pineconeContractNamespace,
      filters: {
        corpusType: 'contract_clause',
        contractId: {
          $ne: clause?.contractId || '',
        },
        ...(clauseType !== 'other' ? { clauseType } : {}),
      },
      queryText: searchText,
      excludeIds: [clause?.id].filter(Boolean),
    });

    return primaryMatches.map((match) => ({
      ...normalizeMatch(match),
      title: match.metadata?.contractTitle || '',
      sourceType: 'contract-comparison',
    }));
  } catch (error) {
    console.warn('Contract comparison retrieval failed, continuing without comparison matches:', error.message);
    return [];
  }
}

async function listPrecedentSummaries() {
  return listPrecedents();
}

async function getPrecedentDetails(precedentId) {
  return getPrecedentById(precedentId);
}

async function getClausePrecedents(contractId, clauseId, topK = 3) {
  const contractBundle = await getContractById(contractId);
  const clause = contractBundle.clauses.find((item) => item.id === clauseId);

  if (!clause) {
    throw new AppError(404, `Clause not found: ${clauseId}`);
  }

  const matches = await findPrecedentMatchesForClause({ clause, topK });

  return {
    contractId,
    contractTitle: contractBundle.contract.title,
    clauseId,
    clauseType: clause.clauseType,
    riskLabel: clause.riskLabel,
    currentClause: {
      contractId,
      contractTitle: contractBundle.contract.title,
      clauseId: clause.id,
      clauseType: clause.clauseType,
      riskLabel: clause.riskLabel,
      clauseTextSummary: clause.clauseTextSummary || clause.clauseText,
      clauseTextFull: clause.clauseTextFull || clause.clauseText,
      position: clause.position || null,
    },
    matches,
  };
}

module.exports = {
  createPrecedentFromEntries,
  buildVectorRecords,
  findComparableContractMatchesForClause,
  findPrecedentMatchesForClause,
  getClausePrecedents,
  getPrecedentDetails,
  ingestPrecedentDocument,
  listPrecedentSummaries,
};

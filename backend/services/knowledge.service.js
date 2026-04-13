const path = require('node:path');
const { v4: uuidv4 } = require('uuid');

const { env, featureFlags } = require('../config/env');
const AppError = require('../errors/AppError');
const { extractTextFromDocument } = require('./documentExtraction.service');
const { embedText, embedTexts } = require('./embedding.service');
const { querySimilarClauses, upsertClauseVectors } = require('./vector.service');
const {
  getKnowledgeDocumentById,
  listKnowledgeDocuments,
  saveKnowledgeBundle,
} = require('./knowledge.repository');

function parseTitle(value = 'Knowledge Document') {
  return path.parse(String(value || 'Knowledge Document')).name.replace(/[_-]+/g, ' ').trim() || 'Knowledge Document';
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

function buildKnowledgeRecord({
  knowledgeId,
  title,
  source,
  originalName,
  metadata = {},
  chunkCount = 0,
  clauseTypes = [],
}) {
  const createdAt = new Date().toISOString();

  return {
    id: knowledgeId,
    title,
    source,
    status: asText(metadata.status, 'active'),
    metadata: {
      originalName,
      sourceType: asText(metadata.sourceType, 'policy'),
      documentType: asText(metadata.documentType, 'rulebook'),
      organization: asText(metadata.organization),
      jurisdiction: asText(metadata.jurisdiction),
      league: asText(metadata.league),
      sport: asText(metadata.sport),
      version: asText(metadata.version),
      effectiveFrom: asText(metadata.effectiveFrom),
      effectiveTo: asText(metadata.effectiveTo),
      topics: asStringArray(metadata.topics),
      tags: asStringArray(metadata.tags),
      note: asText(metadata.note),
      clauseTypes,
      chunkCount,
    },
    createdAt,
    updatedAt: createdAt,
  };
}

function summarizeText(text = '', maxLength = 240) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3).trim()}...`;
}

function splitIntoChunks(text = '', maxLength = 1200) {
  const paragraphs = String(text || '')
    .split(/\n{2,}/)
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  if (!paragraphs.length) {
    return [];
  }

  const chunks = [];
  let current = '';

  paragraphs.forEach((paragraph) => {
    if (!current) {
      current = paragraph;
      return;
    }

    if (`${current}\n\n${paragraph}`.length <= maxLength) {
      current = `${current}\n\n${paragraph}`;
      return;
    }

    chunks.push(current);
    current = paragraph;
  });

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function buildManualChunkRecords(knowledgeId, rules = [], defaults = {}) {
  const createdAt = new Date().toISOString();

  return rules.map((entry, index) => {
    const primaryConcern = asText(entry.primaryConcern);
    const benchmark = asText(entry.benchmark);
    const recommendedAction = asText(entry.recommendedAction);
    const rawText = asText(entry.textFull || entry.text || entry.body);
    const primaryClauseType = normalizeClauseType(entry.clauseType || defaults.clauseType || 'other');
    const clauseTypes = asStringArray([
      ...(Array.isArray(entry.clauseTypes) ? entry.clauseTypes : []),
      primaryClauseType,
      ...(Array.isArray(defaults.clauseTypes) ? defaults.clauseTypes : []),
    ]).map(normalizeClauseType);
    const textFull = [primaryConcern, benchmark, recommendedAction, rawText].filter(Boolean).join('\n').trim();

    if (!textFull) {
      throw new AppError(400, `Rule text is required for knowledge entry ${index + 1}.`);
    }

    return {
      id: entry.id || `knowledge_chunk_${uuidv4()}`,
      knowledgeId,
      position: index + 1,
      sectionTitle: asText(entry.sectionTitle, `Rule ${index + 1}`),
      primaryClauseType,
      clauseTypes,
      primaryConcern,
      benchmark,
      recommendedAction,
      textSummary: asText(entry.textSummary, summarizeText(textFull)),
      textFull,
      sourceType: asText(entry.sourceType || defaults.sourceType, 'policy'),
      documentType: asText(entry.documentType || defaults.documentType, 'rulebook'),
      organization: asText(entry.organization || defaults.organization),
      jurisdiction: asText(entry.jurisdiction || defaults.jurisdiction),
      league: asText(entry.league || defaults.league),
      sport: asText(entry.sport || defaults.sport),
      version: asText(entry.version || defaults.version),
      status: asText(entry.status || defaults.status, 'active'),
      tags: asStringArray([
        ...(Array.isArray(entry.tags) ? entry.tags : []),
        ...clauseTypes,
      ]),
      createdAt,
      updatedAt: createdAt,
    };
  });
}

function buildTextChunkRecords(knowledgeId, text, defaults = {}) {
  const createdAt = new Date().toISOString();
  const clauseTypes = asStringArray(defaults.clauseTypes).map(normalizeClauseType);
  const primaryClauseType = normalizeClauseType(defaults.clauseType || clauseTypes[0] || 'other');

  return splitIntoChunks(text).map((chunk, index) => ({
    id: `knowledge_chunk_${uuidv4()}`,
    knowledgeId,
    position: index + 1,
    sectionTitle: index === 0 ? 'Overview' : `Section ${index + 1}`,
    primaryClauseType,
    clauseTypes: [...new Set([primaryClauseType, ...clauseTypes])],
    primaryConcern: '',
    benchmark: '',
    recommendedAction: '',
    textSummary: summarizeText(chunk),
    textFull: chunk,
    sourceType: asText(defaults.sourceType, 'policy'),
    documentType: asText(defaults.documentType, 'rulebook'),
    organization: asText(defaults.organization),
    jurisdiction: asText(defaults.jurisdiction),
    league: asText(defaults.league),
    sport: asText(defaults.sport),
    version: asText(defaults.version),
    status: asText(defaults.status, 'active'),
    tags: asStringArray([primaryClauseType, ...(Array.isArray(defaults.tags) ? defaults.tags : [])]),
    createdAt,
    updatedAt: createdAt,
  }));
}

async function buildVectorRecords(knowledgeDocument, chunks = []) {
  const searchPayloads = chunks.map((chunk) => ({
    text: [
      chunk.sectionTitle,
      chunk.primaryConcern,
      chunk.benchmark,
      chunk.recommendedAction,
      chunk.textFull,
    ]
      .filter(Boolean)
      .join('\n'),
    title: `${knowledgeDocument.title} ${chunk.sectionTitle || chunk.primaryClauseType || 'chunk'}`.trim(),
    taskType: 'RETRIEVAL_DOCUMENT',
  }));
  const embeddings = await embedTexts(searchPayloads);

  return chunks.map((chunk, index) => ({
    id: chunk.id,
    namespace: env.pineconeKnowledgeNamespace,
    values: embeddings[index].values,
    metadata: {
      corpusType: 'knowledge_chunk',
      knowledgeId: knowledgeDocument.id,
      knowledgeTitle: knowledgeDocument.title,
      chunkId: chunk.id,
      position: chunk.position,
      sectionTitle: chunk.sectionTitle,
      primaryClauseType: chunk.primaryClauseType,
      clauseTypes: chunk.clauseTypes,
      primaryConcern: chunk.primaryConcern,
      benchmark: chunk.benchmark,
      recommendedAction: chunk.recommendedAction,
      textSummary: chunk.textSummary,
      textFull: chunk.textFull,
      sourceType: chunk.sourceType || knowledgeDocument.metadata?.sourceType || 'policy',
      documentType: chunk.documentType || knowledgeDocument.metadata?.documentType || 'rulebook',
      organization: chunk.organization || knowledgeDocument.metadata?.organization || '',
      jurisdiction: chunk.jurisdiction || knowledgeDocument.metadata?.jurisdiction || '',
      league: chunk.league || knowledgeDocument.metadata?.league || '',
      sport: chunk.sport || knowledgeDocument.metadata?.sport || '',
      version: chunk.version || knowledgeDocument.metadata?.version || '',
      status: chunk.status || knowledgeDocument.status || 'active',
      tags: chunk.tags || [],
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
    knowledgeId: match.metadata?.knowledgeId || '',
    title: match.metadata?.knowledgeTitle || '',
    chunkId: match.metadata?.chunkId || match.id,
    sectionTitle: match.metadata?.sectionTitle || '',
    sourceType: match.metadata?.sourceType || 'policy',
    documentType: match.metadata?.documentType || 'rulebook',
    primaryClauseType: match.metadata?.primaryClauseType || 'other',
    clauseTypes: Array.isArray(match.metadata?.clauseTypes) ? match.metadata.clauseTypes : [],
    primaryConcern: match.metadata?.primaryConcern || '',
    benchmark: match.metadata?.benchmark || '',
    recommendedAction: match.metadata?.recommendedAction || '',
    textSummary: match.metadata?.textSummary || '',
    textFull: match.metadata?.textFull || '',
    organization: match.metadata?.organization || '',
    jurisdiction: match.metadata?.jurisdiction || '',
    league: match.metadata?.league || '',
    sport: match.metadata?.sport || '',
    version: match.metadata?.version || '',
    status: match.metadata?.status || 'active',
  };
}

function mergeMatches(primary = [], secondary = [], maxItems = 4) {
  const map = new Map();

  [...primary, ...secondary].forEach((match) => {
    if (!map.has(match.id)) {
      map.set(match.id, match);
    }
  });

  return [...map.values()].slice(0, maxItems);
}

async function createKnowledgeFromEntries(payload = {}) {
  if (!Array.isArray(payload.rules) || !payload.rules.length) {
    throw new AppError(400, 'Provide at least one rule or policy entry in the "rules" array.');
  }

  if (!featureFlags.pinecone) {
    throw new AppError(503, 'Pinecone must be configured before rules and policies can be indexed for deployed retrieval.');
  }

  const knowledgeId = `knowledge_${uuidv4()}`;
  const title = asText(payload.title, 'Knowledge Document');
  const chunks = buildManualChunkRecords(knowledgeId, payload.rules, payload);
  const clauseTypes = [...new Set(chunks.flatMap((chunk) => chunk.clauseTypes || []))];
  const knowledgeDocument = buildKnowledgeRecord({
    knowledgeId,
    title,
    source: payload.source || 'manual-entry',
    originalName: payload.originalName || title,
    metadata: payload,
    chunkCount: chunks.length,
    clauseTypes,
  });

  const vectorRecords = await buildVectorRecords(knowledgeDocument, chunks);
  const persistence = await saveKnowledgeBundle({ knowledgeDocument, chunks });
  const vectorIndex = await upsertClauseVectors(vectorRecords, {
    namespace: env.pineconeKnowledgeNamespace,
  });

  return {
    knowledgeDocument,
    chunks,
    diagnostics: {
      persistence,
      vectorIndex,
    },
  };
}

async function ingestKnowledgeDocument(file, options = {}) {
  if (!file) {
    throw new AppError(400, 'A rulebook or policy file is required.');
  }

  if (!featureFlags.pinecone) {
    throw new AppError(503, 'Pinecone must be configured before rules and policies can be indexed for deployed retrieval.');
  }

  const knowledgeId = `knowledge_${uuidv4()}`;
  const extracted = await extractTextFromDocument(file);
  const chunks = buildTextChunkRecords(knowledgeId, extracted.text, options);

  if (!chunks.length) {
    throw new AppError(422, 'The uploaded rulebook did not produce any usable text chunks.');
  }

  const title = asText(options.title, parseTitle(file.originalname));
  const clauseTypes = [...new Set(chunks.flatMap((chunk) => chunk.clauseTypes || []))];
  const knowledgeDocument = buildKnowledgeRecord({
    knowledgeId,
    title,
    source: options.source || 'file-upload',
    originalName: file.originalname,
    metadata: options,
    chunkCount: chunks.length,
    clauseTypes,
  });

  const vectorRecords = await buildVectorRecords(knowledgeDocument, chunks);
  const persistence = await saveKnowledgeBundle({ knowledgeDocument, chunks });
  const vectorIndex = await upsertClauseVectors(vectorRecords, {
    namespace: env.pineconeKnowledgeNamespace,
  });

  return {
    knowledgeDocument,
    chunks,
    diagnostics: {
      extraction: extracted,
      persistence,
      vectorIndex,
    },
  };
}

async function findRelevantKnowledge({ clause, topK = 4, vector = null, queryText = '' }) {
  const clauseText = asText(queryText || clause?.clauseTextFull || clause?.clauseText);

  if (!clauseText || !featureFlags.pinecone) {
    return [];
  }

  try {
    const effectiveQueryText = `${normalizeClauseType(clause?.clauseType || 'other').replace(/_/g, ' ')} ${clauseText}`.trim();
    const embeddingValues = Array.isArray(vector) && vector.length
      ? vector
      : (await embedText(effectiveQueryText, {
        taskType: 'RETRIEVAL_QUERY',
      })).values;
    const primaryClauseType = normalizeClauseType(clause?.clauseType || 'other');

    const targetedMatches = primaryClauseType !== 'other'
      ? await querySimilarClauses({
        vector: embeddingValues,
        topK,
        namespace: env.pineconeKnowledgeNamespace,
        filters: {
          primaryClauseType,
        },
        queryText: effectiveQueryText,
      })
      : [];

    const fallbackMatches = targetedMatches.length < topK
      ? await querySimilarClauses({
        vector: embeddingValues,
        topK,
        namespace: env.pineconeKnowledgeNamespace,
        queryText: effectiveQueryText,
      })
      : [];

    return mergeMatches(targetedMatches, fallbackMatches, topK).map(normalizeMatch);
  } catch (error) {
    console.warn('Knowledge retrieval failed, continuing without rule matches:', error.message);
    return [];
  }
}

async function searchKnowledge({ query, topK = 5, clauseType } = {}) {
  if (!asText(query)) {
    throw new AppError(400, 'A search query is required for knowledge search.');
  }

  if (!featureFlags.pinecone) {
    throw new AppError(503, 'Pinecone must be configured before knowledge search can run.');
  }

  const embedding = await embedText(query, {
    taskType: 'RETRIEVAL_QUERY',
  });
  const normalizedClauseType = asText(clauseType) ? normalizeClauseType(clauseType) : '';
  const matches = await querySimilarClauses({
    vector: embedding.values,
    topK,
    namespace: env.pineconeKnowledgeNamespace,
    filters: normalizedClauseType
      ? {
        primaryClauseType: normalizedClauseType,
      }
      : {},
    queryText: query,
  });

  return {
    query,
    matches: matches.map(normalizeMatch),
  };
}

async function listKnowledgeSummaries() {
  return listKnowledgeDocuments();
}

async function getKnowledgeDetails(knowledgeId) {
  return getKnowledgeDocumentById(knowledgeId);
}

module.exports = {
  buildKnowledgeRecord,
  buildManualChunkRecords,
  buildVectorRecords,
  createKnowledgeFromEntries,
  findRelevantKnowledge,
  getKnowledgeDetails,
  ingestKnowledgeDocument,
  listKnowledgeSummaries,
  searchKnowledge,
};

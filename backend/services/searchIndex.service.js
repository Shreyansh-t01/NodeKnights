const fs = require('node:fs/promises');

const AppError = require('../errors/AppError');
const { env, featureFlags } = require('../config/env');
const { formatClauseType } = require('./contract.helpers');
const { getContractById, listContracts } = require('./contract.repository');
const { createVectorRecords } = require('./contract.service');
const { getKnowledgeDocumentById, listKnowledgeDocuments, saveKnowledgeBundle } = require('./knowledge.repository');
const {
  buildKnowledgeRecord,
  buildManualChunkRecords,
  buildVectorRecords: buildKnowledgeVectorRecords,
} = require('./knowledge.service');
const { getPrecedentById, listPrecedents } = require('./precedent.repository');
const { buildVectorRecords: buildPrecedentVectorRecords } = require('./precedent.service');
const { upsertClauseVectors } = require('./vector.service');

const SYSTEM_RULEBOOK_KNOWLEDGE_ID = 'knowledge_system_rulebook_v1';

let activeSyncPromise = null;

function ensureSearchIndexingReady() {
  if (featureFlags.pinecone) {
    return;
  }

  throw new AppError(503, 'Pinecone must be configured for live search indexing.', {
    namespace: env.pineconeContractNamespace,
  });
}

async function reindexContractSearchIndex(contractId) {
  ensureSearchIndexingReady();

  const bundle = await getContractById(contractId);
  const vectorRecords = await createVectorRecords(bundle.contract, bundle.clauses || []);

  if (!vectorRecords.length) {
    return {
      contractId,
      contractTitle: bundle.contract?.title || '',
      vectorCount: 0,
      skipped: true,
    };
  }

  const vectorIndex = await upsertClauseVectors(vectorRecords, {
    namespace: env.pineconeContractNamespace,
  });

  return {
    contractId,
    contractTitle: bundle.contract?.title || '',
    vectorCount: vectorRecords.length,
    vectorIndex,
  };
}

async function reindexAllContractSearchIndexes() {
  const contracts = await listContracts();
  const results = [];

  for (const contract of contracts) {
    results.push(await reindexContractSearchIndex(contract.id));
  }

  return {
    documentCount: results.length,
    vectorCount: results.reduce((sum, item) => sum + (item.vectorCount || 0), 0),
    results,
  };
}

async function reindexAllPrecedentSearchIndexes() {
  ensureSearchIndexingReady();

  const precedents = await listPrecedents();
  const results = [];

  for (const precedent of precedents) {
    const bundle = await getPrecedentById(precedent.id);
    const vectorRecords = await buildPrecedentVectorRecords(bundle.precedent, bundle.clauses || []);
    const vectorIndex = vectorRecords.length
      ? await upsertClauseVectors(vectorRecords, {
        namespace: env.pineconePrecedentNamespace,
      })
      : null;

    results.push({
      precedentId: precedent.id,
      title: bundle.precedent?.title || '',
      vectorCount: vectorRecords.length,
      vectorIndex,
    });
  }

  return {
    documentCount: results.length,
    vectorCount: results.reduce((sum, item) => sum + (item.vectorCount || 0), 0),
    results,
  };
}

async function ensureRulebookKnowledgeIndexed() {
  ensureSearchIndexingReady();

  const rawRulebook = await fs.readFile(env.rulebookPath, 'utf-8');
  const rulebookEntries = JSON.parse(rawRulebook);
  const rules = rulebookEntries.map((entry) => ({
    id: `${SYSTEM_RULEBOOK_KNOWLEDGE_ID}_${entry.clauseType}`,
    sectionTitle: formatClauseType(entry.clauseType || 'other'),
    clauseType: entry.clauseType,
    primaryConcern: entry.primaryConcern,
    benchmark: entry.benchmark,
    recommendedAction: entry.recommendedAction,
    textSummary: entry.benchmark,
    sourceType: 'rulebook',
    documentType: 'rulebook',
    version: 'system-v1',
    status: 'active',
    tags: [entry.clauseType || 'other', 'system-rulebook'],
  }));

  const chunks = buildManualChunkRecords(SYSTEM_RULEBOOK_KNOWLEDGE_ID, rules, {
    sourceType: 'rulebook',
    documentType: 'rulebook',
    version: 'system-v1',
    status: 'active',
    tags: ['system-rulebook'],
  });
  const clauseTypes = [...new Set(chunks.flatMap((chunk) => chunk.clauseTypes || []))];
  const knowledgeDocument = buildKnowledgeRecord({
    knowledgeId: SYSTEM_RULEBOOK_KNOWLEDGE_ID,
    title: 'System Rulebook Benchmark',
    source: 'system-rulebook',
    originalName: 'rulebook.json',
    metadata: {
      sourceType: 'rulebook',
      documentType: 'rulebook',
      version: 'system-v1',
      status: 'active',
      tags: ['system-rulebook'],
    },
    chunkCount: chunks.length,
    clauseTypes,
  });

  const vectorRecords = await buildKnowledgeVectorRecords(knowledgeDocument, chunks);

  await saveKnowledgeBundle({
    knowledgeDocument,
    chunks,
  });
  const vectorIndex = await upsertClauseVectors(vectorRecords, {
    namespace: env.pineconeKnowledgeNamespace,
  });

  return {
    knowledgeId: knowledgeDocument.id,
    title: knowledgeDocument.title,
    chunkCount: chunks.length,
    vectorIndex,
  };
}

async function reindexAllKnowledgeSearchIndexes() {
  ensureSearchIndexingReady();

  const knowledgeDocuments = await listKnowledgeDocuments();
  const results = [];

  for (const knowledgeDocument of knowledgeDocuments) {
    if (knowledgeDocument.id === SYSTEM_RULEBOOK_KNOWLEDGE_ID) {
      continue;
    }

    const bundle = await getKnowledgeDocumentById(knowledgeDocument.id);
    const vectorRecords = await buildKnowledgeVectorRecords(
      bundle.knowledgeDocument,
      bundle.chunks || [],
    );
    const vectorIndex = vectorRecords.length
      ? await upsertClauseVectors(vectorRecords, {
        namespace: env.pineconeKnowledgeNamespace,
      })
      : null;

    results.push({
      knowledgeId: knowledgeDocument.id,
      title: bundle.knowledgeDocument?.title || '',
      vectorCount: vectorRecords.length,
      vectorIndex,
    });
  }

  return {
    documentCount: results.length,
    vectorCount: results.reduce((sum, item) => sum + (item.vectorCount || 0), 0),
    results,
  };
}

async function syncSearchIndexes() {
  if (activeSyncPromise) {
    return activeSyncPromise;
  }

  activeSyncPromise = (async () => {
    const rulebook = await ensureRulebookKnowledgeIndexed();
    const [contracts, precedents, knowledge] = await Promise.all([
      reindexAllContractSearchIndexes(),
      reindexAllPrecedentSearchIndexes(),
      reindexAllKnowledgeSearchIndexes(),
    ]);

    return {
      completedAt: new Date().toISOString(),
      rulebook,
      contracts,
      precedents,
      knowledge,
    };
  })()
    .finally(() => {
      activeSyncPromise = null;
    });

  return activeSyncPromise;
}

module.exports = {
  SYSTEM_RULEBOOK_KNOWLEDGE_ID,
  ensureRulebookKnowledgeIndexed,
  reindexContractSearchIndex,
  syncSearchIndexes,
};

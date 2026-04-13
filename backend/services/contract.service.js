const { v4: uuidv4 } = require('uuid');

const { env } = require('../config/env');
const AppError = require('../errors/AppError');
const { uploadRawDocument, uploadExtractedText, deleteStoredArtifacts } = require('./storage.service');
const { extractTextFromDocument } = require('./documentExtraction.service');
const { analyzeContractText } = require('./mlAnalysis.service');
const { embedText, embedTexts } = require('./embedding.service');
const {
  deleteContractBundle,
  saveContractBundle,
  saveContractOverviewInsights,
  listContracts,
  getContractById,
} = require('./contract.repository');
const { deleteClauseVectorsForContract, upsertClauseVectors } = require('./vector.service');
const { generateContractOverview, generateClauseInsight, generateBatchClauseInsights } = require('./insight.service');
const {
  findComparableContractMatchesForClause,
  findPrecedentMatchesForClause,
} = require('./precedent.service');
const { findRelevantKnowledge } = require('./knowledge.service');
const { markProcessedSource } = require('./connectorState.service');
const { deleteNotificationsByContractId } = require('./notification.repository');
const {
  buildClauseRecords,
  buildContractMetadata,
  buildContractRecord,
  buildRiskRecords,
} = require('./contract.helpers');

async function createVectorRecords(contract, clauses) {
  const embeddings = await embedTexts(
    clauses.map((clause) => ({
      text: clause.clauseTextFull || clause.clauseText,
      title: `${contract.title} ${clause.clauseLabel || clause.clauseType || 'clause'}`.trim(),
      taskType: 'RETRIEVAL_DOCUMENT',
    })),
  );

  return clauses.map((clause, index) => ({
    id: clause.id,
    namespace: env.pineconeContractNamespace,
    values: embeddings[index].values,
    metadata: {
      corpusType: 'contract_clause',
      contractId: contract.id,
      contractTitle: contract.title,
      clauseId: clause.id,
      clauseType: clause.clauseType,
      riskLabel: clause.riskLabel,
      clauseText: clause.clauseText,
      clauseTextSummary: clause.clauseTextSummary || clause.clauseText,
      clauseTextFull: clause.clauseTextFull || clause.clauseText,
      position: clause.position,
      sourceType: 'contract',
      embeddingProvider: embeddings[index].provider,
      embeddingModel: embeddings[index].model,
      embeddingTaskType: embeddings[index].taskType,
    },
  }));
}

function buildCurrentClauseContext(contract, clause) {
  return {
    contractId: contract.id,
    contractTitle: contract.title,
    clauseId: clause.id,
    clauseType: clause.clauseType,
    riskLabel: clause.riskLabel,
    clauseText: clause.clauseText,
    clauseTextSummary: clause.clauseTextSummary || clause.clauseText,
    clauseTextFull: clause.clauseTextFull || clause.clauseText,
    position: clause.position || null,
  };
}

async function buildClauseReviewContext(contract, clause) {
  const searchText = clause.clauseTextFull || clause.clauseText || '';
  let retrievalVector = null;

  if (searchText) {
    try {
      retrievalVector = (await embedText(searchText, {
        taskType: 'RETRIEVAL_QUERY',
      })).values;
    } catch (error) {
      console.warn('Clause retrieval embedding failed, continuing without shared embedding cache:', error.message);
    }
  }

  const [precedentMatches, comparisonMatches, ruleMatches] = await Promise.all([
    findPrecedentMatchesForClause({ clause, topK: 3, vector: retrievalVector, queryText: searchText }),
    findComparableContractMatchesForClause({ clause, topK: 3, vector: retrievalVector, queryText: searchText }),
    findRelevantKnowledge({ clause, topK: 4, vector: retrievalVector, queryText: searchText }),
  ]);
  const effectiveMatches = precedentMatches.length ? precedentMatches : comparisonMatches;

  return {
    currentClause: buildCurrentClauseContext(contract, clause),
    precedentMatches: effectiveMatches,
    precedentClause: effectiveMatches[0] || null,
    ruleMatches,
  };
}

async function buildAutomaticClauseInsights(contract, clauses = []) {
  const targets = clauses
    .filter((clause) => clause.riskLabel === 'high')
    .slice(0, 5);

  if (targets.length === 0) {
    return [];
  }

  // Build review contexts for all targets
  const reviewContexts = await Promise.all(
    targets.map((clause) => buildClauseReviewContext(contract, clause))
  );

  // Use batch generation for efficiency
  return await generateBatchClauseInsights(targets, reviewContexts);
}

function isReusableGeminiOverview(insights) {
  return Boolean(
    insights
      && insights.provider === 'gemini'
      && !insights.degraded,
  );
}

function getCachedContractOverview(contract = {}) {
  const overview = contract.cachedInsights?.overview;

  return isReusableGeminiOverview(overview) ? overview : null;
}

function describeArtifactStorage(artifact, label) {
  if (artifact.mode === 'disabled') {
    return `${label} storage disabled.`;
  }

  return `Stored via ${artifact.mode}.`;
}

async function ingestManualContract(file, options = {}) {
  if (!file) {
    throw new AppError(400, 'A contract file is required.');
  }

  const contractId = `contract_${uuidv4()}`;
  const source = options.source || 'manual-upload';
  const sourceContext = {
    externalId: options.externalId || file.externalId || '',
    sourceUrl: options.sourceUrl || file.sourceUrl || '',
    folderId: options.folderId || file.folderId || '',
    modifiedTime: options.modifiedTime || file.modifiedTime || null,
    dedupeKey: options.dedupeKey || file.dedupeKey || '',
    messageId: options.messageId || file.messageId || '',
    attachmentId: options.attachmentId || file.attachmentId || '',
  };

  const rawDocument = await uploadRawDocument({ contractId, file, source });
  const extracted = await extractTextFromDocument(file);
  const extractedTextAsset = await uploadExtractedText({
    contractId,
    text: extracted.text,
    source,
  });

  const analysis = await analyzeContractText(extracted.text);
  const metadata = buildContractMetadata({
    originalName: file.originalname,
    mimetype: file.mimetype,
    source,
    text: extracted.text,
    analysis,
  });

  const clauses = buildClauseRecords({
    contractId,
    clauses: analysis.clauses,
  });

  const risks = buildRiskRecords({
    contractId,
    clauses,
  });

  const pipeline = [
    {
      key: 'storage',
      label: 'Raw document storage',
      status: 'completed',
      detail: describeArtifactStorage(rawDocument, 'Raw document'),
    },
    {
      key: 'extraction',
      label: 'OCR and parsing',
      status: 'completed',
      detail: `Text extracted using ${extracted.method}.`,
    },
    {
      key: 'ml',
      label: 'Python multi-layer model',
      status: 'completed',
      detail: `Analysis source: ${analysis.source}.`,
    },
  ];

  const contract = buildContractRecord({
    contractId,
    metadata,
    source,
    sourceContext,
    extractedText: extracted.text,
    artifacts: {
      rawDocument,
      extractedText: extractedTextAsset,
    },
    pipeline,
  });

  const clauseInsights = await buildAutomaticClauseInsights(contract, clauses);
  const insights = await generateContractOverview({
    contract,
    clauses,
    risks,
    clauseInsights,
  });

  if (isReusableGeminiOverview(insights)) {
    contract.cachedInsights = {
      ...(contract.cachedInsights || {}),
      overview: insights,
      generatedAt: new Date().toISOString(),
      provider: insights.provider,
      degraded: false,
    };
  }

  const vectorRecords = await createVectorRecords(contract, clauses);
  const vectorIndex = await upsertClauseVectors(vectorRecords, {
    namespace: env.pineconeContractNamespace,
  });

  pipeline.push(
    {
      key: 'firestore',
      label: 'Structured contract store',
      status: 'completed',
      detail: 'Saving structured contract bundle.',
    },
    {
      key: 'vector',
      label: 'Semantic clause index',
      status: 'completed',
      detail: `Indexed ${vectorIndex.count} clause vectors via ${vectorIndex.mode}.`,
    },
  );
  const persistence = await saveContractBundle({
    contract,
    clauses,
    risks,
  });
  pipeline[pipeline.length - 2].detail = `Saved via ${persistence.mode}.`;

  return {
    contract,
    clauses,
    risks,
    insights,
    diagnostics: {
      extraction: extracted,
      analysisSource: analysis.source,
      persistence,
      vectorIndex,
    },
  };
}

async function listContractSummaries() {
  return listContracts();
}

async function getContractDetails(contractId) {
  return getContractById(contractId);
}

async function buildContractInsights(contractId, clauseId) {
  const contractBundle = await getContractById(contractId);

  if (!clauseId) {
    const cachedOverview = getCachedContractOverview(contractBundle.contract);

    if (cachedOverview) {
      return cachedOverview;
    }

    const clauseInsights = await buildAutomaticClauseInsights(
      contractBundle.contract,
      contractBundle.clauses,
    );
    const overview = await generateContractOverview({
      ...contractBundle,
      clauseInsights,
    });

    if (isReusableGeminiOverview(overview)) {
      await saveContractOverviewInsights(contractId, overview);
    }

    return overview;
  }

  const clause = contractBundle.clauses.find((item) => item.id === clauseId);

  if (!clause) {
    throw new AppError(404, `Clause not found: ${clauseId}`);
  }

  const reviewContext = await buildClauseReviewContext(contractBundle.contract, clause);

  return await generateClauseInsight(clause, reviewContext);
}

async function deleteContractRecord(contractId) {
  const bundle = await getContractById(contractId);
  const persistence = await deleteContractBundle(contractId);
  const sourceContext = bundle.contract.sourceContext || {};
  const cleanupTasks = [
    deleteClauseVectorsForContract(contractId, {
      namespace: env.pineconeContractNamespace,
    }),
    deleteStoredArtifacts(bundle.contract.artifacts || {}),
    deleteNotificationsByContractId(contractId),
  ];

  if (sourceContext.dedupeKey) {
    cleanupTasks.push(markProcessedSource(sourceContext.dedupeKey, {
      connector: bundle.contract.source,
      contractId: null,
      deletedContractId: contractId,
      deletedAt: new Date().toISOString(),
      externalId: sourceContext.externalId || '',
      messageId: sourceContext.messageId || '',
      attachmentId: sourceContext.attachmentId || '',
      folderId: sourceContext.folderId || '',
      modifiedTime: sourceContext.modifiedTime || null,
      status: 'deleted',
    }));
  }

  const cleanupResults = await Promise.allSettled(cleanupTasks);
  const warnings = cleanupResults
    .filter((result) => result.status === 'rejected')
    .map((result) => result.reason?.message || 'Unknown cleanup error');

  if (warnings.length) {
    console.warn(`Contract ${contractId} deleted with cleanup warnings:`, warnings.join(' | '));
  }

  return {
    contractId,
    deleted: true,
    warnings,
    diagnostics: {
      persistence,
      cleanup: cleanupResults.map((result) => (
        result.status === 'fulfilled'
          ? result.value
          : {
            status: 'failed',
            reason: result.reason?.message || 'Unknown cleanup error',
          }
      )),
    },
  };
}

module.exports = {
  buildContractInsights,
  createVectorRecords,
  deleteContractRecord,
  getContractDetails,
  ingestManualContract,
  listContractSummaries,
};

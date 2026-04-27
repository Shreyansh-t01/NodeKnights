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
  listContracts,
  getContractById,
} = require('./contract.repository');
const {
  deleteClauseVectorsForContract,
  upsertClauseVectors,
  usesPineconeIntegratedText,
} = require('./vector.service');
const {
  CONTRACT_INSIGHT_PROMPT_VERSION,
  buildClauseInsightContextRecord,
  buildGeminiFailureInfo,
  generateContractInsightBundle,
} = require('./insight.service');
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

const INSIGHT_STATUS = Object.freeze({
  NOT_REQUESTED: 'not_requested',
  GENERATING: 'generating',
  READY: 'ready',
  FAILED: 'failed',
});

const pendingContractInsightGenerationRequests = new Map();

function createVectorMetadata(contract, clause, embedding = null) {
  return {
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
    embeddingProvider: embedding?.provider || 'pinecone-integrated',
    embeddingModel: embedding?.model || env.pineconeIntegratedModel || 'pinecone-hosted',
    embeddingTaskType: embedding?.taskType || 'RETRIEVAL_DOCUMENT',
  };
}

async function createVectorRecords(contract, clauses) {
  if (usesPineconeIntegratedText()) {
    return clauses.map((clause) => ({
      id: clause.id,
      namespace: env.pineconeContractNamespace,
      text: clause.clauseTextFull || clause.clauseText,
      metadata: createVectorMetadata(contract, clause),
    }));
  }

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
    metadata: createVectorMetadata(contract, clause, embeddings[index]),
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

async function buildClauseReviewContextWithVector(contract, clause, precomputedVector = null) {
  const searchText = clause.clauseTextFull || clause.clauseText || '';
  let retrievalVector = precomputedVector;

  if (!retrievalVector && searchText && !usesPineconeIntegratedText()) {
    try {
      retrievalVector = (await embedText(searchText, {
        taskType: 'RETRIEVAL_QUERY',
      })).values;
    } catch (error) {
      console.warn('Clause retrieval embedding failed, continuing without shared embedding cache:', error.message);
    }
  }

  const [precedentMatches, ruleMatches] = await Promise.all([
    findPrecedentMatchesForClause({ clause, topK: 3, vector: retrievalVector, queryText: searchText }),
    findRelevantKnowledge({ clause, topK: 4, vector: retrievalVector, queryText: searchText }),
  ]);

  const comparisonMatches = precedentMatches.length
    ? []
    : await findComparableContractMatchesForClause({
      clause,
      topK: 3,
      vector: retrievalVector,
      queryText: searchText,
    });
  const effectiveMatches = precedentMatches.length ? precedentMatches : comparisonMatches;

  return {
    currentClause: buildCurrentClauseContext(contract, clause),
    precedentMatches: effectiveMatches,
    precedentClause: effectiveMatches[0] || null,
    ruleMatches,
  };
}

async function buildClauseReviewContexts(contract, clauses = []) {
  if (!clauses.length) {
    return [];
  }

  const retrievalVectorByClauseId = new Map();

  if (!usesPineconeIntegratedText()) {
    const embeddingTargets = clauses
      .map((clause) => ({
        clauseId: clause.id,
        searchText: clause.clauseTextFull || clause.clauseText || '',
      }))
      .filter((entry) => entry.searchText);

    if (embeddingTargets.length) {
      try {
        const embeddings = await embedTexts(
          embeddingTargets.map((entry) => ({
            text: entry.searchText,
            taskType: 'RETRIEVAL_QUERY',
          })),
        );

        embeddingTargets.forEach((entry, index) => {
          retrievalVectorByClauseId.set(entry.clauseId, embeddings[index]?.values || null);
        });
      } catch (error) {
        console.warn('Batch clause retrieval embedding failed, continuing with per-clause retrieval:', error.message);
      }
    }
  }

  return Promise.all(
    clauses.map((clause) => buildClauseReviewContextWithVector(
      contract,
      clause,
      retrievalVectorByClauseId.get(clause.id) || null,
    )),
  );
}

function findPipelineStepIndex(contract = {}, key = '') {
  return Array.isArray(contract.pipeline)
    ? contract.pipeline.findIndex((step) => step.key === key)
    : -1;
}

function upsertPipelineStep(contract = {}, step = {}) {
  const pipeline = Array.isArray(contract.pipeline) ? [...contract.pipeline] : [];
  const stepPayload = {
    key: step.key,
    label: step.label,
    status: step.status,
    detail: step.detail,
  };
  const existingIndex = findPipelineStepIndex(contract, step.key);

  if (existingIndex === -1) {
    pipeline.push(stepPayload);
  } else {
    pipeline[existingIndex] = {
      ...pipeline[existingIndex],
      ...stepPayload,
    };
  }

  contract.pipeline = pipeline;
  return contract;
}

function createDefaultStoredInsightBundle() {
  return {
    status: INSIGHT_STATUS.NOT_REQUESTED,
    requestedAt: null,
    generatedAt: null,
    failedAt: null,
    lastError: null,
    provider: null,
    promptVersion: CONTRACT_INSIGHT_PROMPT_VERSION,
    selectedClauseIds: [],
    overview: null,
    clauseInsights: {},
  };
}

function normalizeStoredInsightBundle(bundle = null) {
  if (!bundle || typeof bundle !== 'object') {
    return createDefaultStoredInsightBundle();
  }

  const normalizedStatus = Object.values(INSIGHT_STATUS).includes(bundle.status)
    ? bundle.status
    : INSIGHT_STATUS.NOT_REQUESTED;
  const promptVersion = typeof bundle.promptVersion === 'string' ? bundle.promptVersion.trim() : '';

  if (promptVersion !== CONTRACT_INSIGHT_PROMPT_VERSION) {
    return createDefaultStoredInsightBundle();
  }

  return {
    ...createDefaultStoredInsightBundle(),
    ...bundle,
    status: normalizedStatus,
    promptVersion: CONTRACT_INSIGHT_PROMPT_VERSION,
    selectedClauseIds: Array.isArray(bundle.selectedClauseIds) ? bundle.selectedClauseIds : [],
    overview: bundle.overview && typeof bundle.overview === 'object' ? bundle.overview : null,
    clauseInsights: bundle.clauseInsights && typeof bundle.clauseInsights === 'object' ? bundle.clauseInsights : {},
    lastError: bundle.lastError || null,
  };
}

function getStoredInsightBundle(contract = {}) {
  return normalizeStoredInsightBundle(contract.cachedInsights?.contractInsights);
}

function mapInsightStatusToPipelineStatus(status = INSIGHT_STATUS.NOT_REQUESTED) {
  switch (status) {
    case INSIGHT_STATUS.READY:
      return 'completed';
    case INSIGHT_STATUS.FAILED:
      return 'warning';
    case INSIGHT_STATUS.GENERATING:
      return 'pending';
    case INSIGHT_STATUS.NOT_REQUESTED:
    default:
      return 'pending';
  }
}

function buildPipelineInsightDetail(status = INSIGHT_STATUS.NOT_REQUESTED) {
  switch (status) {
    case INSIGHT_STATUS.GENERATING:
      return 'Generating grounded insights for high-risk clauses...';
    case INSIGHT_STATUS.READY:
      return 'Insights are cached and ready for review.';
    case INSIGHT_STATUS.FAILED:
      return 'AI wording is unavailable right now, but retrieved legal context is still available.';
    case INSIGHT_STATUS.NOT_REQUESTED:
    default:
      return 'Insights have not been generated yet for this contract.';
  }
}

function applyStoredInsightBundle(contract = {}, insightBundle, options = {}) {
  const normalizedBundle = normalizeStoredInsightBundle(insightBundle);
  const persist = options.persist !== false;
  const touch = options.touch !== false;

  if (persist) {
    contract.cachedInsights = {
      ...(contract.cachedInsights || {}),
      contractInsights: normalizedBundle,
    };
  }

  contract.insightState = {
    status: normalizedBundle.status,
    requestedAt: normalizedBundle.requestedAt,
    generatedAt: normalizedBundle.generatedAt,
    failedAt: normalizedBundle.failedAt,
    lastError: normalizedBundle.lastError || null,
  };

  upsertPipelineStep(contract, {
    key: 'insights',
    label: 'On-demand insights',
    status: mapInsightStatusToPipelineStatus(normalizedBundle.status),
    detail: buildPipelineInsightDetail(normalizedBundle.status),
  });

  if (touch) {
    contract.updatedAt = new Date().toISOString();
  }

  return contract;
}

function buildHighRiskClauseSummary(clause = {}) {
  return {
    clauseId: clause.id,
    clauseLabel: clause.clauseLabel || clause.clauseType || 'Clause',
    clauseType: clause.clauseType || 'other',
    riskLabel: clause.riskLabel || 'high',
    riskScore: clause.riskScore ?? null,
    clauseText: clause.clauseTextFull || clause.clauseTextSummary || clause.clauseText || '',
    clausePreview: clause.clauseTextSummary || clause.clauseText || '',
    extractedValues: clause.extractedValues || {},
    position: clause.position ?? null,
  };
}

function selectHighRiskClauses(clauses = []) {
  return clauses
    .filter((clause) => clause.riskLabel === 'high')
    .sort((left, right) => (left.position || 0) - (right.position || 0));
}

function buildDefaultWorkspaceHeadline(contract = {}) {
  return `${contract.title || 'Contract'} is ready for review.`;
}

function buildDefaultWorkspaceSummary(status = INSIGHT_STATUS.NOT_REQUESTED) {
  switch (status) {
    case INSIGHT_STATUS.GENERATING:
      return 'Generating grounded insights for high-risk clauses...';
    case INSIGHT_STATUS.FAILED:
      return 'AI wording is unavailable right now, but review context is still available.';
    case INSIGHT_STATUS.READY:
      return 'Insights are available for this contract.';
    case INSIGHT_STATUS.NOT_REQUESTED:
    default:
      return 'Insights have not been generated yet for this contract.';
  }
}

function buildDefaultWorkspaceNextSteps(status = INSIGHT_STATUS.NOT_REQUESTED, highRiskClauses = []) {
  const hasHighRiskClauses = highRiskClauses.length > 0;

  switch (status) {
    case INSIGHT_STATUS.GENERATING:
      return [
        'Keep reviewing the clause board while the insight request completes.',
        'Focus first on the highest-risk clauses listed below.',
        'Refresh is not required; the saved result will be reused after generation finishes.',
      ];
    case INSIGHT_STATUS.FAILED:
      return [
        'Use the retrieved precedent and rulebook context below to continue review.',
        'Compare the flagged clause language with the strongest benchmark match.',
        'Retry insight generation later if you need AI-written wording.',
      ];
    case INSIGHT_STATUS.READY:
      return [
        'Review the clause-level explanations against the source language.',
        'Use the precedent and rulebook context to validate the suggested redraft direction.',
        'Finalize redlines for the highlighted high-risk clauses before approval.',
      ];
    case INSIGHT_STATUS.NOT_REQUESTED:
    default:
      return hasHighRiskClauses
        ? [
          'Review the flagged high-risk clauses listed below.',
          'Generate insights when you want AI-written explanation and redraft guidance.',
          'Use semantic search or manual review in the meantime.',
        ]
        : [
          'Review the clause board for any business-specific concerns.',
          'Use semantic search to inspect similar language across indexed contracts.',
          'Generate insights later if high-risk clauses appear after re-analysis.',
        ];
  }
}

function buildWorkspaceTopRiskItems(risks = []) {
  return risks.slice(0, 5).map((risk) => risk.title);
}

function buildContractInsightsWorkspace(contractBundle) {
  const storedBundle = getStoredInsightBundle(contractBundle.contract);
  const highRiskClauses = selectHighRiskClauses(contractBundle.clauses).map(buildHighRiskClauseSummary);
  const clauseInsights = storedBundle.selectedClauseIds
    .map((clauseId) => storedBundle.clauseInsights?.[clauseId])
    .filter(Boolean);

  return {
    status: storedBundle.status,
    requestedAt: storedBundle.requestedAt,
    generatedAt: storedBundle.generatedAt,
    failedAt: storedBundle.failedAt,
    lastError: storedBundle.lastError || null,
    provider: storedBundle.provider || null,
    promptVersion: storedBundle.promptVersion,
    selectedClauseIds: storedBundle.selectedClauseIds,
    eligibleForGeneration: highRiskClauses.length > 0,
    headline: storedBundle.overview?.headline || buildDefaultWorkspaceHeadline(contractBundle.contract),
    summary: storedBundle.overview?.summary || buildDefaultWorkspaceSummary(storedBundle.status),
    nextSteps: Array.isArray(storedBundle.overview?.nextSteps) && storedBundle.overview.nextSteps.length
      ? storedBundle.overview.nextSteps
      : buildDefaultWorkspaceNextSteps(storedBundle.status, highRiskClauses),
    topRiskItems: buildWorkspaceTopRiskItems(contractBundle.risks),
    highRiskClauses,
    clauseInsights,
  };
}

function buildContractInsightsResponse(contractBundle) {
  return {
    contract: contractBundle.contract,
    clauses: contractBundle.clauses,
    risks: contractBundle.risks,
    insights: buildContractInsightsWorkspace(contractBundle),
  };
}

function hasReadyStoredInsightBundle(bundle = null) {
  const normalizedBundle = normalizeStoredInsightBundle(bundle);

  if (normalizedBundle.status !== INSIGHT_STATUS.READY || !normalizedBundle.overview) {
    return false;
  }

  return normalizedBundle.selectedClauseIds.every((clauseId) => {
    const clauseInsight = normalizedBundle.clauseInsights?.[clauseId];
    return Boolean(
      clauseInsight
        && clauseInsight.whyItIsRisky
        && clauseInsight.comparison
        && clauseInsight.recommendedChange,
    );
  });
}

async function persistContractBundle(contractBundle) {
  await saveContractBundle(contractBundle);
  return contractBundle;
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

  applyStoredInsightBundle(contract, createDefaultStoredInsightBundle());

  const persistence = await saveContractBundle({
    contract,
    clauses,
    risks,
  });

  pipeline.push({
    key: 'firestore',
    label: 'Structured contract store',
    status: 'completed',
    detail: `Saved via ${persistence.mode}.`,
  });

  const warnings = [];
  let vectorIndex = {
    mode: 'skipped',
    count: 0,
  };

  try {
    const vectorRecords = await createVectorRecords(contract, clauses);
    vectorIndex = await upsertClauseVectors(vectorRecords, {
      namespace: env.pineconeContractNamespace,
    });
    pipeline.push({
      key: 'vector',
      label: 'Semantic clause index',
      status: 'completed',
      detail: `Indexed ${vectorIndex.count} clause vectors via ${vectorIndex.mode}.`,
    });
  } catch (error) {
    warnings.push({
      key: 'vector',
      message: error.message,
    });
    vectorIndex = {
      mode: 'warning',
      count: 0,
      error: error.message,
    };
    pipeline.push({
      key: 'vector',
      label: 'Semantic clause index',
      status: 'warning',
      detail: `Contract saved, but semantic indexing is not ready yet. ${error.message}`,
    });
  }

  try {
    await saveContractBundle({
      contract,
      clauses,
      risks,
    });
  } catch (error) {
    warnings.push({
      key: 'contract-enrichment',
      message: error.message,
    });
    console.warn(`Contract ${contractId} enrichment state could not be persisted after initial save:`, error.message);
  }

  const responseBundle = {
    contract,
    clauses,
    risks,
  };

  return {
    ...buildContractInsightsResponse(responseBundle),
    warnings,
    diagnostics: {
      extraction: extracted,
      analysisSource: analysis.source,
      persistence,
      vectorIndex,
      insightStatus: contract.insightState,
    },
  };
}

function normalizeContractForRead(contract = {}) {
  applyStoredInsightBundle(contract, getStoredInsightBundle(contract), {
    persist: false,
    touch: false,
  });
  return contract;
}

async function listContractSummaries() {
  return (await listContracts()).map((contract) => normalizeContractForRead(contract));
}

async function getContractDetails(contractId) {
  const contractBundle = await getContractById(contractId);
  normalizeContractForRead(contractBundle.contract);
  return contractBundle;
}

async function getContractInsights(contractId) {
  const contractBundle = await getContractDetails(contractId);
  return buildContractInsightsResponse(contractBundle);
}

async function generateContractInsightsInternal(contractId) {
  const contractBundle = await getContractById(contractId);
  const storedBundle = getStoredInsightBundle(contractBundle.contract);

  applyStoredInsightBundle(contractBundle.contract, storedBundle, {
    persist: false,
    touch: false,
  });

  if (hasReadyStoredInsightBundle(storedBundle)) {
    return buildContractInsightsResponse(contractBundle);
  }

  const targetClauses = selectHighRiskClauses(contractBundle.clauses);

  if (!targetClauses.length) {
    throw new AppError(400, 'No high-risk clauses are available for on-demand insight generation.');
  }

  const requestedAt = new Date().toISOString();
  const generatingBundle = {
    ...createDefaultStoredInsightBundle(),
    status: INSIGHT_STATUS.GENERATING,
    requestedAt,
    provider: 'gemini',
    promptVersion: CONTRACT_INSIGHT_PROMPT_VERSION,
    selectedClauseIds: targetClauses.map((clause) => clause.id),
  };

  applyStoredInsightBundle(contractBundle.contract, generatingBundle);
  await persistContractBundle(contractBundle);

  const reviewContexts = await buildClauseReviewContexts(contractBundle.contract, targetClauses);
  const clauseInsightContexts = targetClauses.reduce((accumulator, clause, index) => {
    const contextRecord = buildClauseInsightContextRecord(clause, reviewContexts[index] || {});
    accumulator[clause.id] = contextRecord;
    return accumulator;
  }, {});

  try {
    const generatedBundle = await generateContractInsightBundle({
      contract: contractBundle.contract,
      risks: contractBundle.risks,
      clauseInsights: targetClauses.map((clause) => clauseInsightContexts[clause.id]),
    });

    applyStoredInsightBundle(contractBundle.contract, {
      ...createDefaultStoredInsightBundle(),
      status: INSIGHT_STATUS.READY,
      requestedAt,
      generatedAt: new Date().toISOString(),
      provider: generatedBundle.provider,
      promptVersion: generatedBundle.promptVersion,
      selectedClauseIds: targetClauses.map((clause) => clause.id),
      overview: generatedBundle.overview,
      clauseInsights: generatedBundle.clauseInsights,
    });
  } catch (error) {
    applyStoredInsightBundle(contractBundle.contract, {
      ...createDefaultStoredInsightBundle(),
      status: INSIGHT_STATUS.FAILED,
      requestedAt,
      failedAt: new Date().toISOString(),
      provider: 'gemini',
      promptVersion: CONTRACT_INSIGHT_PROMPT_VERSION,
      selectedClauseIds: targetClauses.map((clause) => clause.id),
      lastError: buildGeminiFailureInfo(error),
      clauseInsights: clauseInsightContexts,
    });
  }

  await persistContractBundle(contractBundle);
  return buildContractInsightsResponse(contractBundle);
}

async function generateContractInsights(contractId) {
  if (pendingContractInsightGenerationRequests.has(contractId)) {
    return pendingContractInsightGenerationRequests.get(contractId);
  }

  const pendingRequest = generateContractInsightsInternal(contractId)
    .finally(() => {
      pendingContractInsightGenerationRequests.delete(contractId);
    });

  pendingContractInsightGenerationRequests.set(contractId, pendingRequest);
  return pendingRequest;
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
  createVectorRecords,
  deleteContractRecord,
  generateContractInsights,
  getContractDetails,
  getContractInsights,
  ingestManualContract,
  listContractSummaries,
};

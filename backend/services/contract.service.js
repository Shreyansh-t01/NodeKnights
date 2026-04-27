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
  saveContractCachedInsights,
  listContracts,
  getContractById,
} = require('./contract.repository');
const {
  deleteClauseVectorsForContract,
  upsertClauseVectors,
  usesPineconeIntegratedText,
} = require('./vector.service');
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

const pendingContractInsightRequests = new Map();
const queuedContractInsightRefreshes = [];
const queuedContractInsightRefreshIds = new Set();
const activeContractInsightRefreshIds = new Set();
const cancelledContractInsightRefreshIds = new Set();
const MAX_BACKGROUND_CONTRACT_INSIGHT_REFRESHES = 1;
const MAX_AUTOMATIC_CLAUSE_INSIGHTS = 3;

async function createVectorRecords(contract, clauses) {
  if (usesPineconeIntegratedText()) {
    return clauses.map((clause) => ({
      id: clause.id,
      namespace: env.pineconeContractNamespace,
      text: clause.clauseTextFull || clause.clauseText,
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
        embeddingProvider: 'pinecone-integrated',
        embeddingModel: env.pineconeIntegratedModel || 'pinecone-hosted',
        embeddingTaskType: 'RETRIEVAL_DOCUMENT',
      },
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
  return buildClauseReviewContextWithVector(contract, clause, null);
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

function buildInsightRefreshErrorSummary(error = null) {
  if (!error) {
    return null;
  }

  return {
    message: error.message || 'Insight refresh failed.',
    statusCode: error.statusCode || null,
  };
}

function updateInsightRefreshState(contract = {}, refreshStatus = 'pending', detail = '', error = null) {
  const timestamp = new Date().toISOString();
  const previousState = contract.cachedInsights?.refreshState || {};

  return {
    ...previousState,
    status: refreshStatus,
    message: detail,
    updatedAt: timestamp,
    queuedAt: refreshStatus === 'pending'
      ? timestamp
      : (previousState.queuedAt || timestamp),
    startedAt: refreshStatus === 'running'
      ? timestamp
      : (refreshStatus === 'pending' ? null : (previousState.startedAt || null)),
    completedAt: refreshStatus === 'completed'
      ? timestamp
      : (refreshStatus === 'pending' ? null : (previousState.completedAt || null)),
    failedAt: refreshStatus === 'warning'
      ? timestamp
      : (refreshStatus === 'completed' ? previousState.failedAt || null : previousState.failedAt || null),
    lastError: error ? buildInsightRefreshErrorSummary(error) : null,
  };
}

function applyInsightPipelineState(
  contract = {},
  {
    pipelineStatus = 'pending',
    detail = '',
    refreshStatus = pipelineStatus,
    error = null,
  } = {},
) {
  upsertPipelineStep(contract, {
    key: 'insights',
    label: 'AI insights',
    status: pipelineStatus,
    detail,
  });

  contract.cachedInsights = {
    ...(contract.cachedInsights || {}),
    refreshState: updateInsightRefreshState(contract, refreshStatus, detail, error),
  };
  contract.updatedAt = new Date().toISOString();

  return contract;
}

function isInsightRefreshPending(contract = {}) {
  return ['pending', 'running'].includes(contract.cachedInsights?.refreshState?.status || '');
}

function hasReusableCachedInsightData(contract = {}) {
  return Object.values(contract.cachedInsights?.clauses || {}).some(isReusableGeminiClauseInsight);
}

function getInsightPendingMessage(reason = '') {
  const suffix = reason ? ` ${reason}` : '';
  return `AI insights are being generated in the background. The contract is ready for review now, and Gemini-backed clause insights will appear after refresh.${suffix}`.trim();
}

function getInsightRefreshingMessage() {
  return 'AI insights are available and are being refreshed in the background.';
}

function getInsightStaleReuseMessage() {
  return 'AI insights are available. The latest Gemini refresh hit a temporary limit, so Lexora kept the last successful insight set where possible.';
}

function buildInsightPendingOverview(contract, options = {}) {
  const summary = options.summary || getInsightPendingMessage();
  const cachedOverview = getCachedContractOverview(contract);

  if (cachedOverview) {
    return {
      ...cachedOverview,
      summary: `${cachedOverview.summary} ${summary}`.trim(),
      pending: true,
    };
  }

  return {
    headline: `${contract?.title || 'Contract'} is ready for review.`,
    summary,
    topRiskItems: [],
    nextSteps: [
      'Review the extracted clause board from the contract card.',
      'Refresh this workspace shortly for Gemini-backed clause insights.',
      'Use semantic search or manual legal review in the meantime.',
    ],
    clauseInsights: [],
    provider: 'background-refresh-pending',
    degraded: false,
    pending: true,
    geminiError: null,
  };
}

async function buildAutomaticClauseInsights(contract, clauses = []) {
  const targets = clauses
    .filter((clause) => clause.riskLabel === 'high')
    .slice(0, MAX_AUTOMATIC_CLAUSE_INSIGHTS);

  if (targets.length === 0) {
    return [];
  }

  const cachedClauseInsights = contract.cachedInsights?.clauses || {};
  const resultsByClauseId = new Map();
  const missingTargets = [];

  targets.forEach((clause) => {
    const cachedInsight = cachedClauseInsights[clause.id];

    if (isReusableGeminiClauseInsight(cachedInsight)) {
      resultsByClauseId.set(clause.id, cachedInsight);
    } else {
      missingTargets.push(clause);
    }
  });

  if (missingTargets.length) {
    const reviewContexts = await buildClauseReviewContexts(contract, missingTargets);
    const generatedInsights = await generateBatchClauseInsights(missingTargets, reviewContexts);

    generatedInsights.forEach((insight, index) => {
      resultsByClauseId.set(missingTargets[index].id, insight);
    });
  }

  return targets
    .map((clause) => resultsByClauseId.get(clause.id))
    .filter(Boolean);
}

function isReusableOverview(insights) {
  return Boolean(
    insights
      && !insights.degraded
      && typeof insights.headline === 'string'
      && typeof insights.summary === 'string'
      && Array.isArray(insights.nextSteps)
  );
}

function isReusableGeminiClauseInsight(insight) {
  return Boolean(
    insight
      && insight.provider === 'gemini'
      && !insight.degraded
      && insight.clauseId,
  );
}

function getCachedContractOverview(contract = {}) {
  const overview = contract.cachedInsights?.overview;

  return isReusableOverview(overview) ? overview : null;
}

function getCachedClauseInsight(contract = {}, clauseId = '') {
  const cachedInsight = contract.cachedInsights?.clauses?.[clauseId];

  return isReusableGeminiClauseInsight(cachedInsight) ? cachedInsight : null;
}

function buildReusableClauseInsightsPatch(clauseInsights = []) {
  const clauses = clauseInsights.reduce((accumulator, insight) => {
    if (isReusableGeminiClauseInsight(insight)) {
      accumulator[insight.clauseId] = insight;
    }

    return accumulator;
  }, {});

  return Object.keys(clauses).length ? { clauses } : {};
}

function buildContractInsightCachePatch({ overview = null, clauseInsights = [] } = {}) {
  const patch = {
    ...buildReusableClauseInsightsPatch(clauseInsights),
  };

  if (isReusableOverview(overview)) {
    patch.overview = overview;
    patch.generatedAt = new Date().toISOString();
    patch.provider = overview.provider;
    patch.degraded = false;
  }

  return patch;
}

async function queueNextContractInsightRefresh() {
  if (activeContractInsightRefreshIds.size >= MAX_BACKGROUND_CONTRACT_INSIGHT_REFRESHES) {
    return;
  }

  const nextContractId = queuedContractInsightRefreshes.shift();

  if (!nextContractId) {
    return;
  }

  queuedContractInsightRefreshIds.delete(nextContractId);
  activeContractInsightRefreshIds.add(nextContractId);

  void runContractInsightRefresh(nextContractId)
    .catch((error) => {
      console.warn(`Contract insight refresh failed for ${nextContractId}:`, error.message);
    })
    .finally(() => {
      activeContractInsightRefreshIds.delete(nextContractId);
      void queueNextContractInsightRefresh();
    });
}

function scheduleContractInsightRefresh(contractId) {
  if (
    !contractId
    || cancelledContractInsightRefreshIds.has(contractId)
    || queuedContractInsightRefreshIds.has(contractId)
    || activeContractInsightRefreshIds.has(contractId)
  ) {
    return false;
  }

  queuedContractInsightRefreshIds.add(contractId);
  queuedContractInsightRefreshes.push(contractId);
  setTimeout(() => {
    void queueNextContractInsightRefresh();
  }, 0);

  return true;
}

async function persistContractBundle(contractBundle) {
  await saveContractBundle(contractBundle);
  return contractBundle;
}

async function runContractInsightRefresh(contractId) {
  let contractBundle = null;

  try {
    contractBundle = await getContractById(contractId);
  } catch (error) {
    if (error.statusCode !== 404) {
      throw error;
    }

    return;
  }

  const hadReusableInsights = hasReusableCachedInsightData(contractBundle.contract);

  try {
    if (cancelledContractInsightRefreshIds.has(contractId)) {
      return;
    }

    applyInsightPipelineState(contractBundle.contract, {
      pipelineStatus: hadReusableInsights ? 'completed' : 'pending',
      detail: hadReusableInsights ? getInsightRefreshingMessage() : getInsightPendingMessage(),
      refreshStatus: 'running',
    });
    await persistContractBundle(contractBundle);

    const clauseInsights = await buildAutomaticClauseInsights(
      contractBundle.contract,
      contractBundle.clauses,
    );
    const overview = await generateContractOverview({
      ...contractBundle,
      clauseInsights,
    });
    const cachedInsightsPatch = buildContractInsightCachePatch({
      overview,
      clauseInsights,
    });

    contractBundle.contract.cachedInsights = {
      ...(contractBundle.contract.cachedInsights || {}),
      ...cachedInsightsPatch,
    };
    if (cancelledContractInsightRefreshIds.has(contractId)) {
      return;
    }

    const refreshProducedWarning = hasGeminiInsightWarning({
      overview,
      clauseInsights,
    });
    const reusableInsightsAvailable = hasReusableCachedInsightData(contractBundle.contract);

    applyInsightPipelineState(contractBundle.contract, {
      pipelineStatus: refreshProducedWarning && !reusableInsightsAvailable ? 'warning' : 'completed',
      detail: refreshProducedWarning
        ? (
          reusableInsightsAvailable
            ? getInsightStaleReuseMessage()
            : buildInsightPipelineDetail(overview, clauseInsights)
        )
        : buildInsightPipelineDetail(overview, clauseInsights),
      refreshStatus: refreshProducedWarning ? (reusableInsightsAvailable ? 'completed' : 'warning') : 'completed',
      error: refreshProducedWarning && !reusableInsightsAvailable
        ? (
          overview?.geminiError
            || clauseInsights.find((insight) => insight?.geminiError)?.geminiError
            || null
        )
        : null,
    });
    await persistContractBundle(contractBundle);
  } catch (error) {
    if (!contractBundle) {
      throw error;
    }

    const reusableInsightsAvailable = hasReusableCachedInsightData(contractBundle.contract);

    applyInsightPipelineState(contractBundle.contract, {
      pipelineStatus: reusableInsightsAvailable ? 'completed' : 'warning',
      detail: reusableInsightsAvailable
        ? getInsightStaleReuseMessage()
        : getGeminiUnavailableMessage(error.message),
      refreshStatus: reusableInsightsAvailable ? 'completed' : 'warning',
      error,
    });

    try {
      await persistContractBundle(contractBundle);
    } catch (persistError) {
      console.warn(`Contract ${contractId} insight refresh state could not be persisted:`, persistError.message);
    }
  }
}

function getGeminiUnavailableMessage(reason = '') {
  const suffix = reason ? ` ${reason}` : '';
  return `Gemini insights are not generated yet for this contract. The contract was saved and extracted data is available for review.${suffix}`.trim();
}

function buildInsightUnavailableOverview(contract, reason = '') {
  return {
    headline: `${contract?.title || 'Contract'} is available for review.`,
    summary: getGeminiUnavailableMessage(reason),
    topRiskItems: [],
    nextSteps: [
      'Review the extracted clause board from the contract card.',
      'Retry AI insights later once Gemini becomes available.',
      'Use semantic search or manual legal review in the meantime.',
    ],
    clauseInsights: [],
    provider: 'template-fallback',
    degraded: true,
    geminiError: {
      source: 'contract-ingest',
      message: reason || 'Gemini insights were not generated during ingestion.',
      statusCode: null,
      details: null,
    },
  };
}

function hasGeminiInsightWarning({ overview = null, clauseInsights = [] } = {}) {
  return Boolean(
    (overview?.degraded && overview?.geminiError)
      || clauseInsights.some((insight) => insight?.degraded && insight?.geminiError),
  );
}

function buildInsightPipelineDetail(overview = null, clauseInsights = []) {
  if (!hasGeminiInsightWarning({ overview, clauseInsights })) {
    return 'AI insights were generated for this contract.';
  }

  const overviewMessage = overview?.geminiError?.message || '';
  const clauseMessage = clauseInsights.find((insight) => insight?.geminiError?.message)?.geminiError?.message || '';

  return getGeminiUnavailableMessage(overviewMessage || clauseMessage);
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

  let insights = buildInsightPendingOverview(contract);
  const warnings = [];

  applyInsightPipelineState(contract, {
    pipelineStatus: 'pending',
    detail: getInsightPendingMessage(),
    refreshStatus: 'pending',
  });

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
      key: 'contract-refresh',
      message: error.message,
    });
    console.warn(`Contract ${contractId} enrichment state could not be persisted after initial save:`, error.message);
  }

  scheduleContractInsightRefresh(contractId);

  return {
    contract,
    clauses,
    risks,
    insights,
    warnings,
    diagnostics: {
      extraction: extracted,
      analysisSource: analysis.source,
      persistence,
      insightStatus: {
        provider: insights?.provider || 'unknown',
        degraded: Boolean(insights?.degraded),
        geminiError: insights?.geminiError || null,
      },
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

async function buildContractInsightsInternal(contractId, clauseId) {
  const contractBundle = await getContractById(contractId);

  if (!clauseId) {
    const cachedOverview = getCachedContractOverview(contractBundle.contract);

    if (cachedOverview) {
      return cachedOverview;
    }

    if (!isInsightRefreshPending(contractBundle.contract)) {
      applyInsightPipelineState(contractBundle.contract, {
        pipelineStatus: 'pending',
        detail: getInsightPendingMessage(),
        refreshStatus: 'pending',
      });

      try {
        await persistContractBundle(contractBundle);
      } catch (error) {
        console.warn(`Contract ${contractId} pending insight state could not be persisted:`, error.message);
      }

      scheduleContractInsightRefresh(contractId);
    }

    return buildInsightPendingOverview(contractBundle.contract);
  }

  const clause = contractBundle.clauses.find((item) => item.id === clauseId);

  if (!clause) {
    throw new AppError(404, `Clause not found: ${clauseId}`);
  }

  const cachedClauseInsight = getCachedClauseInsight(contractBundle.contract, clauseId);

  if (cachedClauseInsight) {
    return cachedClauseInsight;
  }

  const reviewContext = await buildClauseReviewContext(contractBundle.contract, clause);

  const insight = await generateClauseInsight(clause, reviewContext);

  if (isReusableGeminiClauseInsight(insight)) {
    await saveContractCachedInsights(contractId, {
      clauses: {
        ...(contractBundle.contract.cachedInsights?.clauses || {}),
        [clauseId]: insight,
      },
    });
  }

  return insight;
}

async function buildContractInsights(contractId, clauseId) {
  const requestKey = `${contractId}:${clauseId || 'overview'}`;

  if (pendingContractInsightRequests.has(requestKey)) {
    return pendingContractInsightRequests.get(requestKey);
  }

  const pendingRequest = buildContractInsightsInternal(contractId, clauseId)
    .finally(() => {
      pendingContractInsightRequests.delete(requestKey);
    });

  pendingContractInsightRequests.set(requestKey, pendingRequest);
  return pendingRequest;
}

async function deleteContractRecord(contractId) {
  cancelledContractInsightRefreshIds.add(contractId);
  queuedContractInsightRefreshIds.delete(contractId);
  const queuedIndex = queuedContractInsightRefreshes.findIndex((item) => item === contractId);

  if (queuedIndex !== -1) {
    queuedContractInsightRefreshes.splice(queuedIndex, 1);
  }

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

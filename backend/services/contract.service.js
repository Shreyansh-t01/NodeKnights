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
  saveContractOverviewInsights,
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

async function buildAutomaticClauseInsights(contract, clauses = []) {
  const targets = clauses
    .filter((clause) => clause.riskLabel === 'high')
    .slice(0, 5);

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

  let clauseInsights = [];
  let insights = buildInsightUnavailableOverview(contract);
  const warnings = [];

  try {
    clauseInsights = await buildAutomaticClauseInsights(contract, clauses);
    insights = await generateContractOverview({
      contract,
      clauses,
      risks,
      clauseInsights,
    });

    const cachedInsightsPatch = buildContractInsightCachePatch({
      overview: insights,
      clauseInsights,
    });

    if (Object.keys(cachedInsightsPatch).length) {
      contract.cachedInsights = {
        ...(contract.cachedInsights || {}),
        ...cachedInsightsPatch,
      };
    }

    pipeline.push({
      key: 'insights',
      label: 'AI insights',
      status: hasGeminiInsightWarning({ overview: insights, clauseInsights }) ? 'warning' : 'completed',
      detail: buildInsightPipelineDetail(insights, clauseInsights),
    });
  } catch (error) {
    warnings.push({
      key: 'insights',
      message: error.message,
    });
    insights = buildInsightUnavailableOverview(contract, error.message);
    pipeline.push({
      key: 'insights',
      label: 'AI insights',
      status: 'warning',
      detail: getGeminiUnavailableMessage(error.message),
    });
  }

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

  contract.updatedAt = new Date().toISOString();

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

    try {
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

      if (Object.keys(cachedInsightsPatch).length) {
        await saveContractCachedInsights(contractId, cachedInsightsPatch);
      } else if (isReusableOverview(overview)) {
        await saveContractOverviewInsights(contractId, overview);
      }

      return overview;
    } catch (error) {
      console.warn(`Contract overview generation failed for ${contractId}, returning saved-contract fallback:`, error.message);
      return buildInsightUnavailableOverview(contractBundle.contract, error.message);
    }
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

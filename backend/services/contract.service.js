const { v4: uuidv4 } = require('uuid');

const { env } = require('../config/env');
const AppError = require('../errors/AppError');
const { uploadRawDocument, uploadExtractedText } = require('./storage.service');
const { extractTextFromDocument } = require('./documentExtraction.service');
const { analyzeContractText } = require('./mlAnalysis.service');
const { embedTexts } = require('./embedding.service');
const { saveContractBundle, listContracts, getContractById } = require('./contract.repository');
const { upsertClauseVectors } = require('./vector.service');
const { generateContractOverview, generateClauseInsight } = require('./insight.service');
const {
  findComparableContractMatchesForClause,
  findPrecedentMatchesForClause,
} = require('./precedent.service');
const { findRelevantKnowledge } = require('./knowledge.service');
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
  const [precedentMatches, comparisonMatches, ruleMatches] = await Promise.all([
    findPrecedentMatchesForClause({ clause, topK: 3 }),
    findComparableContractMatchesForClause({ clause, topK: 3 }),
    findRelevantKnowledge({ clause, topK: 4 }),
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

  return Promise.all(
    targets.map(async (clause) => {
      const reviewContext = await buildClauseReviewContext(contract, clause);
      return generateClauseInsight(clause, reviewContext);
    }),
  );
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

  const vectorRecords = await createVectorRecords(contract, clauses);
  const vectorIndex = await upsertClauseVectors(vectorRecords, {
    namespace: env.pineconeContractNamespace,
  });
  const persistence = await saveContractBundle({
    contract,
    clauses,
    risks,
  });

  pipeline.push(
    {
      key: 'firestore',
      label: 'Structured contract store',
      status: 'completed',
      detail: `Saved via ${persistence.mode}.`,
    },
    {
      key: 'vector',
      label: 'Semantic clause index',
      status: 'completed',
      detail: `Indexed ${vectorIndex.count} clause vectors via ${vectorIndex.mode}.`,
    },
  );

  await saveContractBundle({
    contract,
    clauses,
    risks,
  });

  const clauseInsights = await buildAutomaticClauseInsights(contract, clauses);
  const insights = await generateContractOverview({
    contract,
    clauses,
    risks,
    clauseInsights,
  });

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
    const clauseInsights = await buildAutomaticClauseInsights(
      contractBundle.contract,
      contractBundle.clauses,
    );

    return await generateContractOverview({
      ...contractBundle,
      clauseInsights,
    });
  }

  const clause = contractBundle.clauses.find((item) => item.id === clauseId);

  if (!clause) {
    throw new AppError(404, `Clause not found: ${clauseId}`);
  }

  const reviewContext = await buildClauseReviewContext(contractBundle.contract, clause);

  return await generateClauseInsight(clause, reviewContext);
}

module.exports = {
  buildContractInsights,
  createVectorRecords,
  getContractDetails,
  ingestManualContract,
  listContractSummaries,
};

const { v4: uuidv4 } = require('uuid');

const AppError = require('../errors/AppError');
const { uploadRawDocument, uploadExtractedText } = require('./storage.service');
const { extractTextFromDocument } = require('./documentExtraction.service');
const { analyzeContractText } = require('./mlAnalysis.service');
const { embedText } = require('./embedding.service');
const { saveContractBundle, listContracts, getContractById } = require('./contract.repository');
const { upsertClauseVectors, querySimilarClauses } = require('./vector.service');
const { generateContractOverview, generateClauseInsight } = require('./insight.service');
const {
  buildClauseRecords,
  buildContractMetadata,
  buildContractRecord,
  buildRiskRecords,
} = require('./contract.helpers');

async function createVectorRecords(contract, clauses) {
  return Promise.all(
    clauses.map(async (clause) => {
      const embedding = await embedText(clause.clauseText);

      return {
        id: clause.id,
        values: embedding.values,
        metadata: {
          contractId: contract.id,
          contractTitle: contract.title,
          clauseId: clause.id,
          clauseType: clause.clauseType,
          riskLabel: clause.riskLabel,
          clauseText: clause.clauseText,
          position: clause.position,
        },
      };
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
    extractedText: extracted.text,
    artifacts: {
      rawDocument,
      extractedText: extractedTextAsset,
    },
    pipeline,
  });

  const vectorRecords = await createVectorRecords(contract, clauses);
  const vectorIndex = await upsertClauseVectors(vectorRecords);
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

  const insights = await generateContractOverview({
    contract,
    clauses,
    risks,
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
    return await generateContractOverview(contractBundle);
  }

  const clause = contractBundle.clauses.find((item) => item.id === clauseId);

  if (!clause) {
    throw new AppError(404, `Clause not found: ${clauseId}`);
  }

  const embedding = await embedText(clause.clauseText);
  const matches = await querySimilarClauses({
    vector: embedding.values,
    topK: 3,
    contractId,
    queryText: clause.clauseText,
  });

  return await generateClauseInsight(clause, matches);
}

module.exports = {
  buildContractInsights,
  getContractDetails,
  ingestManualContract,
  listContractSummaries,
};

const path = require('node:path');
const { v4: uuidv4 } = require('uuid');

function formatClauseType(value = 'other') {
  return value.replace(/_/g, ' ');
}

function extractFileTitle(originalName = 'Contract') {
  return path.parse(originalName).name.replace(/[_-]+/g, ' ').trim() || 'Contract';
}

function uniqueEntityTexts(entities = [], labels = []) {
  return [...new Set(
    entities
      .filter((entity) => labels.includes(entity.label))
      .map((entity) => entity.text)
      .filter(Boolean),
  )];
}

function riskWeight(riskLabel = 'low') {
  if (riskLabel === 'high') {
    return 90;
  }

  if (riskLabel === 'medium') {
    return 60;
  }

  return 30;
}

function inferContractType(clauses = []) {
  const types = clauses.map((clause) => clause.clauseType);

  if (types.includes('payment') && types.includes('termination')) {
    return 'Commercial Services Agreement';
  }

  if (types.includes('confidentiality') && types.includes('payment')) {
    return 'Vendor Confidentiality Agreement';
  }

  if (types.includes('dispute_resolution') || types.includes('governing_law')) {
    return 'Business Contract';
  }

  return 'General Contract';
}

function summarizeRiskCounts(clauses = []) {
  return clauses.reduce((accumulator, clause) => {
    const key = clause.riskLabel || 'low';
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {
    low: 0,
    medium: 0,
    high: 0,
  });
}

function buildContractMetadata({
  originalName,
  mimetype,
  source,
  text,
  analysis,
}) {
  const clauses = analysis.clauses || [];
  const entities = analysis.entities || [];

  return {
    title: extractFileTitle(originalName),
    originalName,
    mimeType: mimetype,
    source,
    contractType: inferContractType(clauses),
    parties: uniqueEntityTexts(entities, ['ORG', 'PARTY']).slice(0, 6),
    dates: uniqueEntityTexts(entities, ['DATE']).slice(0, 6),
    durations: uniqueEntityTexts(entities, ['DURATION']).slice(0, 6),
    monetaryValues: uniqueEntityTexts(entities, ['MONEY']).slice(0, 6),
    percentages: uniqueEntityTexts(entities, ['PERCENTAGE']).slice(0, 6),
    locations: uniqueEntityTexts(entities, ['LOCATION']).slice(0, 6),
    clauseTypes: [...new Set(clauses.map((clause) => clause.clauseType).filter(Boolean))],
    riskCounts: summarizeRiskCounts(clauses),
    textLength: text.length,
    summary: analysis.summary || 'Contract processed successfully.',
  };
}

function buildClauseRecords({ contractId, clauses = [] }) {
  const createdAt = new Date().toISOString();

  return clauses.map((clause, index) => ({
    id: `clause_${uuidv4()}`,
    contractId,
    position: index + 1,
    clauseText: clause.clauseText,
    clauseType: clause.clauseType || 'other',
    clauseLabel: formatClauseType(clause.clauseType || 'other'),
    riskLabel: clause.riskLabel || 'low',
    riskScore: riskWeight(clause.riskLabel),
    extractedValues: clause.extractedValues || {},
    tags: [clause.clauseType || 'other', clause.riskLabel || 'low'],
    createdAt,
  }));
}

function buildRiskRecords({ contractId, clauses = [] }) {
  const createdAt = new Date().toISOString();

  return clauses
    .filter((clause) => clause.riskLabel === 'medium' || clause.riskLabel === 'high')
    .map((clause) => ({
      id: `risk_${uuidv4()}`,
      contractId,
      clauseId: clause.id,
      clauseType: clause.clauseType,
      severity: clause.riskLabel,
      score: clause.riskScore,
      title: `${formatClauseType(clause.clauseType)} clause requires review`,
      summary: clause.clauseText,
      createdAt,
    }));
}

function buildContractRecord({
  contractId,
  metadata,
  source,
  extractedText,
  artifacts,
  pipeline,
}) {
  const createdAt = new Date().toISOString();

  return {
    id: contractId,
    title: metadata.title,
    source,
    status: metadata.riskCounts.high > 0 ? 'review-required' : 'analysis-ready',
    metadata,
    textPreview: extractedText.slice(0, 600),
    textLength: extractedText.length,
    artifacts,
    pipeline,
    createdAt,
    updatedAt: createdAt,
  };
}

module.exports = {
  buildClauseRecords,
  buildContractMetadata,
  buildContractRecord,
  buildRiskRecords,
  summarizeRiskCounts,
  formatClauseType,
};

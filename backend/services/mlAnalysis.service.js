const AppError = require('../errors/AppError');
const { env } = require('../config/env');

const DATE_REGEX = /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/gi;
const MONEY_REGEX = /(\u20B9\s?[\d,]+|Rs\.?\s?[\d,]+|\$[\d,]+|\b\d+\s?(?:rupees|rs|usd|dollars)\b)/gi;
const DURATION_REGEX = /\b(\d+\s+(?:days?|months?|years?))\b/gi;
const PERCENTAGE_REGEX = /\b\d+(?:\.\d+)?%\b/g;

function collectMatches(regex, text, label) {
  return [...text.matchAll(regex)].map((match) => ({
    text: match[0],
    label,
    start: match.index ?? -1,
    end: (match.index ?? -1) + match[0].length,
  }));
}

function extractParties(text) {
  const parties = [];
  const betweenMatch = text.match(/between\s+(.+?)\s+and\s+(.+?)(?:,|\.|\n)/i);

  if (betweenMatch) {
    parties.push(
      { text: betweenMatch[1].trim(), label: 'PARTY', start: -1, end: -1 },
      { text: betweenMatch[2].trim(), label: 'PARTY', start: -1, end: -1 },
    );
  }

  const titleCaseMatches = text.slice(0, 500).match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\b/g) || [];

  titleCaseMatches.slice(0, 4).forEach((value) => {
    parties.push({
      text: value,
      label: 'ORG',
      start: -1,
      end: -1,
    });
  });

  return parties;
}

function splitIntoClauses(text) {
  return text
    .split(/\n{2,}|(?<=\.)\s+(?=[A-Z])/)
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .filter((item) => item.length > 40)
    .slice(0, 60);
}

function predictClauseType(clauseText) {
  const normalized = clauseText.toLowerCase();

  if (/confidential|non-disclosure|not disclose|confidential information/.test(normalized)) {
    return 'confidentiality';
  }

  if (/terminate|termination|without notice|immediately terminate/.test(normalized)) {
    return 'termination';
  }

  if (/penalty|fine|liquidated damages|financial sanction/.test(normalized)) {
    return 'penalty';
  }

  if (/dispute|arbitration|tribunal|jurisdiction|court/.test(normalized)) {
    return 'dispute_resolution';
  }

  if (/governing law|laws of india|indian law/.test(normalized)) {
    return 'governing_law';
  }

  if (/pay|payment|fee|fees|compensation|invoice/.test(normalized)) {
    return 'payment';
  }

  return 'other';
}

function predictRisk(clauseText, clauseType) {
  const normalized = clauseText.toLowerCase();

  if (
    /without notice|without prior notice|immediately|sole discretion/.test(normalized)
    || (clauseType === 'penalty' && /penalty|fine/.test(normalized))
  ) {
    return 'high';
  }

  if (
    /may terminate|subject to penalty|material breach|automatic renewal/.test(normalized)
    || clauseType === 'dispute_resolution'
  ) {
    return 'medium';
  }

  return 'low';
}

function makeShortClauseText(clauseType, clauseText) {
  const normalized = clauseText.replace(/\s+/g, ' ').trim();
  const words = normalized.split(' ');

  if (clauseType === 'payment') {
    const money = normalized.match(MONEY_REGEX)?.[0];
    return money ? `Payment obligation tied to ${money}` : 'Payment obligation';
  }

  if (clauseType === 'termination') {
    return normalized.toLowerCase().includes('without notice')
      ? 'Termination without prior notice'
      : 'Termination conditions defined';
  }

  if (clauseType === 'confidentiality') {
    return 'Confidential information handling obligations';
  }

  if (clauseType === 'dispute_resolution') {
    return 'Dispute resolution mechanism defined';
  }

  if (clauseType === 'penalty') {
    return 'Penalty exposure defined in the agreement';
  }

  return words.length > 16 ? `${words.slice(0, 16).join(' ')}...` : normalized;
}

function normalizeClauseBody(clauseText = '') {
  return String(clauseText || '').replace(/\s+/g, ' ').trim();
}

function analyzeLocally(text) {
  const entities = [
    ...collectMatches(DATE_REGEX, text, 'DATE'),
    ...collectMatches(MONEY_REGEX, text, 'MONEY'),
    ...collectMatches(DURATION_REGEX, text, 'DURATION'),
    ...collectMatches(PERCENTAGE_REGEX, text, 'PERCENTAGE'),
    ...extractParties(text),
  ];

  const clauses = splitIntoClauses(text).map((clauseText) => {
    const clauseTextFull = normalizeClauseBody(clauseText);
    const clauseType = predictClauseType(clauseText);
    const riskLabel = predictRisk(clauseText, clauseType);
    const clauseTextSummary = makeShortClauseText(clauseType, clauseTextFull);

    return {
      clauseText: clauseTextSummary,
      clauseTextFull,
      clauseTextSummary,
      clauseType,
      riskLabel,
      extractedValues: {},
    };
  });

  return {
    source: 'node-heuristic-fallback',
    entities,
    clauses: clauses.filter((clause) => clause.clauseType !== 'other' || clause.riskLabel !== 'low'),
    summary: 'Heuristic analysis completed because the Python ML service was unavailable.',
  };
}

async function analyzeWithMlService(text) {
  const response = await fetch(`${env.mlServiceUrl}/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`ML service responded with ${response.status}: ${message}`);
  }

  const payload = await response.json();

  if (!Array.isArray(payload.entities) || !Array.isArray(payload.clauses)) {
    throw new Error('ML service returned an invalid analysis payload.');
  }

  return {
    source: 'python-ml-service',
    entities: payload.entities || [],
    clauses: (payload.clauses || []).map((clause) => ({
      clauseText: clause.clause_text_summary || clause.clauseTextSummary || clause.clause_text || clause.clauseText,
      clauseTextFull: normalizeClauseBody(
        clause.clause_text_full || clause.clauseTextFull || clause.clause_text || clause.clauseText,
      ),
      clauseTextSummary: normalizeClauseBody(
        clause.clause_text_summary || clause.clauseTextSummary || clause.clause_text || clause.clauseText,
      ),
      clauseType: clause.clause_type || clause.clauseType || 'other',
      riskLabel: clause.risk_label || clause.riskLabel || 'low',
      extractedValues: clause.extracted_values || clause.extractedValues || {},
    })),
    summary: payload.summary || 'Python ML analysis completed successfully.',
  };
}

async function analyzeContractText(text) {
  try {
    return await analyzeWithMlService(text);
  } catch (error) {
    if (env.requirePythonMlService) {
      throw new AppError(
        503,
        `Python ML service is required for contract analysis. Start the ML service at ${env.mlServiceUrl} and try again.`,
        {
          target: `${env.mlServiceUrl}/analyze`,
          fallbackDisabled: true,
          originalError: error.message,
        },
      );
    }

    console.warn('ML service unavailable, using heuristic fallback:', error.message);
    return analyzeLocally(text);
  }
}

module.exports = {
  analyzeContractText,
};

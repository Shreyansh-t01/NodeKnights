const fs = require('node:fs');

const { env } = require('../config/env');
const { formatClauseType } = require('./contract.helpers');

const rulebook = JSON.parse(fs.readFileSync(env.rulebookPath, 'utf-8'));

function getRulebookEntry(clauseType = 'other') {
  return rulebook.find((entry) => entry.clauseType === clauseType)
    || rulebook.find((entry) => entry.clauseType === 'other');
}

function generateClauseInsight(clause, precedentMatches = []) {
  const rule = getRulebookEntry(clause.clauseType);
  const precedentSummary = precedentMatches.length
    ? `Found ${precedentMatches.length} similar clauses in the vector index. The closest example scored ${precedentMatches[0].score?.toFixed(2) || 'N/A'} and was tagged as ${precedentMatches[0].metadata?.riskLabel || 'unknown'} risk.`
    : 'No close precedent was available yet, so the recommendation is based on your internal rulebook context.';

  return {
    clauseId: clause.id,
    clauseType: clause.clauseType,
    riskLabel: clause.riskLabel,
    whyItIsRisky: rule.primaryConcern,
    comparison: `${precedentSummary} Benchmark: ${rule.benchmark}`,
    recommendedChange: rule.recommendedAction,
  };
}

function generateContractOverview(contractBundle) {
  const { contract, clauses, risks } = contractBundle;
  const headline = contract.metadata.riskCounts.high > 0
    ? 'Immediate legal review is recommended before approval.'
    : 'No critical blockers were detected, but a clause review is still recommended.';

  const topRiskItems = risks.slice(0, 3).map((risk) => risk.title);

  return {
    headline,
    summary: contract.metadata.summary,
    topRiskItems,
    nextSteps: [
      'Validate extracted parties, dates, and payment amounts.',
      'Review every high-risk clause against your internal playbook.',
      'Compare risky clauses with Pinecone precedent matches before redrafting.',
    ],
    clauseInsights: clauses
      .filter((clause) => clause.riskLabel !== 'low')
      .slice(0, 5)
      .map((clause) => generateClauseInsight(clause)),
  };
}

function buildSemanticAnswer({ query, matches, contract }) {
  if (!matches.length) {
    return {
      answer: 'No close semantic matches were found yet. Try a more specific clause question or ingest more precedents into Pinecone.',
      supportingMatches: [],
      recommendations: [
        'Ask about a concrete clause type such as termination, payment, or confidentiality.',
        'Index additional precedents so semantic search has more context.',
      ],
    };
  }

  const primaryMatch = matches[0];
  const clauseType = primaryMatch.metadata?.clauseType || 'other';
  const rule = getRulebookEntry(clauseType);

  return {
    answer: `The strongest match for "${query}" is a ${formatClauseType(clauseType)} clause from ${contract?.title || 'your indexed corpus'}. ${rule.primaryConcern}`,
    supportingMatches: matches.map((match) => ({
      id: match.id,
      score: match.score,
      clauseType: match.metadata?.clauseType || 'other',
      riskLabel: match.metadata?.riskLabel || 'unknown',
      clauseText: match.metadata?.clauseText || '',
    })),
    recommendations: [
      rule.recommendedAction,
      `Cross-check the ${formatClauseType(clauseType)} clause against your governing law and dispute resolution sections before final approval.`,
    ],
  };
}

module.exports = {
  buildSemanticAnswer,
  generateClauseInsight,
  generateContractOverview,
};

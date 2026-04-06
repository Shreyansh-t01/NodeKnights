const fs = require('node:fs');

const { env } = require('../config/env');
const { formatClauseType } = require('./contract.helpers');
const { generateStructuredObject, isGeminiEnabled } = require('./genAi.service');

const rulebook = JSON.parse(fs.readFileSync(env.rulebookPath, 'utf-8'));

const contractOverviewSchema = {
  type: 'object',
  properties: {
    headline: { type: 'string' },
    summary: { type: 'string' },
    nextSteps: {
      type: 'array',
      items: { type: 'string' },
    },
    clauseInsights: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          clauseId: { type: 'string' },
          whyItIsRisky: { type: 'string' },
          comparison: { type: 'string' },
          recommendedChange: { type: 'string' },
        },
        required: ['clauseId', 'whyItIsRisky', 'comparison', 'recommendedChange'],
      },
    },
  },
  required: ['headline', 'summary', 'nextSteps', 'clauseInsights'],
};

const clauseInsightSchema = {
  type: 'object',
  properties: {
    whyItIsRisky: { type: 'string' },
    comparison: { type: 'string' },
    recommendedChange: { type: 'string' },
  },
  required: ['whyItIsRisky', 'comparison', 'recommendedChange'],
};

const semanticAnswerSchema = {
  type: 'object',
  properties: {
    answer: { type: 'string' },
    recommendations: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['answer', 'recommendations'],
};

function getRulebookEntry(clauseType = 'other') {
  return rulebook.find((entry) => entry.clauseType === clauseType)
    || rulebook.find((entry) => entry.clauseType === 'other');
}

function asText(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asStringArray(value, fallback = [], maxItems = 5) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const normalized = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .slice(0, maxItems);

  return normalized.length ? normalized : fallback;
}

function serializePromptContext(value) {
  return JSON.stringify(value, null, 2);
}

function toSupportingMatches(matches = []) {
  return matches.map((match) => ({
    id: match.id,
    score: match.score,
    clauseType: match.metadata?.clauseType || 'other',
    riskLabel: match.metadata?.riskLabel || 'unknown',
    clauseText: match.metadata?.clauseText || '',
  }));
}

function toPromptMatches(matches = []) {
  return matches.slice(0, 5).map((match) => ({
    id: match.id,
    score: typeof match.score === 'number' ? Number(match.score.toFixed(4)) : null,
    clauseType: match.metadata?.clauseType || 'other',
    riskLabel: match.metadata?.riskLabel || 'unknown',
    clauseText: match.metadata?.clauseText || '',
    contractTitle: match.metadata?.contractTitle || '',
    position: match.metadata?.position || null,
  }));
}

function buildTemplateClauseInsight(clause, precedentMatches = []) {
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

function buildTemplateContractOverview(contractBundle) {
  const { contract, clauses, risks } = contractBundle;
  const headline = contract.metadata.riskCounts.high > 0
    ? 'Immediate legal review is recommended before approval.'
    : 'No critical blockers were detected, but a clause review is still recommended.';

  const topRiskItems = risks.slice(0, 3).map((risk) => risk.title);
  const automaticInsightClauses = clauses
    .filter((clause) => clause.riskLabel === 'high')
    .slice(0, 5);

  return {
    headline,
    summary: contract.metadata.summary,
    topRiskItems,
    nextSteps: [
      'Validate extracted parties, dates, and payment amounts.',
      'Review every high-risk clause against your internal playbook.',
      'Compare risky clauses with Pinecone precedent matches before redrafting.',
    ],
    clauseInsights: automaticInsightClauses.map((clause) => buildTemplateClauseInsight(clause)),
  };
}

function buildTemplateSemanticAnswer({ query, matches, contract }) {
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
    supportingMatches: toSupportingMatches(matches),
    recommendations: [
      rule.recommendedAction,
      `Cross-check the ${formatClauseType(clauseType)} clause against your governing law and dispute resolution sections before final approval.`,
    ],
  };
}

function buildContractOverviewPrompt(contractBundle, fallback) {
  const { contract, clauses, risks } = contractBundle;

  return [
    'You are a legal contract review assistant.',
    'Generate grounded, context-based, actionable insights using only the provided JSON context.',
    'Do not invent clauses, parties, obligations, money values, or legal facts that are not present in the context.',
    'Be direct and practical for a business reviewer.',
    'Return JSON only.',
    '',
    'Context:',
    serializePromptContext({
      contract: {
        id: contract.id,
        title: contract.title,
        status: contract.status,
        summary: contract.metadata.summary,
        contractType: contract.metadata.contractType,
        parties: contract.metadata.parties,
        dates: contract.metadata.dates,
        monetaryValues: contract.metadata.monetaryValues,
        clauseTypes: contract.metadata.clauseTypes,
        riskCounts: contract.metadata.riskCounts,
        textPreview: contract.textPreview,
      },
      topRisks: risks.slice(0, 5).map((risk) => ({
        title: risk.title,
        severity: risk.severity,
        summary: risk.summary,
      })),
      targetClauses: fallback.clauseInsights.map((insight) => ({
        clauseId: insight.clauseId,
        clauseType: insight.clauseType,
        riskLabel: insight.riskLabel,
        clauseText: clauses.find((clause) => clause.id === insight.clauseId)?.clauseText || '',
      })),
    }),
    '',
    'Requirements:',
    '- Keep the headline concise and action-oriented.',
    '- Make the summary useful for a reviewer deciding what to inspect next.',
    '- Provide 3 to 5 nextSteps.',
    '- Return one clauseInsights item for each provided target clause.',
    '- Each clauseInsights item must keep the same clauseId.',
  ].join('\n');
}

function buildClauseInsightPrompt(clause, precedentMatches) {
  return [
    'You are a legal contract review assistant.',
    'Review the target clause using only the clause data and precedent matches below.',
    'Do not invent facts beyond the provided context.',
    'Keep the explanation practical and actionable.',
    'Return JSON only.',
    '',
    'Context:',
    serializePromptContext({
      clause: {
        clauseId: clause.id,
        clauseType: clause.clauseType,
        riskLabel: clause.riskLabel,
        clauseText: clause.clauseText,
      },
      precedentMatches: toPromptMatches(precedentMatches),
    }),
  ].join('\n');
}

function buildSemanticAnswerPrompt({ query, matches, contract }) {
  return [
    'You are a legal contract search assistant.',
    'Answer the user query using only the retrieved matches below.',
    'Do not invent missing clauses or unsupported advice.',
    'Keep the answer concise, grounded, and actionable.',
    'Return JSON only.',
    '',
    'Context:',
    serializePromptContext({
      query,
      contract: contract
        ? {
          id: contract.id,
          title: contract.title,
          contractType: contract.metadata?.contractType || '',
          summary: contract.metadata?.summary || '',
        }
        : null,
      matches: toPromptMatches(matches),
    }),
  ].join('\n');
}

async function generateContractOverview(contractBundle) {
  const fallback = buildTemplateContractOverview(contractBundle);

  if (!isGeminiEnabled()) {
    return fallback;
  }

  try {
    const generated = await generateStructuredObject({
      prompt: buildContractOverviewPrompt(contractBundle, fallback),
      responseSchema: contractOverviewSchema,
      label: 'contract overview',
    });

    const generatedInsights = Array.isArray(generated?.clauseInsights) ? generated.clauseInsights : [];

    return {
      headline: asText(generated?.headline, fallback.headline),
      summary: asText(generated?.summary, fallback.summary),
      topRiskItems: fallback.topRiskItems,
      nextSteps: asStringArray(generated?.nextSteps, fallback.nextSteps, 5),
      clauseInsights: fallback.clauseInsights.map((fallbackInsight, index) => {
        const generatedInsight = generatedInsights.find((item) => item?.clauseId === fallbackInsight.clauseId)
          || generatedInsights[index]
          || {};

        return {
          ...fallbackInsight,
          whyItIsRisky: asText(generatedInsight?.whyItIsRisky, fallbackInsight.whyItIsRisky),
          comparison: asText(generatedInsight?.comparison, fallbackInsight.comparison),
          recommendedChange: asText(generatedInsight?.recommendedChange, fallbackInsight.recommendedChange),
        };
      }),
    };
  } catch (error) {
    console.warn('Gemini contract overview failed, using template fallback:', error.message);
    return fallback;
  }
}

async function generateClauseInsight(clause, precedentMatches = []) {
  const fallback = buildTemplateClauseInsight(clause, precedentMatches);

  if (!isGeminiEnabled()) {
    return fallback;
  }

  try {
    const generated = await generateStructuredObject({
      prompt: buildClauseInsightPrompt(clause, precedentMatches),
      responseSchema: clauseInsightSchema,
      label: 'clause insight',
    });

    return {
      ...fallback,
      whyItIsRisky: asText(generated?.whyItIsRisky, fallback.whyItIsRisky),
      comparison: asText(generated?.comparison, fallback.comparison),
      recommendedChange: asText(generated?.recommendedChange, fallback.recommendedChange),
    };
  } catch (error) {
    console.warn('Gemini clause insight failed, using template fallback:', error.message);
    return fallback;
  }
}

async function buildSemanticAnswer({ query, matches, contract }) {
  const fallback = buildTemplateSemanticAnswer({ query, matches, contract });

  if (!matches.length || !isGeminiEnabled()) {
    return fallback;
  }

  try {
    const generated = await generateStructuredObject({
      prompt: buildSemanticAnswerPrompt({ query, matches, contract }),
      responseSchema: semanticAnswerSchema,
      label: 'semantic answer',
    });

    return {
      answer: asText(generated?.answer, fallback.answer),
      supportingMatches: fallback.supportingMatches,
      recommendations: asStringArray(generated?.recommendations, fallback.recommendations, 5),
    };
  } catch (error) {
    console.warn('Gemini semantic answer failed, using template fallback:', error.message);
    return fallback;
  }
}

module.exports = {
  buildSemanticAnswer,
  generateClauseInsight,
  generateContractOverview,
};

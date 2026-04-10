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

function buildCurrentClausePayload(clause, override = {}) {
  return {
    contractId: override.contractId || clause.contractId || '',
    contractTitle: override.contractTitle || clause.contractTitle || '',
    clauseId: override.clauseId || clause.id || clause.clauseId || '',
    clauseType: override.clauseType || clause.clauseType || 'other',
    riskLabel: override.riskLabel || clause.riskLabel || 'unknown',
    clauseText: override.clauseText || clause.clauseText || '',
    clauseTextSummary: override.clauseTextSummary || clause.clauseTextSummary || clause.clauseText || '',
    clauseTextFull: override.clauseTextFull || clause.clauseTextFull || clause.clauseText || '',
    position: override.position ?? clause.position ?? null,
  };
}

function normalizePrecedentMatch(match = {}) {
  return {
    id: match.id || match.clauseId || '',
    score: typeof match.score === 'number' ? Number(match.score.toFixed(4)) : (match.score ?? null),
    precedentId: match.precedentId || match.metadata?.precedentId || '',
    title: match.title || match.metadata?.precedentTitle || match.metadata?.contractTitle || '',
    clauseId: match.clauseId || match.metadata?.clauseId || match.id || '',
    clauseType: match.clauseType || match.metadata?.clauseType || 'other',
    riskLabel: match.riskLabel || match.metadata?.riskLabel || 'unknown',
    clauseTextSummary: (
      match.clauseTextSummary
      || match.metadata?.clauseTextSummary
      || match.clauseText
      || match.metadata?.clauseText
      || ''
    ),
    clauseTextFull: (
      match.clauseTextFull
      || match.metadata?.clauseTextFull
      || match.clauseTextSummary
      || match.metadata?.clauseTextSummary
      || match.clauseText
      || match.metadata?.clauseText
      || ''
    ),
    sectionHeading: match.sectionHeading || match.metadata?.sectionHeading || '',
    contractType: match.contractType || match.metadata?.contractType || '',
    jurisdiction: match.jurisdiction || match.metadata?.jurisdiction || '',
    sourceType: match.sourceType || match.metadata?.sourceType || 'precedent',
  };
}

function normalizeRuleMatch(match = {}) {
  return {
    id: match.id || match.chunkId || '',
    score: typeof match.score === 'number' ? Number(match.score.toFixed(4)) : (match.score ?? null),
    knowledgeId: match.knowledgeId || match.metadata?.knowledgeId || '',
    title: match.title || match.metadata?.knowledgeTitle || '',
    chunkId: match.chunkId || match.metadata?.chunkId || match.id || '',
    sectionTitle: match.sectionTitle || match.metadata?.sectionTitle || '',
    sourceType: match.sourceType || match.metadata?.sourceType || 'policy',
    documentType: match.documentType || match.metadata?.documentType || 'rulebook',
    primaryClauseType: match.primaryClauseType || match.metadata?.primaryClauseType || 'other',
    clauseTypes: Array.isArray(match.clauseTypes)
      ? match.clauseTypes
      : (Array.isArray(match.metadata?.clauseTypes) ? match.metadata.clauseTypes : []),
    primaryConcern: match.primaryConcern || match.metadata?.primaryConcern || '',
    benchmark: match.benchmark || match.metadata?.benchmark || '',
    recommendedAction: match.recommendedAction || match.metadata?.recommendedAction || '',
    textSummary: match.textSummary || match.metadata?.textSummary || '',
    textFull: match.textFull || match.metadata?.textFull || '',
    organization: match.organization || match.metadata?.organization || '',
    jurisdiction: match.jurisdiction || match.metadata?.jurisdiction || '',
    league: match.league || match.metadata?.league || '',
    sport: match.sport || match.metadata?.sport || '',
    version: match.version || match.metadata?.version || '',
    status: match.status || match.metadata?.status || 'active',
  };
}

function buildRuleFallbackMatch(clauseType = 'other') {
  const rule = getRulebookEntry(clauseType);

  return {
    id: `rulebook_${rule.clauseType}`,
    score: null,
    knowledgeId: 'local-rulebook',
    title: 'Default Rulebook Benchmark',
    chunkId: `rulebook_${rule.clauseType}`,
    sectionTitle: formatClauseType(rule.clauseType),
    sourceType: 'rulebook-fallback',
    documentType: 'rulebook',
    primaryClauseType: rule.clauseType,
    clauseTypes: [rule.clauseType],
    primaryConcern: rule.primaryConcern,
    benchmark: rule.benchmark,
    recommendedAction: rule.recommendedAction,
    textSummary: rule.benchmark,
    textFull: `${rule.primaryConcern}\n${rule.benchmark}\n${rule.recommendedAction}`,
    organization: '',
    jurisdiction: '',
    league: '',
    sport: '',
    version: '',
    status: 'active',
  };
}

function ensureRuleMatches(ruleMatches = [], clauseType = 'other') {
  const normalized = ruleMatches.map(normalizeRuleMatch).filter((match) => match.id);
  return normalized.length ? normalized : [buildRuleFallbackMatch(clauseType)];
}

function toSupportingMatches(matches = []) {
  return matches.map((match) => {
    const normalized = normalizePrecedentMatch(match);

    return {
      id: normalized.id,
      score: normalized.score,
      clauseType: normalized.clauseType,
      riskLabel: normalized.riskLabel,
      clauseText: normalized.clauseTextSummary,
      clauseTextFull: normalized.clauseTextFull,
    };
  });
}

function toPromptMatches(matches = []) {
  return matches.slice(0, 5).map((match) => {
    const normalized = normalizePrecedentMatch(match);

    return {
      id: normalized.id,
      score: normalized.score,
      clauseType: normalized.clauseType,
      riskLabel: normalized.riskLabel,
      clauseTextSummary: normalized.clauseTextSummary,
      clauseTextFull: normalized.clauseTextFull,
      contractTitle: normalized.title,
      position: match.position || match.metadata?.position || null,
      sectionHeading: normalized.sectionHeading,
      contractType: normalized.contractType,
      jurisdiction: normalized.jurisdiction,
    };
  });
}

function toPromptRuleMatches(matches = []) {
  return matches.slice(0, 5).map((match) => {
    const normalized = normalizeRuleMatch(match);

    return {
      id: normalized.id,
      title: normalized.title,
      sectionTitle: normalized.sectionTitle,
      sourceType: normalized.sourceType,
      documentType: normalized.documentType,
      primaryClauseType: normalized.primaryClauseType,
      clauseTypes: normalized.clauseTypes,
      primaryConcern: normalized.primaryConcern,
      benchmark: normalized.benchmark,
      recommendedAction: normalized.recommendedAction,
      textSummary: normalized.textSummary,
      textFull: normalized.textFull,
      jurisdiction: normalized.jurisdiction,
      league: normalized.league,
      sport: normalized.sport,
    };
  });
}

function buildTemplateClauseInsight(clause, reviewContext = {}) {
  const currentClause = buildCurrentClausePayload(
    clause,
    reviewContext.currentClause || {},
  );
  const precedentMatches = (reviewContext.precedentMatches || []).map(normalizePrecedentMatch);
  const precedentClause = reviewContext.precedentClause
    ? normalizePrecedentMatch(reviewContext.precedentClause)
    : (precedentMatches[0] || null);
  const ruleMatches = ensureRuleMatches(reviewContext.ruleMatches || [], clause.clauseType);
  const topRule = ruleMatches[0];
  const fallbackRule = getRulebookEntry(clause.clauseType);

  const precedentSummary = precedentClause
    ? `Closest precedent${precedentClause.title ? ` from ${precedentClause.title}` : ''} scored ${precedentClause.score ?? 'N/A'} and uses "${precedentClause.clauseTextSummary || precedentClause.clauseTextFull}".`
    : 'No stored precedent matched closely yet, so the comparison relies on benchmark guidance.';
  const ruleSummary = topRule
    ? `Policy benchmark${topRule.title ? ` from ${topRule.title}` : ''}: ${topRule.benchmark || topRule.textSummary || topRule.primaryConcern}.`
    : `Benchmark: ${fallbackRule.benchmark}`;

  return {
    clauseId: clause.id,
    clauseType: clause.clauseType,
    riskLabel: clause.riskLabel,
    currentClause,
    precedentClause,
    precedentMatches,
    ruleMatches,
    whyItIsRisky: topRule.primaryConcern || fallbackRule.primaryConcern,
    comparison: `${precedentSummary} ${ruleSummary}`.trim(),
    recommendedChange: topRule.recommendedAction || fallbackRule.recommendedAction,
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
  const clauseInsights = Array.isArray(contractBundle.clauseInsights) && contractBundle.clauseInsights.length
    ? contractBundle.clauseInsights
    : automaticInsightClauses.map((clause) => buildTemplateClauseInsight(clause));

  return {
    headline,
    summary: contract.metadata.summary,
    topRiskItems,
    nextSteps: [
      'Validate extracted parties, dates, and payment amounts.',
      'Review every high-risk clause against the retrieved precedent bank.',
      'Check policy and rule matches before redrafting the clause.',
    ],
    clauseInsights,
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

  const primaryMatch = normalizePrecedentMatch(matches[0]);
  const clauseType = primaryMatch.clauseType || 'other';
  const rule = getRulebookEntry(clauseType);

  return {
    answer: `The strongest match for "${query}" is a ${formatClauseType(clauseType)} clause from ${contract?.title || primaryMatch.title || 'your indexed corpus'}. ${rule.primaryConcern}`,
    supportingMatches: toSupportingMatches(matches),
    recommendations: [
      rule.recommendedAction,
      `Cross-check the ${formatClauseType(clauseType)} clause against your governing law and dispute resolution sections before final approval.`,
    ],
  };
}

function buildContractOverviewPrompt(contractBundle, fallback) {
  const { contract, risks } = contractBundle;

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
        currentClause: insight.currentClause,
        precedentClause: insight.precedentClause,
        ruleMatches: toPromptRuleMatches(insight.ruleMatches || []),
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

function buildClauseInsightPrompt(clause, reviewContext = {}) {
  const currentClause = buildCurrentClausePayload(clause, reviewContext.currentClause || {});
  const precedentMatches = (reviewContext.precedentMatches || []).map(normalizePrecedentMatch);
  const ruleMatches = ensureRuleMatches(reviewContext.ruleMatches || [], clause.clauseType);

  return [
    'You are a legal contract review assistant.',
    'Review the target clause using only the clause data, precedent matches, and policy/rule matches below.',
    'Do not invent facts beyond the provided context.',
    'Keep the explanation practical and actionable.',
    'When explaining the comparison, explicitly anchor it to the precedent and benchmark guidance in the context.',
    'Return JSON only.',
    '',
    'Context:',
    serializePromptContext({
      currentClause,
      precedentMatches: toPromptMatches(precedentMatches),
      ruleMatches: toPromptRuleMatches(ruleMatches),
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

async function generateClauseInsight(clause, reviewContext = {}) {
  const fallback = buildTemplateClauseInsight(clause, reviewContext);

  if (!isGeminiEnabled()) {
    return fallback;
  }

  try {
    const generated = await generateStructuredObject({
      prompt: buildClauseInsightPrompt(clause, reviewContext),
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

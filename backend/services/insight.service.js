const fs = require('node:fs');

const AppError = require('../errors/AppError');
const { env } = require('../config/env');
const { formatClauseType } = require('./contract.helpers');
const { generateStructuredObject, isGeminiEnabled } = require('./genAi.service');

const rulebook = JSON.parse(fs.readFileSync(env.rulebookPath, 'utf-8'));

// Cache for clause insights to avoid repeated API calls
const clauseInsightCache = new Map();

const contractOverviewSchema = {
  type: 'object',
  properties: {
    headline: { type: 'string' },
    summary: { type: 'string' },
    nextSteps: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['headline', 'summary', 'nextSteps'],
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

const batchClauseInsightSchema = {
  type: 'object',
  properties: {
    insights: {
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
  required: ['insights'],
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

function trimPromptText(value, maxLength = 1200) {
  const normalized = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';

  if (!normalized || normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3).trim()}...`;
}

function buildGeminiFailureInfo(error, source = 'gemini') {
  return {
    source,
    message: error?.message || 'Gemini is unavailable.',
    statusCode: error?.statusCode || null,
    details: error?.details || null,
  };
}

function attachInsightMeta(payload, options = {}) {
  const degraded = Boolean(options.degraded);
  const provider = options.provider || (degraded ? 'template-fallback' : 'gemini');

  return {
    ...payload,
    provider,
    degraded,
    geminiError: options.geminiError || null,
  };
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
    title: match.title || match.contractTitle || match.metadata?.precedentTitle || match.metadata?.contractTitle || '',
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
  return matches.slice(0, 3).map((match) => {
    const normalized = normalizePrecedentMatch(match);

    return {
      id: normalized.id,
      score: normalized.score,
      clauseType: normalized.clauseType,
      riskLabel: normalized.riskLabel,
      clauseTextSummary: trimPromptText(normalized.clauseTextSummary, 180),
      clauseTextFull: trimPromptText(normalized.clauseTextFull, 420),
      contractTitle: normalized.title,
      position: match.position || match.metadata?.position || null,
      sectionHeading: normalized.sectionHeading,
      contractType: normalized.contractType,
      jurisdiction: normalized.jurisdiction,
    };
  });
}

function toPromptRuleMatches(matches = []) {
  return matches.slice(0, 3).map((match) => {
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
      benchmark: trimPromptText(normalized.benchmark, 240),
      recommendedAction: trimPromptText(normalized.recommendedAction, 240),
      textSummary: trimPromptText(normalized.textSummary, 200),
      textFull: trimPromptText(normalized.textFull, 420),
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
      answer: contract?.title
        ? `No close clause matches were found inside ${contract.title} for "${query}" yet. Try a more specific clause question or search for a named obligation such as termination, payment, or confidentiality.`
        : 'No close semantic matches were found yet. Try a more specific clause question or search for a named obligation such as termination, payment, or confidentiality.',
      supportingMatches: [],
      recommendations: [
        'Ask about a concrete clause type such as termination, payment, or confidentiality.',
        contract?.title
          ? 'Try wording the query around the exact obligation, notice period, payment term, or risk you want to inspect.'
          : 'Index additional contracts or precedents so semantic search has more context.',
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

function buildOverviewClauseContext(insight = {}) {
  const topRule = Array.isArray(insight.ruleMatches) ? insight.ruleMatches[0] : null;

  return {
    clauseId: insight.clauseId,
    clauseType: insight.clauseType,
    riskLabel: insight.riskLabel,
    currentClauseSummary: trimPromptText(
      insight.currentClause?.clauseTextSummary
      || insight.currentClause?.clauseText
      || '',
      180,
    ),
    bestPrecedentSummary: trimPromptText(
      insight.precedentClause?.clauseTextSummary
      || insight.precedentClause?.clauseText
      || insight.precedentClause?.clauseTextFull
      || '',
      180,
    ),
    benchmarkSummary: trimPromptText(
      topRule?.benchmark
      || topRule?.textSummary
      || topRule?.primaryConcern
      || '',
      220,
    ),
    whyItIsRisky: trimPromptText(insight.whyItIsRisky, 220),
    recommendedChange: trimPromptText(insight.recommendedChange, 220),
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
      targetClauses: fallback.clauseInsights.map(buildOverviewClauseContext),
    }),
    '',
    'Requirements:',
    '- Keep the headline concise and action-oriented.',
    '- Make the summary useful for a reviewer deciding what to inspect next in 2 to 4 sentences.',
    '- Provide 3 to 5 short nextSteps.',
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
    'Keep whyItIsRisky, comparison, and recommendedChange to 1 to 2 sentences each.',
    'Return JSON only.',
    '',
    'Context:',
    serializePromptContext({
      currentClause: {
        ...currentClause,
        clauseText: trimPromptText(currentClause.clauseText, 200),
        clauseTextSummary: trimPromptText(currentClause.clauseTextSummary, 200),
        clauseTextFull: trimPromptText(currentClause.clauseTextFull, 700),
      },
      precedentMatches: toPromptMatches(precedentMatches),
      ruleMatches: toPromptRuleMatches(ruleMatches),
    }),
  ].join('\n');
}

function buildBatchClauseInsightPrompt(clauses, reviewContexts = []) {
  const clausesData = clauses.map((clause, index) => {
    const reviewContext = reviewContexts[index] || {};
    const currentClause = buildCurrentClausePayload(clause, reviewContext.currentClause || {});
    const precedentMatches = (reviewContext.precedentMatches || []).map(normalizePrecedentMatch);
    const ruleMatches = ensureRuleMatches(reviewContext.ruleMatches || [], clause.clauseType);

    return {
      clauseId: clause.id,
      context: {
        currentClause: {
          ...currentClause,
          clauseText: trimPromptText(currentClause.clauseText, 200),
          clauseTextSummary: trimPromptText(currentClause.clauseTextSummary, 200),
          clauseTextFull: trimPromptText(currentClause.clauseTextFull, 700),
        },
        precedentMatches: toPromptMatches(precedentMatches),
        ruleMatches: toPromptRuleMatches(ruleMatches),
      },
    };
  });

  return [
    'You are a legal contract review assistant.',
    'Review the target clauses using only the clause data, precedent matches, and policy/rule matches below.',
    'Do not invent facts beyond the provided context.',
    'Keep the explanations practical and actionable.',
    'When explaining the comparison, explicitly anchor it to the precedent and benchmark guidance in the context.',
    'Keep each whyItIsRisky, comparison, and recommendedChange value to 1 to 2 sentences.',
    'Return JSON only with an array of insights, each containing clauseId, whyItIsRisky, comparison, and recommendedChange.',
    '',
    'Clauses to analyze:',
    JSON.stringify(clausesData, null, 2),
  ].join('\n');
}

function buildSemanticAnswerPrompt({ query, matches, contract }) {
  return [
    'You are a legal contract search assistant.',
    'Answer the user query keeping in mind the retrieved matches below.',
    'Do not invent missing clauses or unsupported advice.',
    'Keep the answer concise, grounded, actionable, and genuine.',
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
    return attachInsightMeta(fallback, {
      degraded: true,
      provider: 'template-fallback',
      geminiError: buildGeminiFailureInfo(
        new AppError(503, 'Gemini is not configured for contract insights.', {
          provider: env.genAiProvider,
          model: env.genAiModel,
        }),
      ),
    });
  }

  try {
    const generated = await generateStructuredObject({
      prompt: buildContractOverviewPrompt(contractBundle, fallback),
      responseSchema: contractOverviewSchema,
      label: 'contract overview',
    });

    return attachInsightMeta({
      headline: asText(generated?.headline, fallback.headline),
      summary: asText(generated?.summary, fallback.summary),
      topRiskItems: fallback.topRiskItems,
      nextSteps: asStringArray(generated?.nextSteps, fallback.nextSteps, 5),
      clauseInsights: fallback.clauseInsights,
    });
  } catch (error) {
    console.warn('Gemini contract overview failed, using explicit template fallback:', error.message);
    return attachInsightMeta(fallback, {
      degraded: true,
      provider: 'template-fallback',
      geminiError: buildGeminiFailureInfo(error),
    });
  }
}

async function generateBatchClauseInsights(clauses, reviewContexts = []) {
  const fallbacks = clauses.map((clause, index) => buildTemplateClauseInsight(clause, reviewContexts[index] || {}));

  if (!isGeminiEnabled()) {
    return fallbacks.map((fallback, index) => attachInsightMeta(fallback, {
      degraded: true,
      provider: 'template-fallback',
      geminiError: buildGeminiFailureInfo(
        new AppError(503, 'Gemini is not configured for clause insights.', {
          provider: env.genAiProvider,
          model: env.genAiModel,
        }),
      ),
    }));
  }

  try {
    const generated = await generateStructuredObject({
      prompt: buildBatchClauseInsightPrompt(clauses, reviewContexts),
      responseSchema: batchClauseInsightSchema,
      label: 'batch clause insights',
    });

    const generatedInsights = generated?.insights || [];

    return fallbacks.map((fallback, index) => {
      const generatedInsight = generatedInsights.find((item) => item?.clauseId === clauses[index].id) || {};

      const result = attachInsightMeta({
        ...fallback,
        whyItIsRisky: asText(generatedInsight?.whyItIsRisky, fallback.whyItIsRisky),
        comparison: asText(generatedInsight?.comparison, fallback.comparison),
        recommendedChange: asText(generatedInsight?.recommendedChange, fallback.recommendedChange),
      });

      // Cache successful results
      if (result.provider === 'gemini' && !result.degraded) {
        clauseInsightCache.set(clauses[index].id, result);
      }

      return result;
    });
  } catch (error) {
    console.warn('Gemini batch clause insights failed, using explicit template fallback:', error.message);
    return fallbacks.map((fallback) => attachInsightMeta(fallback, {
      degraded: true,
      provider: 'template-fallback',
      geminiError: buildGeminiFailureInfo(error),
    }));
  }
}

async function generateClauseInsight(clause, reviewContext = {}) {
  const cacheKey = `${clause.id}`;
  const cached = clauseInsightCache.get(cacheKey);
  if (cached && cached.provider === 'gemini' && !cached.degraded) {
    return cached;
  }

  const fallback = buildTemplateClauseInsight(clause, reviewContext);

  if (!isGeminiEnabled()) {
    return attachInsightMeta(fallback, {
      degraded: true,
      provider: 'template-fallback',
      geminiError: buildGeminiFailureInfo(
        new AppError(503, 'Gemini is not configured for clause insights.', {
          provider: env.genAiProvider,
          model: env.genAiModel,
        }),
      ),
    });
  }

  try {
    const generated = await generateStructuredObject({
      prompt: buildClauseInsightPrompt(clause, reviewContext),
      responseSchema: clauseInsightSchema,
      label: 'clause insight',
    });

    const result = attachInsightMeta({
      ...fallback,
      whyItIsRisky: asText(generated?.whyItIsRisky, fallback.whyItIsRisky),
      comparison: asText(generated?.comparison, fallback.comparison),
      recommendedChange: asText(generated?.recommendedChange, fallback.recommendedChange),
    });

    // Cache successful results
    if (result.provider === 'gemini' && !result.degraded) {
      clauseInsightCache.set(cacheKey, result);
    }

    return result;
  } catch (error) {
    console.warn('Gemini clause insight failed, using explicit template fallback:', error.message);
    return attachInsightMeta(fallback, {
      degraded: true,
      provider: 'template-fallback',
      geminiError: buildGeminiFailureInfo(error),
    });
  }
}

async function buildSemanticAnswer({ query, matches, contract }) {
  const fallback = buildTemplateSemanticAnswer({ query, matches, contract });

  if (!matches.length || !isGeminiEnabled()) {
    return attachInsightMeta(fallback, {
      degraded: !matches.length ? false : true,
      provider: !matches.length ? 'retrieval-only' : 'template-fallback',
      geminiError: !matches.length
        ? null
        : buildGeminiFailureInfo(
          new AppError(503, 'Gemini is not configured for semantic answers.', {
            provider: env.genAiProvider,
            model: env.genAiModel,
          }),
        ),
    });
  }

  try {
    const generated = await generateStructuredObject({
      prompt: buildSemanticAnswerPrompt({ query, matches, contract }),
      responseSchema: semanticAnswerSchema,
      label: 'semantic answer',
    });

    return attachInsightMeta({
      answer: asText(generated?.answer, fallback.answer),
      supportingMatches: fallback.supportingMatches,
      recommendations: asStringArray(generated?.recommendations, fallback.recommendations, 5),
    });
  } catch (error) {
    console.warn('Gemini semantic answer failed, using explicit template fallback:', error.message);
    return attachInsightMeta(fallback, {
      degraded: true,
      provider: 'template-fallback',
      geminiError: buildGeminiFailureInfo(error),
    });
  }
}

module.exports = {
  buildSemanticAnswer,
  generateClauseInsight,
  generateBatchClauseInsights,
  generateContractOverview,
};

const fs = require('node:fs');

const AppError = require('../errors/AppError');
const { env } = require('../config/env');
const { formatClauseType } = require('./contract.helpers');
const { generateStructuredObject, isGeminiEnabled } = require('./genAi.service');

const CONTRACT_INSIGHT_PROMPT_VERSION = 'on-demand-v1';

const fallbackRulebook = [
  {
    clauseType: 'other',
    primaryConcern: 'The clause should be reviewed for unclear obligations, missing limits, and operational risk.',
    benchmark: 'Use clear scope, responsibility, timelines, remedies, and approval requirements.',
    recommendedAction: 'Ask legal counsel to clarify the clause and align it with the rest of the agreement.',
  },
];

const contractInsightBundleSchema = {
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

function loadRulebook() {
  try {
    const parsed = JSON.parse(fs.readFileSync(env.rulebookPath, 'utf-8'));

    if (Array.isArray(parsed) && parsed.length) {
      return parsed;
    }

    console.warn(`Rulebook file did not contain a non-empty array: ${env.rulebookPath}`);
  } catch (error) {
    console.warn(`Rulebook load failed from ${env.rulebookPath}: ${error.message}`);
  }

  return fallbackRulebook;
}

const rulebook = loadRulebook();

function getRulebookEntry(clauseType = 'other') {
  return rulebook.find((entry) => entry.clauseType === clauseType)
    || rulebook.find((entry) => entry.clauseType === 'other');
}

function asText(value, fallback = '') {
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

function compactText(value, fallback = '', maxLength = 240) {
  const resolved = asText(value, fallback);
  const normalized = typeof resolved === 'string' ? resolved.replace(/\s+/g, ' ').trim() : '';

  if (!normalized || normalized.length <= maxLength) {
    return normalized;
  }

  const candidate = normalized.slice(0, maxLength + 1);
  const boundary = Math.max(
    candidate.lastIndexOf('. '),
    candidate.lastIndexOf('; '),
    candidate.lastIndexOf(', '),
    candidate.lastIndexOf(' '),
  );
  const safeBoundary = boundary > Math.floor(maxLength * 0.6) ? boundary : maxLength;

  return `${candidate.slice(0, safeBoundary).trim()}...`;
}

function compactStringArray(value, fallback = [], maxItems = 3, maxLength = 120) {
  return asStringArray(value, fallback, maxItems)
    .map((item) => compactText(item, '', maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
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
  return matches.slice(0, 2).map((match) => {
    const normalized = normalizePrecedentMatch(match);

    return {
      id: normalized.id,
      score: normalized.score,
      clauseType: normalized.clauseType,
      riskLabel: normalized.riskLabel,
      clauseTextSummary: trimPromptText(normalized.clauseTextSummary, 140),
      clauseTextFull: trimPromptText(normalized.clauseTextFull, 260),
      contractTitle: normalized.title,
      position: match.position || match.metadata?.position || null,
      sectionHeading: normalized.sectionHeading,
      contractType: normalized.contractType,
      jurisdiction: normalized.jurisdiction,
    };
  });
}

function toPromptRuleMatches(matches = []) {
  return matches.slice(0, 2).map((match) => {
    const normalized = normalizeRuleMatch(match);

    return {
      id: normalized.id,
      title: normalized.title,
      sectionTitle: normalized.sectionTitle,
      sourceType: normalized.sourceType,
      documentType: normalized.documentType,
      primaryClauseType: normalized.primaryClauseType,
      clauseTypes: normalized.clauseTypes,
      primaryConcern: trimPromptText(normalized.primaryConcern, 160),
      benchmark: trimPromptText(normalized.benchmark, 160),
      recommendedAction: trimPromptText(normalized.recommendedAction, 160),
      textSummary: trimPromptText(normalized.textSummary, 140),
      textFull: trimPromptText(normalized.textFull, 260),
      jurisdiction: normalized.jurisdiction,
      league: normalized.league,
      sport: normalized.sport,
    };
  });
}

function buildInsightRequestOptions(overrides = {}) {
  const hasConfiguredModelCandidates = Array.isArray(env.genAiModelCandidates)
    && env.genAiModelCandidates.length > 0;

  return {
    includeDefaultModelFallbacks: !hasConfiguredModelCandidates,
    maxAttempts: Math.max(1, env.genAiMaxRetries + 1),
    requestTimeoutMs: Math.max(env.genAiTimeoutMs, 25000),
    maxOutputTokens: Math.max(env.genAiMaxOutputTokens, 1500),
    lowLatencyMaxOutputTokens: Math.max(env.genAiMaxOutputTokens, 1500),
    temperature: Math.min(env.genAiTemperature, 0.1),
    lowLatencyTemperature: Math.min(env.genAiTemperature, 0.1),
    thinkingBudget: 0,
    ...overrides,
  };
}

function buildContractInsightFallback({ contract, risks = [], clauseInsights = [] }) {
  const highRiskCount = Number(contract?.metadata?.riskCounts?.high || 0);
  const highlightedClauseType = clauseInsights[0]?.clauseType
    ? formatClauseType(clauseInsights[0].clauseType)
    : 'high-risk';

  return {
    headline: highRiskCount > 0
      ? `${highRiskCount} high-risk clause${highRiskCount === 1 ? '' : 's'} need review before approval.`
      : `${contract?.title || 'This contract'} is ready for review.`,
    summary: compactText(
      [
        contract?.metadata?.summary || 'The contract has been parsed and risk-labeled.',
        highRiskCount > 0
          ? `Review should focus on ${highlightedClauseType} language first.`
          : 'No high-risk clauses were selected for AI insight generation.',
      ].join(' '),
      'The contract is ready for review.',
      260,
    ),
    nextSteps: [
      highRiskCount > 0
        ? `Review the ${highlightedClauseType} clauses against the retrieved benchmarks.`
        : 'Review the clause board for any business-specific concerns.',
      risks[0]?.title
        ? `Confirm the top flagged issue: ${compactText(risks[0].title, 'Review the top flagged clause.', 100)}`
        : 'Compare the flagged clauses with your preferred precedent wording.',
      'Align any redraft with the benchmark language before approval.',
    ],
  };
}

function buildClauseFallbackText(clauseInsight = {}) {
  const topRule = Array.isArray(clauseInsight.ruleMatches) ? clauseInsight.ruleMatches[0] : null;
  const comparisonSource = clauseInsight.precedentClause?.title
    ? `The closest comparison is ${clauseInsight.precedentClause.title}.`
    : 'The clause should be compared against the retrieved benchmark context.';

  return {
    whyItIsRisky: topRule?.primaryConcern || 'This clause needs review because it may create unbalanced or unclear obligations.',
    comparison: compactText(
      [
        comparisonSource,
        topRule?.benchmark || topRule?.textSummary || topRule?.primaryConcern || '',
      ].filter(Boolean).join(' '),
      'The clause differs from the retrieved benchmark language.',
      220,
    ),
    recommendedChange: topRule?.recommendedAction || 'Redraft the clause to align it with the retrieved benchmark protections.',
  };
}

function buildClauseInsightContextRecord(clause, reviewContext = {}) {
  const currentClause = buildCurrentClausePayload(clause, reviewContext.currentClause || {});
  const precedentMatches = (reviewContext.precedentMatches || []).map(normalizePrecedentMatch);
  const precedentClause = reviewContext.precedentClause
    ? normalizePrecedentMatch(reviewContext.precedentClause)
    : (precedentMatches[0] || null);
  const ruleMatches = ensureRuleMatches(reviewContext.ruleMatches || [], clause.clauseType);

  return {
    clauseId: clause.id,
    clauseType: clause.clauseType,
    riskLabel: clause.riskLabel,
    currentClause,
    precedentClause,
    precedentMatches,
    ruleMatches,
    whyItIsRisky: null,
    comparison: null,
    recommendedChange: null,
  };
}

function buildContractInsightPromptContext(clauseInsights = []) {
  return clauseInsights.map((clauseInsight) => ({
    clauseId: clauseInsight.clauseId,
    clauseType: clauseInsight.clauseType,
    riskLabel: clauseInsight.riskLabel,
    currentClause: {
      clauseTextSummary: trimPromptText(clauseInsight.currentClause?.clauseTextSummary, 160),
      clauseTextFull: trimPromptText(clauseInsight.currentClause?.clauseTextFull, 320),
      position: clauseInsight.currentClause?.position ?? null,
    },
    bestPrecedentMatch: clauseInsight.precedentClause
      ? {
        sourceType: clauseInsight.precedentClause.sourceType,
        title: trimPromptText(clauseInsight.precedentClause.title, 90),
        clauseType: clauseInsight.precedentClause.clauseType,
        score: clauseInsight.precedentClause.score,
        clauseTextSummary: trimPromptText(clauseInsight.precedentClause.clauseTextSummary, 140),
        clauseTextFull: trimPromptText(clauseInsight.precedentClause.clauseTextFull, 240),
      }
      : null,
    additionalPrecedentMatches: (clauseInsight.precedentMatches || [])
      .slice(clauseInsight.precedentClause ? 1 : 0, 3)
      .map((match) => ({
        sourceType: match.sourceType,
        title: trimPromptText(match.title, 90),
        clauseType: match.clauseType,
        score: match.score,
        clauseTextSummary: trimPromptText(match.clauseTextSummary, 120),
      })),
    bestRuleMatch: clauseInsight.ruleMatches?.[0]
      ? {
        title: trimPromptText(clauseInsight.ruleMatches[0].title, 90),
        sectionTitle: trimPromptText(clauseInsight.ruleMatches[0].sectionTitle, 90),
        primaryConcern: trimPromptText(clauseInsight.ruleMatches[0].primaryConcern, 140),
        benchmark: trimPromptText(clauseInsight.ruleMatches[0].benchmark || clauseInsight.ruleMatches[0].textSummary, 160),
        recommendedAction: trimPromptText(clauseInsight.ruleMatches[0].recommendedAction, 140),
      }
      : null,
    additionalRuleMatches: (clauseInsight.ruleMatches || [])
      .slice(1, 3)
      .map((rule) => ({
        title: trimPromptText(rule.title, 90),
        sectionTitle: trimPromptText(rule.sectionTitle, 90),
        primaryConcern: trimPromptText(rule.primaryConcern, 120),
        benchmark: trimPromptText(rule.benchmark || rule.textSummary, 140),
      })),
  }));
}

function buildContractInsightPrompt({ contract, risks = [], clauseInsights = [] }) {
  return [
    'You are a legal contract review assistant.',
    'Generate one grounded contract insight package using only the provided JSON context.',
    'Use the retrieved precedent and rulebook context when writing clause-level explanations.',
    'Do not invent facts, obligations, dates, money values, or legal positions that are not present in the context.',
    'Keep the wording practical, concise, and reviewer-friendly.',
    'Return JSON only.',
    '',
    'Context:',
    serializePromptContext({
      contract: {
        id: contract.id,
        title: contract.title,
        status: contract.status,
        summary: contract.metadata?.summary || '',
        contractType: contract.metadata?.contractType || '',
        parties: (contract.metadata?.parties || []).slice(0, 4),
        dates: (contract.metadata?.dates || []).slice(0, 4),
        clauseTypes: (contract.metadata?.clauseTypes || []).slice(0, 8),
        riskCounts: contract.metadata?.riskCounts || { low: 0, medium: 0, high: 0 },
        textPreview: trimPromptText(contract.textPreview, 240),
      },
      topRisks: risks.slice(0, 5).map((risk) => ({
        title: risk.title,
        severity: risk.severity,
        summary: trimPromptText(risk.summary, 140),
      })),
      targetClauses: buildContractInsightPromptContext(clauseInsights),
    }),
    '',
    'Requirements:',
    '- Headline: one short sentence.',
    '- Summary: maximum two short sentences.',
    '- NextSteps: exactly three short actions.',
    '- ClauseInsights: return one item for every provided clauseId.',
    '- Each whyItIsRisky, comparison, and recommendedChange value must be one short sentence.',
    '- Keep every clause explanation explicitly grounded in the provided precedent or rulebook context.',
  ].join('\n');
}

function validateGeneratedContractInsights(generated, clauseInsights = []) {
  const requestedClauseIds = clauseInsights.map((item) => item.clauseId);
  const generatedItems = Array.isArray(generated?.clauseInsights) ? generated.clauseInsights : [];
  const generatedByClauseId = new Map();

  generatedItems.forEach((item) => {
    const clauseId = asText(item?.clauseId, '');

    if (!clauseId) {
      return;
    }

    generatedByClauseId.set(clauseId, {
      clauseId,
      whyItIsRisky: asText(item?.whyItIsRisky, ''),
      comparison: asText(item?.comparison, ''),
      recommendedChange: asText(item?.recommendedChange, ''),
    });
  });

  const missingClauseIds = requestedClauseIds.filter((clauseId) => {
    const generatedItem = generatedByClauseId.get(clauseId);
    return !generatedItem
      || !generatedItem.whyItIsRisky
      || !generatedItem.comparison
      || !generatedItem.recommendedChange;
  });

  if (missingClauseIds.length) {
    throw new AppError(502, 'Gemini returned an incomplete contract insight package.', {
      promptVersion: CONTRACT_INSIGHT_PROMPT_VERSION,
      missingClauseIds,
    });
  }

  return generatedByClauseId;
}

function normalizeGeneratedNextSteps(value, fallback = []) {
  const normalized = compactStringArray(value, [], 3, 120);
  return normalized.length === 3 ? normalized : fallback.slice(0, 3);
}

async function generateContractInsightBundle({ contract, risks = [], clauseInsights = [] }) {
  if (!isGeminiEnabled()) {
    throw new AppError(503, 'Gemini is not configured for contract insights.', {
      provider: env.genAiProvider,
      model: env.genAiModel,
    });
  }

  const fallback = buildContractInsightFallback({
    contract,
    risks,
    clauseInsights,
  });

  const generated = await generateStructuredObject({
    prompt: buildContractInsightPrompt({
      contract,
      risks,
      clauseInsights,
    }),
    responseSchema: contractInsightBundleSchema,
    label: 'contract insight bundle',
    requestOptions: buildInsightRequestOptions({
      maxOutputTokens: Math.max(env.genAiMaxOutputTokens, 1800),
      lowLatencyMaxOutputTokens: Math.max(env.genAiMaxOutputTokens, 1800),
      requestTimeoutMs: Math.max(env.genAiTimeoutMs, 30000),
    }),
  });

  const generatedByClauseId = validateGeneratedContractInsights(generated, clauseInsights);
  const normalizedClauseInsights = {};

  clauseInsights.forEach((clauseInsight) => {
    const generatedItem = generatedByClauseId.get(clauseInsight.clauseId);
    const clauseFallback = buildClauseFallbackText(clauseInsight);

    normalizedClauseInsights[clauseInsight.clauseId] = {
      ...clauseInsight,
      whyItIsRisky: compactText(generatedItem.whyItIsRisky, clauseFallback.whyItIsRisky, 180),
      comparison: compactText(generatedItem.comparison, clauseFallback.comparison, 220),
      recommendedChange: compactText(generatedItem.recommendedChange, clauseFallback.recommendedChange, 180),
    };
  });

  return {
    promptVersion: CONTRACT_INSIGHT_PROMPT_VERSION,
    provider: 'gemini',
    overview: {
      headline: compactText(generated?.headline, fallback.headline, 140),
      summary: compactText(generated?.summary, fallback.summary, 260),
      nextSteps: normalizeGeneratedNextSteps(generated?.nextSteps, fallback.nextSteps),
    },
    clauseInsights: normalizedClauseInsights,
  };
}

function lowerCaseFirstCharacter(value = '') {
  return value ? `${value.charAt(0).toLowerCase()}${value.slice(1)}` : '';
}

function buildSemanticClauseSnippet(match = {}, fallback = '') {
  const rawSnippet = trimPromptText(match.clauseTextSummary || match.clauseTextFull || '', 120)
    .replace(/^["'\s]+|["'\s]+$/g, '')
    .replace(/\.+$/, '')
    .trim();

  return rawSnippet ? lowerCaseFirstCharacter(rawSnippet) : fallback;
}

function buildSemanticMatchSource(match = {}, contract = null) {
  const clauseTypeLabel = formatClauseType(match.clauseType || 'clause');
  const sourceTitle = contract?.title || match.title || '';

  return sourceTitle
    ? `${clauseTypeLabel} clause in ${sourceTitle}`
    : `${clauseTypeLabel} clause in the indexed corpus`;
}

function buildSemanticAnswerModelCandidates() {
  return [...new Set(
    [env.genAiModel, ...(Array.isArray(env.genAiModelCandidates) ? env.genAiModelCandidates : [])]
      .map((value) => String(value || '').trim())
      .filter(Boolean),
  )];
}

function buildSemanticAnswerRequestOptions() {
  const modelCandidates = buildSemanticAnswerModelCandidates();

  return buildInsightRequestOptions({
    includeDefaultModelFallbacks: false,
    ...(modelCandidates.length ? { modelCandidates } : {}),
    maxAttempts: 1,
    requestTimeoutMs: Math.max(env.genAiTimeoutMs, 18000),
    maxOutputTokens: Math.max(env.genAiMaxOutputTokens, 700),
    lowLatencyMaxOutputTokens: Math.max(env.genAiMaxOutputTokens, 700),
    thinkingBudget: 0,
  });
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
  const secondaryMatch = matches[1] ? normalizePrecedentMatch(matches[1]) : null;
  const clauseType = primaryMatch.clauseType || 'other';
  const rule = getRulebookEntry(clauseType);
  const primarySnippet = buildSemanticClauseSnippet(primaryMatch, lowerCaseFirstCharacter(rule.primaryConcern));
  const secondaryClauseLabel = secondaryMatch?.clauseType && secondaryMatch.clauseType !== clauseType
    ? formatClauseType(secondaryMatch.clauseType)
    : '';
  const localAnswer = primarySnippet
    ? `The closest match for "${query}" is a ${buildSemanticMatchSource(primaryMatch, contract)}. It discusses ${primarySnippet}${secondaryClauseLabel ? `, and a secondary match also points to ${secondaryClauseLabel} language.` : '.'}`
    : `The closest match for "${query}" is a ${buildSemanticMatchSource(primaryMatch, contract)}. ${rule.primaryConcern}`;

  return {
    answer: compactText(localAnswer, rule.primaryConcern, 260),
    supportingMatches: toSupportingMatches(matches).slice(0, 3),
    recommendations: [
      rule.recommendedAction,
      secondaryClauseLabel
        ? `Compare it with the ${secondaryClauseLabel} section because the retrieved matches suggest those obligations interact.`
        : `Cross-check the ${formatClauseType(clauseType)} clause against your governing law and dispute resolution sections before final approval.`,
    ],
  };
}

function buildSemanticAnswerPrompt({ query, matches, contract }) {
  return [
    'You are a legal contract search assistant.',
    'Answer the user query keeping in mind the retrieved matches below.',
    'Do not invent missing clauses or unsupported advice.',
    'Keep the answer concise, grounded, actionable, and genuine.',
    'Return only the minimum useful detail.',
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
          summary: trimPromptText(contract.metadata?.summary || '', 120),
        }
        : null,
      matches: toPromptMatches(matches),
      ruleMatches: toPromptRuleMatches(matches.map((match) => buildRuleFallbackMatch(match.clauseType || 'other'))),
    }),
    '',
    'Requirements:',
    '- Answer: max 2 short sentences.',
    '- Recommendations: 1 or 2 short actions.',
  ].join('\n');
}

async function buildSemanticAnswer({ query, matches, contract }) {
  const fallback = buildTemplateSemanticAnswer({ query, matches, contract });

  if (!matches.length || !isGeminiEnabled()) {
    return attachInsightMeta(fallback, {
      degraded: !matches.length ? false : true,
      provider: !matches.length ? 'retrieval-only' : 'local-derived',
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
      requestOptions: buildSemanticAnswerRequestOptions(),
    });

    return attachInsightMeta({
      answer: compactText(generated?.answer, fallback.answer, 260),
      supportingMatches: fallback.supportingMatches,
      recommendations: compactStringArray(generated?.recommendations, fallback.recommendations, 2, 100),
    });
  } catch (error) {
    console.warn('Gemini semantic answer unavailable, using derived local answer:', error.message);
    return attachInsightMeta(fallback, {
      degraded: true,
      provider: 'local-derived',
      geminiError: buildGeminiFailureInfo(error),
    });
  }
}

module.exports = {
  CONTRACT_INSIGHT_PROMPT_VERSION,
  buildClauseInsightContextRecord,
  buildGeminiFailureInfo,
  buildSemanticAnswer,
  generateContractInsightBundle,
};

export const INSIGHT_STATUS = Object.freeze({
  NOT_REQUESTED: 'not_requested',
  GENERATING: 'generating',
  READY: 'ready',
  FAILED: 'failed',
});

function normalizeStatus(status = '') {
  return Object.values(INSIGHT_STATUS).includes(status)
    ? status
    : INSIGHT_STATUS.NOT_REQUESTED;
}

export function getContractInsightState(contract = null) {
  const insightState = contract?.insightState;

  return {
    status: normalizeStatus(insightState?.status),
    requestedAt: insightState?.requestedAt || null,
    generatedAt: insightState?.generatedAt || null,
    failedAt: insightState?.failedAt || null,
    lastError: insightState?.lastError || null,
  };
}

export function getInsightStatus(contract = null, insights = null) {
  return normalizeStatus(insights?.status || getContractInsightState(contract).status);
}

export function getInsightStatusLabel(status = '') {
  switch (normalizeStatus(status)) {
    case INSIGHT_STATUS.GENERATING:
      return 'Generating';
    case INSIGHT_STATUS.READY:
      return 'Generated';
    case INSIGHT_STATUS.FAILED:
      return 'Generation failed';
    case INSIGHT_STATUS.NOT_REQUESTED:
    default:
      return 'Not generated yet';
  }
}

export function getInsightNotice(contract = null, insights = null) {
  switch (getInsightStatus(contract, insights)) {
    case INSIGHT_STATUS.GENERATING:
      return 'Generating grounded insights for high-risk clauses...';
    case INSIGHT_STATUS.READY:
      return '';
    case INSIGHT_STATUS.FAILED:
      return 'AI wording is unavailable right now, but review context is still available.';
    case INSIGHT_STATUS.NOT_REQUESTED:
    default:
      return 'Insights have not been generated yet for this contract.';
  }
}

export function getHighRiskClauses(contract = null) {
  return (contract?.clauses || [])
    .filter((clause) => clause.riskLabel === 'high')
    .sort((left, right) => (left.position || 0) - (right.position || 0))
    .map((clause) => ({
      clauseId: clause.id,
      clauseLabel: clause.clauseLabel || clause.clauseType || 'Clause',
      clauseType: clause.clauseType || 'other',
      riskLabel: clause.riskLabel || 'high',
      riskScore: clause.riskScore ?? null,
      clauseText: clause.clauseTextFull || clause.clauseTextSummary || clause.clauseText || '',
      clausePreview: clause.clauseTextSummary || clause.clauseText || '',
      extractedValues: clause.extractedValues || {},
      position: clause.position ?? null,
    }));
}

function buildLocalNextSteps(status, highRiskClauses = []) {
  const hasHighRiskClauses = highRiskClauses.length > 0;

  switch (normalizeStatus(status)) {
    case INSIGHT_STATUS.GENERATING:
      return [
        'Keep reviewing the clause board while the insight request completes.',
        'Focus first on the highest-risk clauses listed below.',
        'The saved result will be reused when generation finishes.',
      ];
    case INSIGHT_STATUS.FAILED:
      return [
        'Use the retrieved precedent and rulebook context to continue the review.',
        'Compare the flagged clauses with the strongest available benchmark language.',
        'Retry AI generation later if you need wording suggestions.',
      ];
    case INSIGHT_STATUS.READY:
      return [
        'Review the clause-level explanations against the source language.',
        'Validate the suggested changes with the retrieved precedent and rulebook context.',
        'Finalize redlines for the highlighted high-risk clauses before approval.',
      ];
    case INSIGHT_STATUS.NOT_REQUESTED:
    default:
      return hasHighRiskClauses
        ? [
          'Review the flagged high-risk clauses listed below.',
          'Generate insights when you want AI-written explanation and redraft guidance.',
          'Use semantic search or manual review in the meantime.',
        ]
        : [
          'Review the clause board for any business-specific concerns.',
          'Use semantic search to inspect similar language across indexed contracts.',
          'Generate insights later if high-risk clauses appear after re-analysis.',
        ];
  }
}

export function buildLocalInsightsWorkspace(contract = null) {
  if (!contract) {
    return {
      status: INSIGHT_STATUS.NOT_REQUESTED,
      requestedAt: null,
      generatedAt: null,
      failedAt: null,
      lastError: null,
      provider: null,
      promptVersion: 'on-demand-v1',
      selectedClauseIds: [],
      eligibleForGeneration: false,
      headline: 'Upload a contract to review insights.',
      summary: 'The insights workspace will show contract review data immediately and AI-generated insight only after you request it.',
      nextSteps: ['Open Intake and upload a contract to start the analysis pipeline.'],
      topRiskItems: [],
      highRiskClauses: [],
      clauseInsights: [],
    };
  }

  const insightState = getContractInsightState(contract);
  const status = insightState.status;
  const highRiskClauses = getHighRiskClauses(contract);

  return {
    status,
    requestedAt: insightState.requestedAt,
    generatedAt: insightState.generatedAt,
    failedAt: insightState.failedAt,
    lastError: insightState.lastError,
    provider: null,
    promptVersion: 'on-demand-v1',
    selectedClauseIds: [],
    eligibleForGeneration: highRiskClauses.length > 0,
    headline: `${contract.title} is ready for review.`,
    summary: getInsightNotice(contract),
    nextSteps: buildLocalNextSteps(status, highRiskClauses),
    topRiskItems: (contract?.risks || []).slice(0, 5).map((risk) => risk.title),
    highRiskClauses,
    clauseInsights: [],
  };
}

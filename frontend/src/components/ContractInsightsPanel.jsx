import { useState } from 'react';

import {
  downloadContractInsightReport,
  formatClauseType,
  renderClauseBody,
} from '../lib/contractInsightReport';
import {
  getHighRiskClauses,
  getInsightNotice,
  getInsightStatus,
  getInsightStatusLabel,
  INSIGHT_STATUS,
} from '../lib/contractInsights';
import StatusPill from './StatusPill';

function formatList(items = [], fallback = 'Not available') {
  return Array.isArray(items) && items.length ? items.join(', ') : fallback;
}

function formatCount(value = 0, singularLabel = 'item', pluralLabel = `${singularLabel}s`) {
  return `${value} ${value === 1 ? singularLabel : pluralLabel}`;
}

function formatTimestamp(value) {
  if (!value) {
    return 'Not available';
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return 'Not available';
  }

  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsedDate);
}

function renderClauseDetailText(clause) {
  return clause?.clauseText || clause?.clausePreview || 'Clause text is unavailable.';
}

function formatExtractedValuesSummary(extractedValues = {}) {
  const entries = Object.entries(extractedValues).filter(([, value]) => {
    if (Array.isArray(value)) {
      return value.length > 0;
    }

    return value !== null && value !== undefined && value !== '';
  });

  if (!entries.length) {
    return '';
  }

  return entries.slice(0, 3).map(([key, value]) => {
    const label = key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .trim();
    const normalizedValue = Array.isArray(value) ? value.join(', ') : String(value);
    return `${label}: ${normalizedValue}`;
  }).join(' | ');
}

function getInsightStatusTone(status = '') {
  switch (status) {
    case INSIGHT_STATUS.GENERATING:
      return 'pending';
    case INSIGHT_STATUS.READY:
      return 'ready';
    case INSIGHT_STATUS.FAILED:
      return 'failed';
    case INSIGHT_STATUS.NOT_REQUESTED:
    default:
      return 'disabled';
  }
}

function ContractInsightsPanel({
  contract,
  insights,
  pending,
  error,
  onGenerateInsights,
}) {
  const [reportPending, setReportPending] = useState(false);
  const [reportError, setReportError] = useState('');

  if (!contract) {
    return (
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Insights Workspace</p>
            <h3>No contract selected</h3>
          </div>
        </div>

        <p className="empty-state">
          Upload a contract and open it from the Contracts page to start the review workspace.
        </p>
      </section>
    );
  }

  const status = getInsightStatus(contract, insights);
  const statusLabel = getInsightStatusLabel(status);
  const insightNotice = error || getInsightNotice(contract, insights);
  const highRiskClauses = (insights?.highRiskClauses || []).length
    ? insights.highRiskClauses
    : getHighRiskClauses(contract);
  const clauseInsights = insights?.clauseInsights || [];
  const canGenerate = Boolean(insights?.eligibleForGeneration ?? highRiskClauses.length > 0);
  const showGenerateButton = status !== INSIGHT_STATUS.READY;
  const showContextCards = status === INSIGHT_STATUS.READY || status === INSIGHT_STATUS.FAILED;
  const showAiExplanation = status === INSIGHT_STATUS.READY;
  const riskCounts = contract.riskCounts || { low: 0, medium: 0, high: 0 };
  const generatedInsightCount = clauseInsights.length;
  const lastActivity = insights?.generatedAt || insights?.requestedAt || '';
  const statusTone = getInsightStatusTone(status);

  function handleDownloadReport() {
    setReportPending(true);
    setReportError('');

    try {
      downloadContractInsightReport({
        contract,
        insights,
        pending,
        error,
      });
    } catch (downloadError) {
      setReportError(downloadError.message || 'The analysis report could not be generated.');
    } finally {
      setReportPending(false);
    }
  }

  return (
    <section className="panel">
      <div className="insight-shell">
        <section className="insight-hero">
          <div className="insight-hero-primary">
            <div className="insight-hero-copy">
              <p className="eyebrow">Insights Workspace</p>
              <div className="insight-hero-title-row">
                <h3>{contract.title}</h3>
                <StatusPill status={statusTone}>{statusLabel}</StatusPill>
              </div>
              <p className="insight-hero-headline">{insights?.headline || `${contract.title} is ready for review.`}</p>
              <p className="insight-hero-summary">{insights?.summary || insightNotice}</p>
            </div>
            <div className="insight-panel-actions">
              {showGenerateButton ? (
                <button
                  type="button"
                  className="contract-review-toggle contract-review-insights"
                  onClick={onGenerateInsights}
                  disabled={pending || !canGenerate}
                >
                  {status === INSIGHT_STATUS.FAILED ? 'Retry Insights' : 'Generate Insights'}
                </button>
              ) : null}
              <button
                type="button"
                className="insight-report-button"
                onClick={handleDownloadReport}
                disabled={reportPending}
              >
                {reportPending ? 'Preparing PDF...' : 'Get Report'}
              </button>
            </div>
          </div>

          <div className="insight-hero-stats">
            <article className="insight-hero-stat">
              <span className="insight-hero-stat-label">Contract type</span>
              <strong>{contract.contractType || 'Contract'}</strong>
            </article>
            <article className="insight-hero-stat">
              <span className="insight-hero-stat-label">High-risk clauses</span>
              <strong>{formatCount(highRiskClauses.length, 'clause')}</strong>
            </article>
            <article className="insight-hero-stat">
              <span className="insight-hero-stat-label">Generated insight cards</span>
              <strong>{formatCount(generatedInsightCount, 'card')}</strong>
            </article>
            <article className="insight-hero-stat">
              <span className="insight-hero-stat-label">Latest activity</span>
              <strong>{lastActivity ? formatTimestamp(lastActivity) : 'Not requested yet'}</strong>
            </article>
          </div>
        </section>

        <div className="insight-grid">
          <div className="insight-card insight-card-highlight">
            <p className="eyebrow">Review Snapshot</p>
            <h4>Contract review summary</h4>

            <div className="insight-detail-list">
              <div className="insight-detail-row">
                <span>Status</span>
                <strong>{contract.status?.replace(/-/g, ' ') || 'review'}</strong>
              </div>
              <div className="insight-detail-row">
                <span>Parties</span>
                <strong>{formatList(contract.parties, 'Not extracted yet')}</strong>
              </div>
              <div className="insight-detail-row">
                <span>Dates</span>
                <strong>{formatList(contract.dates, 'Awaiting extraction')}</strong>
              </div>
            </div>

            <div className="insight-risk-strip">
              <div className="insight-risk-chip insight-risk-chip-low">
                <span>Low</span>
                <strong>{riskCounts.low ?? 0}</strong>
              </div>
              <div className="insight-risk-chip insight-risk-chip-medium">
                <span>Medium</span>
                <strong>{riskCounts.medium ?? 0}</strong>
              </div>
              <div className="insight-risk-chip insight-risk-chip-high">
                <span>High</span>
                <strong>{riskCounts.high ?? 0}</strong>
              </div>
            </div>
          </div>

          <div className="insight-card">
            <p className="eyebrow">Request Timeline</p>
            <h4>Insight generation history</h4>

            <div className="insight-detail-list">
              <div className="insight-detail-row">
                <span>Requested</span>
                <strong>{formatTimestamp(insights?.requestedAt)}</strong>
              </div>
              <div className="insight-detail-row">
                <span>Generated</span>
                <strong>{formatTimestamp(insights?.generatedAt)}</strong>
              </div>
              <div className="insight-detail-row">
                <span>Workspace status</span>
                <strong>{statusLabel}</strong>
              </div>
            </div>

            {status === INSIGHT_STATUS.FAILED && insights?.lastError?.message ? (
              <p className="empty-state insight-inline-note"><strong>Latest error:</strong> {insights.lastError.message}</p>
            ) : null}
            {!canGenerate ? (
              <p className="empty-state insight-inline-note">No high-risk clauses are currently available for on-demand AI generation.</p>
            ) : null}
            {reportError ? (
              <p className="empty-state insight-inline-note">{reportError}</p>
            ) : null}
          </div>
        </div>

        <div className="insight-grid">
          <div className="insight-card insight-list-card">
            <div className="insight-section-head">
              <div>
                <p className="eyebrow">Priority Review</p>
                <h4>Top risk items</h4>
              </div>
              <span className="mode-label">{formatCount((insights?.topRiskItems || []).length, 'item')}</span>
            </div>
            {(insights?.topRiskItems || []).length ? (
              <ul className="insight-ordered-list">
                {(insights.topRiskItems || []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="empty-state">No prioritized risk items are available yet.</p>
            )}
          </div>

          <div className="insight-card insight-list-card">
            <div className="insight-section-head">
              <div>
                <p className="eyebrow">Action Plan</p>
                <h4>Next steps</h4>
              </div>
              <span className="mode-label">{formatCount((insights?.nextSteps || []).length, 'step')}</span>
            </div>
            {(insights?.nextSteps || []).length ? (
              <ul className="insight-ordered-list">
                {(insights.nextSteps || []).map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            ) : (
              <p className="empty-state">No next steps are available yet.</p>
            )}
          </div>
        </div>

        <div className="insight-stack">
          <div className="panel-header insight-section-head">
            <div>
              <p className="eyebrow">High-Risk Clauses</p>
              <h3>Review workspace</h3>
            </div>
            <span className="mode-label">{formatCount(highRiskClauses.length, 'clause')}</span>
          </div>

          {highRiskClauses.length ? (
            highRiskClauses.map((clause, index) => {
              const extractedValuesSummary = formatExtractedValuesSummary(clause.extractedValues);

              return (
                <article key={clause.clauseId} className="insight-card insight-clause-card">
                  <div className="insight-clause-head">
                    <div>
                      <p className="eyebrow">Clause {index + 1}</p>
                      <h4>{formatClauseType(clause.clauseType || clause.clauseLabel || 'Clause')}</h4>
                    </div>
                    <StatusPill status={clause.riskLabel || 'high'}>{clause.riskLabel || 'high'} risk</StatusPill>
                  </div>

                  <div className="insight-clause-facts">
                    {clause.position ? (
                      <span className="insight-fact-chip">Position {clause.position}</span>
                    ) : null}
                    {clause.riskScore !== null && clause.riskScore !== undefined ? (
                      <span className="insight-fact-chip">Risk score {clause.riskScore}</span>
                    ) : null}
                    {extractedValuesSummary ? (
                      <span className="insight-fact-chip">{extractedValuesSummary}</span>
                    ) : null}
                  </div>

                  <p className="insight-clause-text">{renderClauseDetailText(clause)}</p>
                </article>
              );
            })
          ) : (
            <p className="empty-state">
              No high-risk clauses were detected for this contract. The clause board remains available from the Contracts page.
            </p>
          )}
        </div>

        {showContextCards ? (
          <div className="insight-stack">
            <div className="panel-header insight-section-head">
              <div>
                <p className="eyebrow">Retrieved Context</p>
                <h3>Precedent and benchmark support</h3>
              </div>
              <span className="mode-label">{formatCount(clauseInsights.length, 'context set')}</span>
            </div>

            {clauseInsights.length ? (
              clauseInsights.map((insight, index) => {
                const comparisonSourceType = insight.precedentClause?.sourceType || insight.precedentMatches?.[0]?.sourceType || '';
                const bestComparisonLabel = comparisonSourceType === 'precedent' ? 'Best Precedent' : 'Best Comparison';
                const additionalComparisonLabel = comparisonSourceType === 'precedent'
                  ? 'Additional Precedents'
                  : 'Additional Comparable Clauses';
                const emptyComparisonTitle = comparisonSourceType === 'precedent'
                  ? 'No stored precedent yet'
                  : 'No stored comparison yet';

                return (
                  <article key={insight.clauseId} className="insight-card insight-context-card">
                    <div className="insight-context-head">
                      <div>
                        <p className="eyebrow">Context Set {index + 1}</p>
                        <h4>{formatClauseType(insight.clauseType || 'Clause')}</h4>
                      </div>
                      <StatusPill status={insight.riskLabel || 'high'}>{insight.riskLabel || 'high'} risk</StatusPill>
                    </div>

                    {showAiExplanation ? (
                      <div className="insight-generated-grid">
                        <article className="insight-generated-card">
                          <p className="eyebrow">Why It Is Risky</p>
                          <p>{insight.whyItIsRisky}</p>
                        </article>
                        <article className="insight-generated-card">
                          <p className="eyebrow">Comparison</p>
                          <p>{insight.comparison}</p>
                        </article>
                        <article className="insight-generated-card">
                          <p className="eyebrow">Recommended Change</p>
                          <p>{insight.recommendedChange}</p>
                        </article>
                      </div>
                    ) : (
                      <p className="empty-state insight-inline-note">
                        AI-written explanation is unavailable for this request, but the retrieved legal context below is still available for review.
                      </p>
                    )}

                    <div className="insight-compare-grid">
                      <section className="insight-compare-block">
                        <p className="eyebrow">Current Clause</p>
                        <h4>{insight.currentClause?.contractTitle || contract.title}</h4>
                        <p>{renderClauseBody(insight.currentClause, renderClauseBody(insight))}</p>
                      </section>

                      <section className="insight-compare-block">
                        <p className="eyebrow">{bestComparisonLabel}</p>
                        <h4>{insight.precedentClause?.title || emptyComparisonTitle}</h4>
                        <p>
                          {insight.precedentClause
                            ? renderClauseBody(insight.precedentClause)
                            : 'This panel fills from your indexed precedent bank or the closest matching clause from another indexed contract.'}
                        </p>
                      </section>
                    </div>

                    {(insight.ruleMatches || []).length ? (
                      <div className="insight-rule-stack">
                        <div className="insight-section-head">
                          <div>
                            <p className="eyebrow">Rules And Policies</p>
                            <h4>Benchmark guidance</h4>
                          </div>
                        </div>
                        {(insight.ruleMatches || []).map((rule) => (
                          <div key={rule.id} className="insight-rule-item">
                            <strong>{rule.title || 'Benchmark guidance'}</strong>
                            <p>{rule.benchmark || rule.textSummary || rule.textFull}</p>
                            {rule.recommendedAction ? (
                              <p><strong>Expected action:</strong> {rule.recommendedAction}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {(insight.precedentMatches || []).length > 1 ? (
                      <div className="insight-related-list">
                        <div className="insight-section-head">
                          <div>
                            <p className="eyebrow">{additionalComparisonLabel}</p>
                            <h4>Supporting matches</h4>
                          </div>
                        </div>
                        <ul className="insight-ordered-list">
                          {insight.precedentMatches.slice(1).map((match) => (
                            <li key={match.id}>
                              <strong>{match.title || formatClauseType(match.clauseType || 'precedent')}</strong>
                              {typeof match.score === 'number' ? ` (${match.score.toFixed(2)})` : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </article>
                );
              })
            ) : (
              <p className="empty-state">
                Retrieved precedent and rulebook context will appear here after insight generation is requested.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default ContractInsightsPanel;

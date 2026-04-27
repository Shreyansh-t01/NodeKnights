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

function formatList(items = [], fallback = 'Not available') {
  return Array.isArray(items) && items.length ? items.join(', ') : fallback;
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
      <div className="panel-header">
        <div>
          <p className="eyebrow">Insights Workspace</p>
          <h3>{contract.title}</h3>
        </div>
        <div className="insight-panel-actions">
          <span className="mode-label">{statusLabel}</span>
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

      <div className="insight-grid">
        <div className="insight-card">
          <p className="eyebrow">Contract Review Summary</p>
          <h4>{contract.contractType || 'Contract'}</h4>
          <p><strong>Status:</strong> {contract.status?.replace(/-/g, ' ') || 'review'}</p>
          <p><strong>Parties:</strong> {formatList(contract.parties, 'Not extracted yet')}</p>
          <p><strong>Dates:</strong> {formatList(contract.dates, 'Awaiting extraction')}</p>
          <p>
            <strong>Risk counts:</strong> Low {contract.riskCounts?.low ?? 0}, Medium {contract.riskCounts?.medium ?? 0}, High {contract.riskCounts?.high ?? 0}
          </p>
        </div>

        <div className="insight-card">
          <p className="eyebrow">Insight Status</p>
          <h4>{insights?.headline || `${contract.title} is ready for review.`}</h4>
          <p>{insights?.summary || insightNotice}</p>
          <p><strong>Requested:</strong> {formatTimestamp(insights?.requestedAt)}</p>
          <p><strong>Generated:</strong> {formatTimestamp(insights?.generatedAt)}</p>
          {status === INSIGHT_STATUS.FAILED && insights?.lastError?.message ? (
            <p className="empty-state"><strong>Latest error:</strong> {insights.lastError.message}</p>
          ) : null}
          {!canGenerate ? (
            <p className="empty-state">No high-risk clauses are currently available for on-demand AI generation.</p>
          ) : null}
          {reportError ? (
            <p className="empty-state">{reportError}</p>
          ) : null}
        </div>
      </div>

      <div className="insight-grid">
        <div className="insight-card">
          <h4>Top Risk Items</h4>
          {(insights?.topRiskItems || []).length ? (
            <ul>
              {(insights.topRiskItems || []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">No prioritized risk items are available yet.</p>
          )}
        </div>

        <div className="insight-card">
          <h4>Next Steps</h4>
          {(insights?.nextSteps || []).length ? (
            <ul>
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
        <div className="panel-header">
          <div>
            <p className="eyebrow">High-Risk Clauses</p>
            <h3>Review workspace</h3>
          </div>
        </div>

        {highRiskClauses.length ? (
          highRiskClauses.map((clause) => (
            <article key={clause.clauseId} className="insight-card">
              <div className="insight-meta">
                <strong>{formatClauseType(clause.clauseType || clause.clauseLabel || 'Clause')}</strong>
                <span>{clause.riskLabel || 'high'} risk</span>
              </div>
              <p>{renderClauseDetailText(clause)}</p>
            </article>
          ))
        ) : (
          <p className="empty-state">
            No high-risk clauses were detected for this contract. The clause board remains available from the Contracts page.
          </p>
        )}
      </div>

      {showContextCards ? (
        <div className="insight-stack">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Retrieved Context</p>
              <h3>Precedent and benchmark support</h3>
            </div>
          </div>

          {clauseInsights.length ? (
            clauseInsights.map((insight) => {
              const comparisonSourceType = insight.precedentClause?.sourceType || insight.precedentMatches?.[0]?.sourceType || '';
              const bestComparisonLabel = comparisonSourceType === 'precedent' ? 'Best Precedent' : 'Best Comparison';
              const additionalComparisonLabel = comparisonSourceType === 'precedent'
                ? 'Additional Precedents'
                : 'Additional Comparable Clauses';
              const emptyComparisonTitle = comparisonSourceType === 'precedent'
                ? 'No stored precedent yet'
                : 'No stored comparison yet';

              return (
                <article key={insight.clauseId} className="insight-card">
                  <div className="insight-meta">
                    <strong>{formatClauseType(insight.clauseType || 'Clause')}</strong>
                    <span>{insight.riskLabel || 'high'} risk</span>
                  </div>

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
                      <p className="eyebrow">Rules And Policies</p>
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
                      <p className="eyebrow">{additionalComparisonLabel}</p>
                      <ul>
                        {insight.precedentMatches.slice(1).map((match) => (
                          <li key={match.id}>
                            <strong>{match.title || formatClauseType(match.clauseType || 'precedent')}</strong>
                            {typeof match.score === 'number' ? ` (${match.score.toFixed(2)})` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {showAiExplanation ? (
                    <div className="insight-generated-copy">
                      <p><strong>Why it is risky:</strong> {insight.whyItIsRisky}</p>
                      <p><strong>Comparison:</strong> {insight.comparison}</p>
                      <p><strong>Recommended change:</strong> {insight.recommendedChange}</p>
                    </div>
                  ) : (
                    <p className="empty-state">
                      AI-written explanation is unavailable for this request, but the retrieved legal context above is still available for review.
                    </p>
                  )}
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
    </section>
  );
}

export default ContractInsightsPanel;

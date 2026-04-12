function formatClauseType(value = 'Clause') {
  return value.replace(/_/g, ' ');
}

function renderClauseBody(clause, fallback = 'Clause text is unavailable.') {
  return clause?.clauseTextFull || clause?.clauseTextSummary || clause?.clauseText || fallback;
}

function ContractInsightsPanel({ contract, insights, pending, error }) {
  if (!contract) {
    return (
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">AI Insights</p>
            <h3>No contract selected</h3>
          </div>
        </div>

        <p className="empty-state">
          Upload a contract and select it from the list to generate live AI insights.
        </p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">AI Insights</p>
          <h3>{contract.title}</h3>
        </div>
        <span className="mode-label">Auto-generated only for high-risk clauses</span>
      </div>

      <div className="insight-summary">
        <h4>{pending ? 'Refreshing insights...' : insights?.headline || 'Contract insight summary'}</h4>
        <p>{error || insights?.summary || 'Insight summary will appear here after analysis completes.'}</p>
      </div>

      <div className="insight-grid">
        <div className="insight-card">
          <h4>Next Steps</h4>
          <ul>
            {(insights?.nextSteps || []).map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </div>

        <div className="insight-card">
          <h4>Priority Items</h4>
          <ul>
            {(insights?.topRiskItems || []).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="insight-stack">
        <div className="panel-header">
          <div>
            <p className="eyebrow">High Risk Clauses</p>
            <h3>Automatic clause insights</h3>
          </div>
        </div>

        {(insights?.clauseInsights || []).length ? (
          insights.clauseInsights.map((insight) => (
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
                  <p className="eyebrow">Best Comparison</p>
                  <h4>{insight.precedentClause?.title || 'No stored precedent yet'}</h4>
                  <p>
                    {insight.precedentClause
                      ? renderClauseBody(insight.precedentClause)
                      : 'This panel fills from your indexed precedent bank or the closest matching clause from another indexed contract.'}
                  </p>
                </section>
              </div>

              <p><strong>Why it is risky:</strong> {insight.whyItIsRisky}</p>
              <p><strong>Comparison:</strong> {insight.comparison}</p>
              <p><strong>Recommended change:</strong> {insight.recommendedChange}</p>

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
                  <p className="eyebrow">Additional Comparisons</p>
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
            </article>
          ))
        ) : (
          <p className="empty-state">
            No automatic clause insights were generated because this contract does not currently have any high-risk clauses.
          </p>
        )}
      </div>
    </section>
  );
}

export default ContractInsightsPanel;

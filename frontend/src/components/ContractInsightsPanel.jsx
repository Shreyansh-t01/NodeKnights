function ContractInsightsPanel({ contract, insights, pending }) {
  if (!contract) {
    return null;
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
        <p>{insights?.summary || 'Insight summary will appear here after analysis completes.'}</p>
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
                <strong>{insight.clauseType?.replace(/_/g, ' ') || 'Clause'}</strong>
                <span>{insight.riskLabel || 'high'} risk</span>
              </div>
              <p><strong>Why it is risky:</strong> {insight.whyItIsRisky}</p>
              <p><strong>Comparison:</strong> {insight.comparison}</p>
              <p><strong>Recommended change:</strong> {insight.recommendedChange}</p>
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

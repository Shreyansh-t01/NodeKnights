import ContractInsightsPanel from '../components/ContractInsightsPanel';

function InsightsPage({
  selectedContract,
  insights,
  insightsPending,
  insightsError,
  onNavigate,
}) {
  return (
    <section className="route-grid">
      {!selectedContract ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">AI Insights</p>
              <h3>Open insights from a contract card</h3>
            </div>
          </div>

          <p className="empty-state">
            Choose a contract from the Contracts page and use the Get Insights button to open the full comparison and AI review flow here.
          </p>

          <div className="hero-actions">
            <button type="button" onClick={() => onNavigate('/contracts')}>Open Contracts</button>
          </div>
        </section>
      ) : null}

      {selectedContract ? (
        <ContractInsightsPanel
          contract={selectedContract}
          insights={insights}
          pending={insightsPending}
          error={insightsError}
        />
      ) : null}
    </section>
  );
}

export default InsightsPage;

import ContractInsightsPanel from '../components/ContractInsightsPanel';

function InsightsPage({
  selectedContract,
  insights,
  insightsPending,
  insightsError,
  onGenerateInsights,
  onNavigate,
}) {
  return (
    <section className="route-grid">
      {!selectedContract ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Insights Workspace</p>
              <h3>Open insights from a contract card</h3>
            </div>
          </div>

          <p className="empty-state">
            Choose a contract from the Contracts page to open the review workspace here. AI insight generation happens only after you explicitly request it for that contract.
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
          onGenerateInsights={onGenerateInsights}
        />
      ) : null}
    </section>
  );
}

export default InsightsPage;

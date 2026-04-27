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
    <section className="route-grid insights-route">
      {!selectedContract ? (
        <section className="panel insight-empty-panel">
          <div className="insight-empty-state">
            <div className="insight-empty-copy">
              <p className="eyebrow">Insights Workspace</p>
              <h3>Open a contract to start the review workspace</h3>
              <p className="empty-state">
                Choose a contract from the Contracts page to review high-risk clauses, see grounded context, and request AI insight only when you need it.
              </p>
            </div>

            <div className="insight-empty-grid">
              <article className="insight-empty-card">
                <p className="eyebrow">Before Generation</p>
                <h4>Review the contract immediately</h4>
                <p className="empty-state">
                  The workspace can show contract details, top risks, and flagged clauses even before AI wording is requested.
                </p>
              </article>

              <article className="insight-empty-card">
                <p className="eyebrow">On Demand</p>
                <h4>Generate insight only when needed</h4>
                <p className="empty-state">
                  AI generation runs only after you explicitly ask for it, and the saved result can be reused on later visits.
                </p>
              </article>

              <article className="insight-empty-card">
                <p className="eyebrow">After Generation</p>
                <h4>Read one clear review package</h4>
                <p className="empty-state">
                  Clause explanation, precedent comparison, and benchmark guidance all stay together in one review flow.
                </p>
              </article>
            </div>

            <div className="hero-actions">
              <button type="button" onClick={() => onNavigate('/contracts')}>Open Contracts</button>
            </div>
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

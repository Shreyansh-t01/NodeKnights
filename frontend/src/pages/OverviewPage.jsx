import MetricCard from '../components/MetricCard';
import StatusPill from '../components/StatusPill';
import ContractCard from '../components/ContractCard';

function OverviewPage({
  bootMode,
  health,
  metrics,
  contracts,
  selectedContractId,
  onSelectContract,
  onDeleteContract,
  deletingContractId,
  onNavigate,
}) {
  const modeLabel = bootMode === 'live'
    ? 'Live backend mode'
    : bootMode === 'offline'
      ? 'Backend not connected, retrying'
      : 'Connecting to backend';
  const recentContracts = contracts.slice(0, 3);
  const selectedContract = contracts.find((contract) => contract.id === selectedContractId) || recentContracts[0] || null;
  const highRiskCount = contracts.reduce((sum, contract) => sum + (contract.riskCounts?.high || 0), 0);
  const clauseCount = contracts.reduce((sum, contract) => sum + ((contract.clauses || []).length || 0), 0);

  return (
    <>
      <section className="landing-hero route-grid">
        <div className="landing-hero-content">
          <p className="eyebrow">Lexora Legal Intelligence</p>
          <h1>Calm contract review, grounded in clauses, precedent, and risk signals.</h1>
          <p className="hero-text">
            Lexora gives legal teams a focused path from document intake to clause-level review, explainable insights,
            and searchable evidence without making the workspace feel noisy.
          </p>

          <div className="hero-actions" aria-label="Primary actions">
            <button type="button" onClick={() => onNavigate('/intake')}>Start Intake</button>
            <button type="button" className="secondary-action" onClick={() => onNavigate('/contracts')}>Review Contracts</button>
            <button type="button" className="secondary-action" onClick={() => onNavigate('/search')}>Search Clauses</button>
          </div>
        </div>

        <div className="assurance-grid" aria-label="System readiness">
          <div className="assurance-item">
            <span>Mode</span>
            <StatusPill status={bootMode === 'live' ? 'ready' : bootMode === 'offline' ? 'error' : 'configure'}>
              {modeLabel}
            </StatusPill>
          </div>
          <div className="assurance-item">
            <span>Storage</span>
            <StatusPill status={health?.firebase?.enabled ? 'ready' : health ? 'configure' : 'configure'}>
              {!health ? 'Checking' : health?.firebase?.enabled ? 'Structured' : 'Needs setup'}
            </StatusPill>
          </div>
          <div className="assurance-item">
            <span>Vector Search</span>
            <StatusPill status={health?.pinecone?.enabled ? 'ready' : health ? 'configure' : 'configure'}>
              {!health ? 'Checking' : health?.pinecone?.enabled ? 'Indexed' : 'Needs setup'}
            </StatusPill>
          </div>
          <div className="assurance-item">
            <span>Reasoning</span>
            <StatusPill status={health?.reasoning?.enabled ? 'ready' : health ? 'configure' : 'configure'}>
              {!health ? 'Checking' : health?.reasoning?.enabled ? 'Active' : 'Unavailable'}
            </StatusPill>
          </div>
        </div>

        <div className="landing-command-grid">
          <article className="dossier-panel">
            <div className="dossier-panel-head">
              <div>
                <p className="eyebrow">Review Dossier</p>
                <h3>{selectedContract?.title || 'No live contract selected'}</h3>
              </div>
              <StatusPill status={selectedContract?.status || 'configure'}>
                {selectedContract?.status?.replace(/-/g, ' ') || 'Awaiting intake'}
              </StatusPill>
            </div>

            <div className="dossier-stats">
              <div>
                <strong>{contracts.length}</strong>
                <span>contracts</span>
              </div>
              <div>
                <strong>{highRiskCount}</strong>
                <span>high risks</span>
              </div>
              <div>
                <strong>{clauseCount}</strong>
                <span>clauses</span>
              </div>
            </div>

            <div className="clause-signal-list">
              <div className="clause-signal clause-signal-high">
                <span>Termination</span>
                <strong>Notice and cure review</strong>
              </div>
              <div className="clause-signal clause-signal-medium">
                <span>Payment</span>
                <strong>Obligation and timeline check</strong>
              </div>
              <div className="clause-signal clause-signal-low">
                <span>Confidentiality</span>
                <strong>Survival language aligned</strong>
              </div>
            </div>
          </article>

          <article className="brief-panel">
            <p className="eyebrow">Decision Brief</p>
            <h3>What needs counsel attention?</h3>
            <p>
              Prioritize high-exposure clauses, compare them against trusted language, and keep every recommendation tied
              back to the source document.
            </p>
            <div className="brief-row">
              <span>Evidence</span>
              <strong>Clause text, metadata, rules</strong>
            </div>
            <div className="brief-row">
              <span>Outcome</span>
              <strong>Explain, compare, redraft</strong>
            </div>
          </article>
        </div>
      </section>

      <section className="metrics-grid">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Recent Contracts</p>
            <h3>Jump into review work</h3>
          </div>
        </div>

        <div className="contract-grid-preview">
          {contracts.length ? (
            contracts.slice(0, 3).map((contract) => (
              <ContractCard
                key={contract.id}
                contract={contract}
                isActive={contract.id === selectedContractId}
                deletePending={deletingContractId === contract.id}
                onDelete={onDeleteContract}
                onSelect={(contractId) => {
                  onSelectContract(contractId);
                  onNavigate('/contracts');
                }}
              />
            ))
          ) : (
            <p className="empty-state">
              No live contracts are available yet. Go to Intake to upload one and populate the review workspace.
            </p>
          )}
        </div>
      </section>
    </>
  );
}

export default OverviewPage;

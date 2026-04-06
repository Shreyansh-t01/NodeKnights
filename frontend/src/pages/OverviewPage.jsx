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
  onNavigate,
}) {
  const modeLabel = bootMode === 'live' ? 'Live backend mode' : bootMode === 'mock' ? 'Mock preview mode' : 'Connecting';

  return (
    <>
      <section className="hero panel">
        <div className="hero-copy">
          <p className="eyebrow">Legal Intelligence System</p>
          <h1>Move from ingestion to action without crowding every workflow onto one screen.</h1>
          <p className="hero-text">
            The workspace is now separated into intake, contract review, AI insights, and semantic search so each step
            in the pipeline gets a focused view.
          </p>
          <div className="hero-pills">
            <StatusPill status={bootMode === 'live' ? 'ready' : 'fallback'}>{modeLabel}</StatusPill>
            <StatusPill status={health?.firebase?.enabled ? 'ready' : 'fallback'}>
              {health?.firebase?.enabled ? 'Firebase configured' : 'Local fallback storage'}
            </StatusPill>
            <StatusPill status={health?.pinecone?.enabled ? 'ready' : 'fallback'}>
              {health?.pinecone?.enabled ? 'Pinecone live' : 'Local vector fallback'}
            </StatusPill>
            <StatusPill status={health?.reasoning?.enabled ? 'ready' : 'fallback'}>
              {health?.reasoning?.enabled
                ? `${health?.reasoning?.provider || 'external'} active`
                : 'Template fallback active'}
            </StatusPill>
          </div>

          <div className="hero-actions">
            <button type="button" onClick={() => onNavigate('/intake')}>Go To Intake</button>
            <button type="button" onClick={() => onNavigate('/insights')}>Open AI Insights</button>
            <button type="button" onClick={() => onNavigate('/search')}>Open Search</button>
          </div>
        </div>

        <div className="hero-art">
          <img src="/legal-intelligence-workflow.svg" alt="Legal intelligence workflow diagram" />
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
          {contracts.slice(0, 3).map((contract) => (
            <ContractCard
              key={contract.id}
              contract={contract}
              isActive={contract.id === selectedContractId}
              onSelect={(contractId) => {
                onSelectContract(contractId);
                onNavigate('/contracts');
              }}
            />
          ))}
        </div>
      </section>
    </>
  );
}

export default OverviewPage;

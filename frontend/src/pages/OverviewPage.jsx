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
    <div style={{ paddingBottom: '60px' }}>
      {/* ── TOP BAR ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <p className="eyebrow" style={{ color: 'var(--lex-cyan-glow)' }}>Lexora Legal Intelligence</p>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '900', color: '#fff', letterSpacing: '-1px' }}>Overview</h1>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <StatusPill status={bootMode === 'live' ? 'ready' : bootMode === 'offline' ? 'error' : 'configure'}>
            {modeLabel}
          </StatusPill>
          <button type="button" className="lex-btn-primary" onClick={() => onNavigate('/intake')}>
            Start Intake
          </button>
        </div>
      </div>

      {/* ── STATUS CLOUD ── */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '40px' }}>
        {[
          { label: 'Mode', status: bootMode === 'live' ? 'ready' : bootMode === 'offline' ? 'error' : 'configure', text: bootMode === 'live' ? 'Live' : bootMode === 'offline' ? 'Offline' : 'Wait' },
          { label: 'Storage', status: health?.firebase?.enabled ? 'ready' : 'configure', text: health?.firebase?.enabled ? 'Structured' : 'Check' },
          { label: 'Indicies', status: health?.pinecone?.enabled ? 'ready' : 'configure', text: health?.pinecone?.enabled ? 'Optimized' : 'Sync' },
          { label: 'Reasoning', status: health?.reasoning?.enabled ? 'ready' : 'configure', text: health?.reasoning?.enabled ? 'Active' : 'Wait' },
        ].map((item) => (
          <div key={item.label} className="panel" style={{ padding: '8px 16px', borderRadius: '100px', display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>{item.label}</span>
            <StatusPill status={item.status}>{item.text}</StatusPill>
          </div>
        ))}
      </div>

      {/* ── HERO BANNER ── */}
      <section className="panel" style={{
        padding: '40px',
        marginBottom: '40px',
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)',
        border: '1px solid rgba(255,255,255,0.15)'
      }}>
        <p className="eyebrow" style={{ marginBottom: '16px' }}>Intelligence Pulse</p>
        <h2 style={{ fontSize: '1.8rem', color: '#fff', maxWidth: '600px', lineHeight: '1.3', fontWeight: '800' }}>
          Calm contract review, grounded in clauses, precedent, and risk signals.
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.6)', maxWidth: '550px', margin: '16px 0 32px', fontSize: '14px' }}>
          Lexora provides a high-fidelity path from document intake to clause-level reasoning and searchable evidence.
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="lex-btn-primary" onClick={() => onNavigate('/intake')}>Start Intake</button>
          <button className="lex-btn-secondary" onClick={() => onNavigate('/contracts')}>Review All Workspace</button>
        </div>
      </section>

      {/* ── DOSSIER GRID ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px', marginBottom: '40px' }}>
        <article className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
            <div>
              <p className="eyebrow" style={{ color: 'var(--lex-cyan-glow)' }}>Active Dossier</p>
              <h3 style={{ fontSize: '1.25rem', color: '#fff', margin: '4px 0', fontWeight: '800' }}>{selectedContract?.title || 'No Selection'}</h3>
            </div>
            <StatusPill status={selectedContract?.status || 'configure'}>{selectedContract?.status || 'N/A'}</StatusPill>
          </div>
          <div style={{ display: 'flex', gap: '32px', borderY: '1px solid rgba(255,255,255,0.1)', padding: '16px 0', marginBottom: '16px' }}>
            <div>
              <p style={{ fontSize: '11px', fontWeight: '900', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.05em' }}>CONTRACTS</p>
              <span style={{ fontSize: '2rem', fontWeight: '900', color: '#fff' }}>{contracts.length}</span>
            </div>
            <div>
              <p style={{ fontSize: '11px', fontWeight: '900', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.05em' }}>HIGH RISK</p>
              <span style={{ fontSize: '2rem', fontWeight: '900', color: 'var(--lex-magenta)' }}>{highRiskCount}</span>
            </div>
            <div>
              <p style={{ fontSize: '11px', fontWeight: '900', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.05em' }}>CLAUSES</p>
              <span style={{ fontSize: '2rem', fontWeight: '900', color: 'var(--lex-cyan)' }}>{clauseCount}</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {['Termination', 'Payment', 'Confidentiality'].map((type) => (
              <div key={type} style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', fontWeight: '700' }}>{type}</span>
                <span style={{ fontSize: '11px', opacity: 0.6 }}>Verified</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <p className="eyebrow">Decision Brief</p>
            <h3 style={{ fontSize: '1.2rem', color: '#fff', margin: '4px 0' }}>Executive Summary</h3>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', marginTop: '12px', lineHeight: '1.6' }}>
              Exposure is concentrated in liability caps and indemnity clauses. Focus on the renewal timelines for the Q3 batch.
            </p>
          </div>
          <div style={{ marginTop: '24px' }}>
            <button className="lex-btn-primary" style={{ width: '100%', marginBottom: '12px' }} onClick={() => onNavigate('/contracts')}>Open Review Workspace</button>
            <button style={{ width: '100%', background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px', padding: '10px' }} onClick={() => onNavigate('/search')}>Audit Index</button>
          </div>
        </article>
      </div>

      {/* ── METRICS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '40px' }}>
        {metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </div>

      {/* ── RECENT CONTRACTS ── */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '1.2rem', color: '#fff' }}>Recent Review Work</h3>
          <button
            className="lex-btn-secondary"
            style={{
              color: 'var(--lex-cyan)',
              fontSize: '12px',
              padding: '6px 14px',
              fontWeight: '900'
            }}
            onClick={() => onNavigate('/contracts')}
          >
            View all workspace documents →
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
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
            <div className="panel" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px', background: 'rgba(255,255,255,0.02)' }}>
              <p style={{ opacity: 0.5 }}>No live contracts are available yet.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default OverviewPage;
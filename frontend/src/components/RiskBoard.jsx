import StatusPill from './StatusPill';

function RiskBoard({ contract }) {
  if (!contract) {
    return (
      <section className="panel" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <p className="eyebrow">Risk Architecture</p>
        <h3 style={{ margin: '16px 0' }}>Select a contract to audit</h3>
        <p style={{ maxWidth: '400px', margin: '0 auto' }}>
          Open a document from your vault to inspect clause-level risk results and legal benchmarks.
        </p>
      </section>
    );
  }

  return (
    <section className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="panel-header" style={{ border: 'none' }}>
        <div>
          <p className="eyebrow">Clause Review</p>
          <h3 style={{ fontSize: '1.8rem' }}>Risk Board</h3>
        </div>
        <StatusPill status={contract.status}>{contract.status.replace(/-/g, ' ')}</StatusPill>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'rgba(255,255,255,0.05)', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px 100px', gap: '20px', padding: '16px 24px', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>
          <span>Clause Content</span>
          <span>Legal Classification</span>
          <span>Risk Level</span>
        </div>

        {(contract.clauses || []).map((clause) => (
          <div
            key={clause.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 180px 100px',
              gap: '20px',
              padding: '20px 24px',
              background: 'rgba(255,255,255,0.02)',
              alignItems: 'center',
              borderTop: '1px solid rgba(255,255,255,0.05)'
            }}
          >
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)', lineHeight: '1.6', margin: 0 }}>{clause.clauseText}</p>
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.5)' }}>
              {clause.clauseLabel || clause.clauseType?.replace(/_/g, ' ')}
            </span>
            <div style={{ justifySelf: 'start' }}>
              <StatusPill status={clause.riskLabel}>{clause.riskLabel}</StatusPill>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default RiskBoard;

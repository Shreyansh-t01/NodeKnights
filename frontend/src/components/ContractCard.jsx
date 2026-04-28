import StatusPill from './StatusPill';

function ContractCard({
  contract,
  isActive,
  onSelect,
  onDelete,
  deletePending = false,
}) {
  return (
    <article
      className={`panel contract-card ${isActive ? 'contract-card-active' : ''}`}
      style={{
        position: 'relative',
        overflow: 'hidden',
        border: isActive ? '1px solid var(--lex-cyan-glow)' : '1px solid rgba(255,255,255,0.15)',
        boxShadow: isActive ? '0 0 20px rgba(0, 229, 255, 0.15)' : 'var(--shadow-glass)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '260px',
        padding: '24px'
      }}
    >
      {/* Active Indicator Glow */}
      {isActive && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '2px',
          background: 'linear-gradient(90deg, transparent, var(--lex-cyan-glow), transparent)'
        }} />
      )}

      <div className="panel-header" style={{ border: 'none', padding: 0, marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--lex-cyan-glow)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="eyebrow" style={{ color: 'var(--lex-cyan-glow)', fontSize: '11px' }}>
              {contract.contractType || 'Legal Document'}
            </p>
            <h3 style={{
              fontSize: '1.25rem',
              margin: '4px 0 0',
              color: '#fff',
              fontWeight: '800',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              lineHeight: '1.2'
            }}>
              {contract.title}
            </h3>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <StatusPill status={contract.status}>{contract.status.replace(/-/g, ' ')}</StatusPill>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', fontWeight: '700' }}>
            ID: {contract.id.slice(0, 8)}
          </span>
        </div>
      </div>

      <div className="contract-card-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', fontWeight: '900', letterSpacing: '0.08em' }}>Risks</span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <span title="High Risk" style={{ color: 'var(--lex-magenta)', fontWeight: '900', fontSize: '14px' }}>{contract.riskCounts.high ?? 0}H</span>
                <span title="Medium Risk" style={{ color: '#fbbf24', fontWeight: '900', fontSize: '14px' }}>{contract.riskCounts.medium ?? 0}M</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', fontWeight: '900', letterSpacing: '0.08em' }}>Clauses</span>
              <span style={{ color: '#fff', fontWeight: '900', fontSize: '14px' }}>{(contract.clauses || []).length}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="lex-btn-primary"
              style={{
                padding: '10px 14px',
                fontSize: '12px',
                fontWeight: '800',
                borderRadius: '10px',
                minWidth: '100px'
              }}
              onClick={() => onSelect(contract.id)}
              disabled={deletePending}
            >
              Analyze
            </button>
            <button
              type="button"
              onClick={() => onDelete(contract.id)}
              disabled={deletePending}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '10px',
                borderRadius: '10px',
                color: 'rgba(255,255,255,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export default ContractCard;

function StatusPill({ status, children }) {
  const toneMap = {
    ready: { bg: 'rgba(6, 182, 212, 0.15)', text: '#00e5ff', glow: '#00e5ff' },
    active: { bg: 'rgba(6, 182, 212, 0.2)', text: '#00e5ff', glow: '#00e5ff' },
    'analysis-ready': { bg: 'rgba(6, 182, 212, 0.2)', text: '#00e5ff', glow: '#00e5ff' },
    complete: { bg: 'rgba(34, 197, 94, 0.2)', text: '#86efac', glow: '#22c55e' },

    'review-required': { bg: 'rgba(240, 40, 122, 0.2)', text: '#f9a8d4', glow: '#f0287a' },
    error: { bg: 'rgba(239, 68, 68, 0.2)', text: '#fca5a5', glow: '#ef4444' },
    failed: { bg: 'rgba(239, 68, 68, 0.2)', text: '#fca5a5', glow: '#ef4444' },
    high: { bg: 'rgba(240, 40, 122, 0.2)', text: '#f9a8d4', glow: '#f0287a' },

    medium: { bg: 'rgba(245, 158, 11, 0.2)', text: '#fcd34d', glow: '#f59e0b' },
    warning: { bg: 'rgba(245, 158, 11, 0.2)', text: '#fcd34d', glow: '#f59e0b' },
    pending: { bg: 'rgba(245, 158, 11, 0.15)', text: '#fcd34d', glow: '#f59e0b' },

    low: { bg: 'rgba(255, 255, 255, 0.1)', text: 'rgba(255,255,255,0.7)', glow: 'transparent' },
    disabled: { bg: 'rgba(255, 255, 255, 0.05)', text: 'rgba(255,255,255,0.4)', glow: 'transparent' },
  };

  const style = toneMap[status] || toneMap.disabled;

  return (
    <span
      className="lex-pill"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: '100px',
        fontSize: '11px',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        background: style.bg,
        color: style.text,
        border: `1px solid ${style.bg}`,
        boxShadow: style.glow !== 'transparent' ? `0 0 10px ${style.glow}33` : 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

export default StatusPill;

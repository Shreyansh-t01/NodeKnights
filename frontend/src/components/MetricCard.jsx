function MetricCard({ metric }) {
  return (
    <article className="panel metric-card" style={{
      flex: 1,
      minWidth: '220px',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      minHeight: '160px',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.06) 100%)'
    }}>
      {/* Decorative Glow */}
      <div style={{
        position: 'absolute',
        top: '-20%',
        right: '-20%',
        width: '60%',
        height: '60%',
        background: 'radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 70%)',
        zIndex: 0,
        pointerEvents: 'none'
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <p className="eyebrow" style={{ color: 'var(--lex-cyan-glow)', opacity: 1, fontSize: '11px', fontWeight: '900' }}>{metric.label}</p>
        <h3 style={{ fontSize: '2.4rem', margin: '12px 0 8px', color: '#fff', fontWeight: '900', letterSpacing: '-1.5px' }}>
          {metric.value}
        </h3>
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <p style={{ fontSize: '13.5px', color: 'rgba(255,255,255,0.85)', fontWeight: '600', lineHeight: '1.4' }}>
          {metric.description}
        </p>
        <div
          style={{
            marginTop: '16px',
            height: '4px',
            width: '100%',
            borderRadius: '2px',
            background: 'rgba(255,255,255,0.1)',
            overflow: 'hidden'
          }}
        >
          <div style={{
            height: '100%',
            width: '40%',
            background: 'linear-gradient(90deg, var(--lex-cyan), var(--lex-purple))',
            boxShadow: '0 0 10px rgba(6,182,212,0.5)'
          }} />
        </div>
      </div>
    </article>
  );
}

export default MetricCard;

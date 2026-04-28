import StatusPill from './StatusPill';

function ConnectorCard({ connector, actionPending = false, onAction }) {
  const showAction = Boolean(connector.actionId && connector.actionLabel && onAction);

  return (
    <article className="panel connector-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="panel-header" style={{ marginBottom: '8px' }}>
        <div>
          <p className="eyebrow" style={{ opacity: 1, fontWeight: '900', fontSize: '11px' }}>SOURCE CONNECTOR</p>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#fff' }}>{connector.title}</h3>
        </div>
        <StatusPill status={connector.status}>{connector.status}</StatusPill>
      </div>

      <p style={{ fontSize: '13.5px', color: 'rgba(255,255,255,0.85)', lineHeight: '1.5', fontWeight: '600' }}>
        {connector.description}
      </p>

      {connector.actionHint && (
        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', fontStyle: 'italic', fontWeight: '500' }}>
          {connector.actionHint}
        </p>
      )}

      {showAction && (
        <button
          type="button"
          className="lex-btn-primary"
          style={{ marginTop: 'auto', padding: '10px 16px', fontSize: '13px' }}
          disabled={actionPending}
          onClick={() => onAction(connector)}
        >
          {actionPending ? (connector.actionPendingLabel || 'Working...') : connector.actionLabel}
        </button>
      )}
    </article>
  );
}

export default ConnectorCard;

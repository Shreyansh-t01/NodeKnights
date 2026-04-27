import StatusPill from './StatusPill';

function ConnectorCard({ connector, actionPending = false, onAction }) {
  const showAction = Boolean(connector.actionId && connector.actionLabel && onAction);

  return (
    <article className="panel connector-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Connector</p>
          <h3>{connector.title}</h3>
        </div>
        <StatusPill status={connector.status}>{connector.status}</StatusPill>
      </div>
      <p>{connector.description}</p>
      {connector.actionHint ? (
        <p className="connector-meta">{connector.actionHint}</p>
      ) : null}
      {showAction ? (
        <button
          type="button"
          className="connector-action"
          disabled={actionPending}
          onClick={() => onAction(connector)}
        >
          {actionPending ? (connector.actionPendingLabel || 'Working...') : connector.actionLabel}
        </button>
      ) : null}
    </article>
  );
}

export default ConnectorCard;

import StatusPill from './StatusPill';

function ConnectorCard({ connector }) {
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
    </article>
  );
}

export default ConnectorCard;

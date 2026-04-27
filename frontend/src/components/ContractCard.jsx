import StatusPill from './StatusPill';

function getInsightPipelineMessage(contract = {}) {
  const step = (contract.pipeline || []).find((item) => item.key === 'insights');

  if (step && ['pending', 'warning', 'failed'].includes(step.status)) {
    return step.detail || 'Gemini insights are not generated yet for this contract.';
  }

  return '';
}

function ContractCard({
  contract,
  isActive,
  onSelect,
  onDelete,
  deletePending = false,
}) {
  return (
    <article className={`panel contract-card ${isActive ? 'contract-card-active' : ''}`}>
      <div className="panel-header">
        <div>
          <p className="eyebrow">{contract.source}</p>
          <h3>{contract.title}</h3>
        </div>
        <StatusPill status={contract.status}>{contract.status.replace(/-/g, ' ')}</StatusPill>
      </div>
      <p className="contract-type">{contract.contractType}</p>
      <p className="contract-meta">
        Parties: {contract.parties.length ? contract.parties.join(', ') : 'Not extracted yet'}
      </p>
      <p className="contract-meta">
        Dates: {contract.dates.length ? contract.dates.join(', ') : 'Awaiting extraction'}
      </p>
      {getInsightPipelineMessage(contract) ? (
        <p className="contract-meta contract-insight-note">
          {getInsightPipelineMessage(contract)}
        </p>
      ) : null}
      <div className="contract-card-footer">
        <div className="risk-strip">
          <span>Low {contract.riskCounts.low ?? 0}</span>
          <span>Medium {contract.riskCounts.medium ?? 0}</span>
          <span>High {contract.riskCounts.high ?? 0}</span>
        </div>

        <div className="contract-card-actions">
          <button
            type="button"
            className="contract-card-open"
            onClick={() => onSelect(contract.id)}
            disabled={deletePending}
          >
            Open Contract
          </button>
          <button
            type="button"
            className="contract-card-delete"
            onClick={() => onDelete(contract.id)}
            disabled={deletePending}
          >
            {deletePending ? 'Deleting...' : 'Delete Document'}
          </button>
        </div>
      </div>
    </article>
  );
}

export default ContractCard;

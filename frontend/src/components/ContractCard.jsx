import StatusPill from './StatusPill';

function ContractCard({ contract, isActive, onSelect }) {
  return (
    <button
      type="button"
      className={`panel contract-card ${isActive ? 'contract-card-active' : ''}`}
      onClick={() => onSelect(contract.id)}
    >
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
      <div className="risk-strip">
        <span>Low {contract.riskCounts.low ?? 0}</span>
        <span>Medium {contract.riskCounts.medium ?? 0}</span>
        <span>High {contract.riskCounts.high ?? 0}</span>
      </div>
    </button>
  );
}

export default ContractCard;

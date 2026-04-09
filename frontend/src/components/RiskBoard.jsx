import StatusPill from './StatusPill';

function RiskBoard({ contract }) {
  if (!contract) {
    return (
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Clause Review</p>
            <h3>Clause-level risk board</h3>
          </div>
        </div>

        <p className="empty-state">
          Upload and select a contract to inspect clause-level risk results.
        </p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Clause Review</p>
          <h3>Clause-level risk board</h3>
        </div>
        <StatusPill status={contract.status}>{contract.status.replace(/-/g, ' ')}</StatusPill>
      </div>

      <div className="clause-table">
        <div className="clause-table-head">
          <span>Clause</span>
          <span>Type</span>
          <span>Risk</span>
        </div>

        {(contract.clauses || []).map((clause) => (
          <div className="clause-row" key={clause.id}>
            <p>{clause.clauseText}</p>
            <span>{clause.clauseLabel || clause.clauseType?.replace(/_/g, ' ')}</span>
            <StatusPill status={clause.riskLabel}>{clause.riskLabel}</StatusPill>
          </div>
        ))}
      </div>
    </section>
  );
}

export default RiskBoard;

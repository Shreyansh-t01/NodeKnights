import { useState } from 'react';

import StatusPill from './StatusPill';

function formatClauseLabel(clause) {
  return clause.clauseLabel || clause.clauseType?.replace(/_/g, ' ') || 'Clause';
}

function formatExtractedValues(extractedValues = {}) {
  const entries = Object.entries(extractedValues).filter(([, value]) => {
    if (Array.isArray(value)) {
      return value.length > 0;
    }

    return value !== null && value !== undefined && value !== '';
  });

  if (!entries.length) {
    return 'No extracted values recorded for this clause yet.';
  }

  return entries.map(([key, value]) => {
    const label = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();
    const normalizedValue = Array.isArray(value) ? value.join(', ') : String(value);
    return `${label}: ${normalizedValue}`;
  }).join(' | ');
}

function ContractReviewCard({
  contract,
  isExpanded,
  selectedContract,
  onToggleExpand,
}) {
  const [openClauseId, setOpenClauseId] = useState(null);

  const detailContract = isExpanded && selectedContract?.id === contract.id
    ? selectedContract
    : contract;

  const clauses = detailContract?.clauses || [];
  const isDetailLoaded = selectedContract?.id === contract.id;

  function handleClauseToggle(clauseId) {
    setOpenClauseId((current) => (current === clauseId ? null : clauseId));
  }

  return (
    <article className={`panel contract-review-card ${isExpanded ? 'contract-review-card-active' : ''}`}>
      <div className="contract-review-header">
        <div>
          <p className="eyebrow">{contract.source}</p>
          <h3>{contract.title}</h3>
        </div>
        <StatusPill status={contract.status}>{contract.status.replace(/-/g, ' ')}</StatusPill>
      </div>

      <div className="contract-review-meta-grid">
        <p className="contract-meta">
          Type: {contract.contractType}
        </p>
        <p className="contract-meta">
          Parties: {contract.parties.length ? contract.parties.join(', ') : 'Not extracted yet'}
        </p>
        <p className="contract-meta">
          Dates: {contract.dates.length ? contract.dates.join(', ') : 'Awaiting extraction'}
        </p>
        <p className="contract-meta">
          Preview: {contract.textPreview || 'No preview available yet.'}
        </p>
      </div>

      <div className="contract-review-stat-row">
        <div className="risk-strip">
          <span>Low {contract.riskCounts.low ?? 0}</span>
          <span>Medium {contract.riskCounts.medium ?? 0}</span>
          <span>High {contract.riskCounts.high ?? 0}</span>
        </div>

        <button type="button" className="contract-review-toggle" onClick={onToggleExpand}>
          {isExpanded ? 'Hide Clause Review' : 'View Clause Review'}
        </button>
      </div>

      {isExpanded ? (
        <div className="contract-review-body">
          <div className="contract-review-body-head">
            <div>
              <p className="eyebrow">Clause Review</p>
              <h4>Risk board attached to this contract</h4>
            </div>
            <span className="mode-label">{clauses.length} clause{clauses.length === 1 ? '' : 's'}</span>
          </div>

          {clauses.length ? (
            <div className="contract-clause-list">
              {clauses.map((clause) => {
                const isClauseOpen = openClauseId === clause.id;

                return (
                  <div key={clause.id} className="contract-clause-item">
                    <div className="contract-clause-row">
                      <div className="contract-clause-copy">
                        <strong>{formatClauseLabel(clause)}</strong>
                        <p>{clause.clauseTextSummary || clause.clauseText}</p>
                      </div>

                      <div className="contract-clause-actions">
                        <StatusPill status={clause.riskLabel}>{clause.riskLabel}</StatusPill>
                        <button
                          type="button"
                          className="clause-action-button"
                          onClick={() => handleClauseToggle(clause.id)}
                        >
                          {isClauseOpen ? 'Hide Risk Board' : 'View Risk Board'}
                        </button>
                      </div>
                    </div>

                    {isClauseOpen ? (
                      <div className="contract-clause-board">
                        <div className="contract-clause-board-grid">
                          <p>
                            <strong>Risk score:</strong> {clause.riskScore ?? 'Not scored'}
                          </p>
                          <p>
                            <strong>Type:</strong> {formatClauseLabel(clause)}
                          </p>
                          <p className="contract-clause-board-full">
                            <strong>Clause text:</strong> {clause.clauseTextFull || clause.clauseTextSummary || clause.clauseText}
                          </p>
                          <p>
                            <strong>Extracted values:</strong> {formatExtractedValues(clause.extractedValues)}
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="empty-state">
              {isDetailLoaded
                ? 'No clause review data is available for this contract yet.'
                : 'Loading clause review for this contract.'}
            </p>
          )}
        </div>
      ) : null}
    </article>
  );
}

export default ContractReviewCard;

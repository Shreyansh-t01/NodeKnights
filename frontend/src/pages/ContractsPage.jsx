import { useState } from 'react';

import ContractReviewCard from '../components/ContractReviewCard';

function ContractsPage({
  contracts,
  selectedContractId,
  selectedContract,
  onSelectContract,
}) {
  const [expandedContractId, setExpandedContractId] = useState(selectedContractId || null);

  function handleToggleExpand(contractId) {
    setExpandedContractId((current) => {
      if (current === contractId) {
        return null;
      }

      onSelectContract(contractId);
      return contractId;
    });
  }

  return (
    <section className="contracts-route route-grid">
      <section className="panel contracts-route-header">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Contracts</p>
            <h3>Tracked contracts</h3>
          </div>
        </div>

        <p className="contract-meta">
          Each tracked contract now carries its own clause-level review. Open a contract, then open any clause dropdown to inspect that clause risk board.
        </p>
      </section>

      <div className="contract-review-list">
        {contracts.length ? (
          contracts.map((contract) => (
            <ContractReviewCard
              key={contract.id}
              contract={contract}
              isExpanded={expandedContractId === contract.id}
              selectedContract={selectedContract}
              onToggleExpand={() => handleToggleExpand(contract.id)}
            />
          ))
        ) : (
          <section className="panel">
            <p className="empty-state">
              No contracts are available yet. Upload one from the Intake page to start the review flow.
            </p>
          </section>
        )}
      </div>
    </section>
  );
}

export default ContractsPage;

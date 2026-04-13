import { useEffect, useState } from 'react';

import ContractReviewCard from '../components/ContractReviewCard';

function ContractsPage({
  contracts,
  selectedContractId,
  selectedContract,
  onSelectContract,
  onOpenInsights,
  onDeleteContract,
  deletingContractId,
}) {
  const [expandedContractId, setExpandedContractId] = useState(selectedContractId || null);

  useEffect(() => {
    if (expandedContractId && !contracts.some((contract) => contract.id === expandedContractId)) {
      setExpandedContractId(selectedContractId || null);
    }
  }, [contracts, expandedContractId, selectedContractId]);

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
          Each tracked contract now carries its own clause-level review. Open a contract to inspect the clause board, or jump straight into side-by-side AI insights from the card itself.
        </p>
      </section>

      <div className="contract-review-list">
        {contracts.length ? (
          contracts.map((contract) => (
            <ContractReviewCard
              key={contract.id}
              contract={contract}
              deletePending={deletingContractId === contract.id}
              isExpanded={expandedContractId === contract.id}
              selectedContract={selectedContract}
              onDelete={() => onDeleteContract(contract.id)}
              onToggleExpand={() => handleToggleExpand(contract.id)}
              onOpenInsights={() => onOpenInsights(contract.id)}
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

import ContractCard from '../components/ContractCard';
import RiskBoard from '../components/RiskBoard';
import WorkflowPanel from '../components/WorkflowPanel';

function ContractsPage({
  contracts,
  selectedContractId,
  selectedContract,
  onSelectContract,
}) {
  return (
    <section className="workspace-grid route-grid">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Contracts</p>
            <h3>Tracked agreements</h3>
          </div>
        </div>

        <div className="contract-list">
          {contracts.length ? (
            contracts.map((contract) => (
              <ContractCard
                key={contract.id}
                contract={contract}
                isActive={contract.id === selectedContractId}
                onSelect={onSelectContract}
              />
            ))
          ) : (
            <p className="empty-state">
              No contracts are available yet. Upload one from the Intake page to start the workflow.
            </p>
          )}
        </div>
      </section>

      <div className="workspace-stack">
        <WorkflowPanel contract={selectedContract} />
        <RiskBoard contract={selectedContract} />
      </div>
    </section>
  );
}

export default ContractsPage;

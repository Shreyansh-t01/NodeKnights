import ContractCard from '../components/ContractCard';
import ContractInsightsPanel from '../components/ContractInsightsPanel';

function InsightsPage({
  contracts,
  selectedContractId,
  selectedContract,
  insights,
  insightsPending,
  onSelectContract,
}) {
  return (
    <section className="workspace-grid route-grid">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">AI Insights</p>
            <h3>Select a contract</h3>
          </div>
        </div>

        <div className="contract-list">
          {contracts.map((contract) => (
            <ContractCard
              key={contract.id}
              contract={contract}
              isActive={contract.id === selectedContractId}
              onSelect={onSelectContract}
            />
          ))}
        </div>
      </section>

      <ContractInsightsPanel
        contract={selectedContract}
        insights={insights}
        pending={insightsPending}
      />
    </section>
  );
}

export default InsightsPage;

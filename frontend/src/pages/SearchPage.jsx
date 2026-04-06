import ContractCard from '../components/ContractCard';
import SearchWorkbench from '../components/SearchWorkbench';

function SearchPage({
  contracts,
  selectedContractId,
  selectedContract,
  query,
  deferredQuery,
  searchPending,
  searchResult,
  onSelectContract,
  onQueryChange,
  onSubmit,
  modeLabel,
}) {
  return (
    <section className="workspace-grid route-grid">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Search Scope</p>
            <h3>Choose a contract</h3>
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

      <div className="workspace-stack">
        <section className="panel contract-context-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Selected Contract</p>
              <h3>{selectedContract.title}</h3>
            </div>
          </div>
          <p className="contract-meta">
            Type: {selectedContract.contractType}
          </p>
          <p className="contract-meta">
            Parties: {selectedContract.parties.length ? selectedContract.parties.join(', ') : 'Not extracted yet'}
          </p>
          <p className="contract-meta">
            Preview: {selectedContract.textPreview || 'No preview available yet.'}
          </p>
        </section>

        <SearchWorkbench
          query={query}
          deferredQuery={deferredQuery}
          pending={searchPending}
          result={searchResult}
          onQueryChange={onQueryChange}
          onSubmit={onSubmit}
          modeLabel={modeLabel}
        />
      </div>
    </section>
  );
}

export default SearchPage;

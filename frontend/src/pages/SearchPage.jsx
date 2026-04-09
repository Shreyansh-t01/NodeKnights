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
              No indexed contracts are available yet. Upload one to enable semantic search.
            </p>
          )}
        </div>
      </section>

      <div className="workspace-stack">
        <section className="panel contract-context-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Selected Contract</p>
              <h3>{selectedContract?.title || 'No contract selected'}</h3>
            </div>
          </div>
          {selectedContract ? (
            <>
              <p className="contract-meta">
                Type: {selectedContract.contractType}
              </p>
              <p className="contract-meta">
                Parties: {selectedContract.parties.length ? selectedContract.parties.join(', ') : 'Not extracted yet'}
              </p>
              <p className="contract-meta">
                Preview: {selectedContract.textPreview || 'No preview available yet.'}
              </p>
            </>
          ) : (
            <p className="empty-state">
              Upload a contract from Intake to scope semantic search to a live document.
            </p>
          )}
        </section>

        <SearchWorkbench
          query={query}
          deferredQuery={deferredQuery}
          pending={searchPending}
          result={searchResult}
          disabled={!contracts.length}
          onQueryChange={onQueryChange}
          onSubmit={onSubmit}
          modeLabel={modeLabel}
        />
      </div>
    </section>
  );
}

export default SearchPage;

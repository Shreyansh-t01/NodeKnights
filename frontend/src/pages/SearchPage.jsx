import { useMemo, useState } from 'react';

import SearchWorkbench from '../components/SearchWorkbench';

function SearchPage({
  contracts,
  selectedContractId,
  selectedContract,
  query,
  deferredQuery,
  searchPending,
  searchResult,
  searchError,
  onSelectContract,
  onQueryChange,
  onSubmit,
  modeLabel,
}) {
  const [scopeQuery, setScopeQuery] = useState('');

  const filteredContracts = useMemo(() => {
    const normalized = scopeQuery.trim().toLowerCase();

    if (!normalized) {
      return contracts;
    }

    return contracts.filter((contract) => (
      String(contract.title || '').toLowerCase().includes(normalized)
    ));
  }, [contracts, scopeQuery]);

  return (
    <section className="workspace-grid route-grid">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Search Scope</p>
            <h3>Choose a contract</h3>
          </div>
        </div>

        <label htmlFor="contract-scope-search" className="search-label">
          Find a contract
        </label>
        <div className="scope-search-row">
          <input
            id="contract-scope-search"
            value={scopeQuery}
            onChange={(event) => setScopeQuery(event.target.value)}
            placeholder="Search by contract name"
          />
        </div>

        <div className="contract-scope-list">
          {contracts.length ? (
            filteredContracts.length ? (
              filteredContracts.map((contract) => (
                <button
                  key={contract.id}
                  type="button"
                  className={`contract-scope-item ${contract.id === selectedContractId ? 'contract-scope-item-active' : ''}`}
                  onClick={() => onSelectContract(contract.id)}
                >
                  <span className="contract-scope-name">{contract.title}</span>
                </button>
              ))
            ) : (
              <p className="empty-state">
                No contract names matched "{scopeQuery}".
              </p>
            )
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
            <p className="contract-meta">
              Semantic search is currently scoped to this contract only.
            </p>
          ) : (
            <p className="empty-state">
              Choose a contract name from the left to scope semantic search.
            </p>
          )}
        </section>

        <SearchWorkbench
          query={query}
          deferredQuery={deferredQuery}
          pending={searchPending}
          result={searchResult}
          error={searchError}
          disabled={!contracts.length || !selectedContractId}
          disabledMessage={
            contracts.length
              ? 'Choose a contract name from the left to enable scoped semantic search.'
              : 'Upload a contract to enable live semantic search.'
          }
          scopeLabel={selectedContract?.title || ''}
          onQueryChange={onQueryChange}
          onSubmit={onSubmit}
          modeLabel={modeLabel}
        />
      </div>
    </section>
  );
}

export default SearchPage;

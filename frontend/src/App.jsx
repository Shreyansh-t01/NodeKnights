import { startTransition, useDeferredValue, useEffect, useState } from 'react';

import MetricCard from './components/MetricCard';
import ConnectorCard from './components/ConnectorCard';
import ContractCard from './components/ContractCard';
import RiskBoard from './components/RiskBoard';
import SearchWorkbench from './components/SearchWorkbench';
import UploadPanel from './components/UploadPanel';
import StatusPill from './components/StatusPill';
import { api } from './lib/api';
import {
  dashboardMetrics,
  connectorCards,
  sampleContracts,
  buildMockSearchResult,
} from './data/mockData';

function normalizeContractSummary(contract) {
  return {
    id: contract.id,
    title: contract.title,
    source: contract.source,
    status: contract.status,
    contractType: contract.metadata?.contractType || contract.contractType || 'Contract',
    parties: contract.metadata?.parties || contract.parties || [],
    dates: contract.metadata?.dates || contract.dates || [],
    riskCounts: contract.metadata?.riskCounts || contract.riskCounts || { low: 0, medium: 0, high: 0 },
    pipeline: contract.pipeline || [],
    clauses: contract.clauses || [],
    textPreview: contract.textPreview || '',
  };
}

function normalizeContractDetail(bundle) {
  const summary = normalizeContractSummary(bundle.contract);

  return {
    ...summary,
    clauses: bundle.clauses || [],
    risks: bundle.risks || [],
    pipeline: bundle.contract?.pipeline || [],
  };
}

function buildConnectorState(health) {
  return connectorCards.map((connector) => {
    if (!health) {
      return connector;
    }

    if (connector.key === 'google-drive' || connector.key === 'gmail') {
      return {
        ...connector,
        status: health.googleConnectors?.enabled ? 'ready' : 'configure',
      };
    }

    return connector;
  });
}

function App() {
  const [health, setHealth] = useState(null);
  const [contracts, setContracts] = useState(sampleContracts);
  const [selectedContractId, setSelectedContractId] = useState(sampleContracts[0].id);
  const [selectedContract, setSelectedContract] = useState(sampleContracts[0]);
  const [bootMode, setBootMode] = useState('loading');
  const [query, setQuery] = useState('What makes the termination clause risky, and what should we change?');
  const [searchResult, setSearchResult] = useState(
    buildMockSearchResult('What makes the termination clause risky, and what should we change?', sampleContracts[0]),
  );
  const [searchPending, setSearchPending] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    let ignore = false;

    async function hydrateDashboard() {
      const [healthResult, contractsResult] = await Promise.allSettled([
        api.getHealth(),
        api.getContracts(),
      ]);

      if (ignore) {
        return;
      }

      startTransition(() => {
        const isLive = healthResult.status === 'fulfilled' || contractsResult.status === 'fulfilled';

        if (healthResult.status === 'fulfilled') {
          setHealth(healthResult.value.services);
        }

        if (
          contractsResult.status === 'fulfilled'
          && Array.isArray(contractsResult.value.data)
          && contractsResult.value.data.length
        ) {
          const normalizedContracts = contractsResult.value.data.map(normalizeContractSummary);
          setContracts(normalizedContracts);
          setSelectedContractId(normalizedContracts[0].id);
        }

        setBootMode(isLive ? 'live' : 'mock');
      });
    }

    hydrateDashboard();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    const summary = contracts.find((contract) => contract.id === selectedContractId) || sampleContracts[0];

    if (summary.clauses?.length) {
      setSelectedContract(summary);
      return undefined;
    }

    async function hydrateContractDetails() {
      try {
        const response = await api.getContractById(selectedContractId);

        if (!ignore) {
          startTransition(() => {
            setSelectedContract(normalizeContractDetail(response.data));
          });
        }
      } catch (error) {
        if (!ignore) {
          startTransition(() => {
            setSelectedContract(summary);
          });
        }
      }
    }

    hydrateContractDetails();

    return () => {
      ignore = true;
    };
  }, [contracts, selectedContractId]);

  async function handleSemanticSearch(event) {
    event.preventDefault();
    setSearchPending(true);

    try {
      const response = await api.semanticSearch({
        query,
        contractId: selectedContractId,
        topK: 5,
      });

      startTransition(() => {
        setSearchResult(response.data);
      });
    } catch (error) {
      startTransition(() => {
        setSearchResult(buildMockSearchResult(deferredQuery || query, selectedContract));
      });
    } finally {
      setSearchPending(false);
    }
  }

  async function handleUpload() {
    if (!uploadFile) {
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);

      const response = await api.uploadContract(formData);
      const uploadedContract = normalizeContractDetail({
        contract: response.data.contract,
        clauses: response.data.clauses,
        risks: response.data.risks,
      });

      startTransition(() => {
        setContracts((current) => [uploadedContract, ...current.filter((item) => item.id !== uploadedContract.id)]);
        setSelectedContractId(uploadedContract.id);
        setSelectedContract(uploadedContract);
        setBootMode('live');
        setUploadFile(null);
      });
    } catch (error) {
      console.error(error);
    } finally {
      setUploading(false);
    }
  }

  const connectors = buildConnectorState(health);
  const modeLabel = bootMode === 'live' ? 'Live backend mode' : bootMode === 'mock' ? 'Mock preview mode' : 'Connecting';

  return (
    <main className="app-shell">
      <section className="hero panel">
        <div className="hero-copy">
          <p className="eyebrow">Legal Intelligence System</p>
          <h1>Contracts flow through one readable pipeline instead of scattered tools.</h1>
          <p className="hero-text">
            This dashboard separates raw storage, intelligence, semantic search, and reasoning so your team can inspect
            contract risk at the clause level and move from extraction to action quickly.
          </p>
          <div className="hero-pills">
            <StatusPill status={bootMode === 'live' ? 'ready' : 'fallback'}>{modeLabel}</StatusPill>
            <StatusPill status={health?.firebase?.enabled ? 'ready' : 'fallback'}>
              {health?.firebase?.enabled ? 'Firebase configured' : 'Local fallback storage'}
            </StatusPill>
            <StatusPill status={health?.pinecone?.enabled ? 'ready' : 'fallback'}>
              {health?.pinecone?.enabled ? 'Pinecone live' : 'Local vector fallback'}
            </StatusPill>
          </div>
        </div>

        <div className="hero-art">
          <img src="/legal-intelligence-workflow.svg" alt="Legal intelligence workflow diagram" />
        </div>
      </section>

      <section className="metrics-grid">
        {dashboardMetrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </section>

      <section className="two-column">
        <UploadPanel
          selectedFileName={uploadFile?.name}
          uploading={uploading}
          onFileChange={(event) => setUploadFile(event.target.files?.[0] || null)}
          onUpload={handleUpload}
        />

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Sources</p>
              <h3>Ingestion connectors</h3>
            </div>
          </div>
          <div className="connector-grid">
            {connectors.map((connector) => (
              <ConnectorCard key={connector.key} connector={connector} />
            ))}
          </div>
        </section>
      </section>

      <section className="workspace-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Contracts</p>
              <h3>Tracked agreements</h3>
            </div>
          </div>

          <div className="contract-list">
            {contracts.map((contract) => (
              <ContractCard
                key={contract.id}
                contract={contract}
                isActive={contract.id === selectedContractId}
                onSelect={setSelectedContractId}
              />
            ))}
          </div>
        </section>

        <div className="workspace-stack">
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Workflow</p>
                <h3>{selectedContract.title}</h3>
              </div>
            </div>

            <div className="timeline">
              {(selectedContract.pipeline || []).map((step) => (
                <div key={step.key} className="timeline-item">
                  <span className="timeline-dot" />
                  <div>
                    <h4>{step.label}</h4>
                    <p>{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <RiskBoard contract={selectedContract} />
        </div>
      </section>

      <SearchWorkbench
        query={query}
        deferredQuery={deferredQuery}
        pending={searchPending}
        result={searchResult}
        onQueryChange={setQuery}
        onSubmit={handleSemanticSearch}
        modeLabel={modeLabel}
      />
    </main>
  );
}

export default App;

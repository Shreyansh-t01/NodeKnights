import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react';

import AppNav from './components/AppNav';
import { api } from './lib/api';
import {
  dashboardMetrics,
  connectorCards,
  sampleContracts,
  buildMockSearchResult,
  buildMockContractInsights,
} from './data/mockData';
import OverviewPage from './pages/OverviewPage';
import IntakePage from './pages/IntakePage';
import ContractsPage from './pages/ContractsPage';
import InsightsPage from './pages/InsightsPage';
import SearchPage from './pages/SearchPage';

const KNOWN_ROUTES = new Set(['/', '/intake', '/contracts', '/insights', '/search']);

function normalizePath(pathname) {
  if (!pathname || pathname === '/') {
    return '/';
  }

  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

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
    risks: contract.risks || [],
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

function buildLiveMetrics(contracts) {
  const highRiskCount = contracts.reduce((sum, contract) => sum + (contract.riskCounts?.high || 0), 0);
  const clauseCount = contracts.reduce((sum, contract) => sum + ((contract.clauses || []).length || 0), 0);

  return dashboardMetrics.map((metric) => {
    if (metric.label === 'Review Priority') {
      return {
        ...metric,
        value: `${highRiskCount} High Risks`,
      };
    }

    if (metric.label === 'Search Context') {
      return {
        ...metric,
        value: `${clauseCount || 0} Clauses`,
      };
    }

    return metric;
  });
}

function App() {
  const [currentPath, setCurrentPath] = useState(normalizePath(window.location.pathname));
  const [health, setHealth] = useState(null);
  const [contracts, setContracts] = useState(sampleContracts);
  const [selectedContractId, setSelectedContractId] = useState(sampleContracts[0].id);
  const [selectedContract, setSelectedContract] = useState(sampleContracts[0]);
  const [contractInsights, setContractInsights] = useState(buildMockContractInsights(sampleContracts[0]));
  const [insightsPending, setInsightsPending] = useState(false);
  const [bootMode, setBootMode] = useState('loading');
  const [query, setQuery] = useState('What makes the termination clause risky, and what should we change?');
  const [searchResult, setSearchResult] = useState(
    buildMockSearchResult('What makes the termination clause risky, and what should we change?', sampleContracts[0]),
  );
  const [searchPending, setSearchPending] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const deferredQuery = useDeferredValue(query);

  const safePath = KNOWN_ROUTES.has(currentPath) ? currentPath : '/';
  const connectors = buildConnectorState(health);
  const metrics = useMemo(() => buildLiveMetrics(contracts), [contracts]);
  const modeLabel = bootMode === 'live' ? 'Live backend mode' : bootMode === 'mock' ? 'Mock preview mode' : 'Connecting';

  function navigate(path) {
    const normalized = normalizePath(path);
    window.history.pushState({}, '', normalized);
    setCurrentPath(normalized);
  }

  useEffect(() => {
    function handlePopState() {
      setCurrentPath(normalizePath(window.location.pathname));
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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

  useEffect(() => {
    let ignore = false;

    async function hydrateInsights() {
      setInsightsPending(true);

      try {
        const response = await api.getContractInsights(selectedContractId);

        if (!ignore) {
          startTransition(() => {
            setContractInsights(response.data);
          });
        }
      } catch (error) {
        const fallbackContract = contracts.find((contract) => contract.id === selectedContractId) || selectedContract;

        if (!ignore) {
          startTransition(() => {
            setContractInsights(buildMockContractInsights(fallbackContract));
          });
        }
      } finally {
        if (!ignore) {
          setInsightsPending(false);
        }
      }
    }

    hydrateInsights();

    return () => {
      ignore = true;
    };
  }, [contracts, selectedContract, selectedContractId]);

  useEffect(() => {
    const titles = {
      '/': 'Overview',
      '/intake': 'Intake',
      '/contracts': 'Contracts',
      '/insights': 'Insights',
      '/search': 'Search',
    };

    document.title = `Legal Intelligence | ${titles[safePath] || 'Overview'}`;
  }, [safePath]);

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
        setContractInsights(response.data.insights || buildMockContractInsights(uploadedContract));
        setBootMode('live');
        setUploadFile(null);
      });

      navigate('/insights');
    } catch (error) {
      console.error(error);
    } finally {
      setUploading(false);
    }
  }

  const pageProps = {
    contracts,
    selectedContractId,
    selectedContract,
    onSelectContract: setSelectedContractId,
  };

  let page = null;

  if (safePath === '/intake') {
    page = (
      <IntakePage
        connectors={connectors}
        uploadFile={uploadFile}
        uploading={uploading}
        onFileChange={(event) => setUploadFile(event.target.files?.[0] || null)}
        onUpload={handleUpload}
      />
    );
  } else if (safePath === '/contracts') {
    page = <ContractsPage {...pageProps} />;
  } else if (safePath === '/insights') {
    page = (
      <InsightsPage
        {...pageProps}
        insights={contractInsights}
        insightsPending={insightsPending}
      />
    );
  } else if (safePath === '/search') {
    page = (
      <SearchPage
        {...pageProps}
        query={query}
        deferredQuery={deferredQuery}
        searchPending={searchPending}
        searchResult={searchResult}
        onQueryChange={setQuery}
        onSubmit={handleSemanticSearch}
        modeLabel={modeLabel}
      />
    );
  } else {
    page = (
      <OverviewPage
        bootMode={bootMode}
        health={health}
        metrics={metrics}
        contracts={contracts}
        selectedContractId={selectedContractId}
        onSelectContract={setSelectedContractId}
        onNavigate={navigate}
      />
    );
  }

  return (
    <main className="app-shell">
      <AppNav currentPath={safePath} onNavigate={navigate} modeLabel={modeLabel} />
      {page}
    </main>
  );
}

export default App;

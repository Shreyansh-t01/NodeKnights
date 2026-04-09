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

function buildEmptyInsights(contract = null) {
  if (!contract) {
    return {
      headline: 'Upload a contract to generate AI insights.',
      summary: 'The insights workspace will populate after a live contract is processed by the backend.',
      topRiskItems: [],
      nextSteps: ['Open Intake and upload a contract to start the analysis pipeline.'],
      clauseInsights: [],
    };
  }

  return {
    headline: `${contract.title} is ready for review.`,
    summary: 'No live insight response is available yet for this contract.',
    topRiskItems: [],
    nextSteps: [
      'Refresh this view after processing completes.',
      'Run semantic search to inspect clause language manually.',
    ],
    clauseInsights: [],
  };
}

function buildEmptySearchResult(query = '') {
  return {
    query,
    matches: [],
    reasoning: {
      answer: query
        ? 'No live search results are available yet. Upload at least one contract and try again.'
        : 'Search results will appear here once the backend has indexed contract clauses.',
      recommendations: ['Upload a contract from Intake to seed the search index.'],
      supportingMatches: [],
    },
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
  const [contracts, setContracts] = useState([]);
  const [selectedContractId, setSelectedContractId] = useState(null);
  const [selectedContract, setSelectedContract] = useState(null);
  const [contractInsights, setContractInsights] = useState(() => buildEmptyInsights());
  const [insightsPending, setInsightsPending] = useState(false);
  const [bootMode, setBootMode] = useState('loading');
  const [query, setQuery] = useState('What makes the termination clause risky, and what should we change?');
  const [searchResult, setSearchResult] = useState(null);
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
        const healthConnected = healthResult.status === 'fulfilled';
        const contractsConnected = (
          contractsResult.status === 'fulfilled'
          && Array.isArray(contractsResult.value.data)
        );

        if (!healthConnected && !contractsConnected) {
          setHealth(null);
          setContracts(sampleContracts);
          setSelectedContractId(sampleContracts[0].id);
          setSelectedContract(sampleContracts[0]);
          setContractInsights(buildMockContractInsights(sampleContracts[0]));
          setSearchResult(buildMockSearchResult(query, sampleContracts[0]));
          setBootMode('mock');
          return;
        }

        if (healthConnected) {
          setHealth(healthResult.value.services);
        } else {
          setHealth(null);
        }

        if (contractsConnected) {
          const normalizedContracts = contractsResult.value.data.map(normalizeContractSummary);
          setContracts(normalizedContracts);

          if (normalizedContracts.length) {
            setSelectedContractId((currentId) => (
              normalizedContracts.some((contract) => contract.id === currentId)
                ? currentId
                : normalizedContracts[0].id
            ));
          } else {
            setSelectedContractId(null);
            setSelectedContract(null);
            setContractInsights(buildEmptyInsights());
            setSearchResult(buildEmptySearchResult(query));
          }
        } else {
          setContracts([]);
          setSelectedContractId(null);
          setSelectedContract(null);
          setContractInsights(buildEmptyInsights());
          setSearchResult(buildEmptySearchResult(query));
        }

        setBootMode('live');
      });
    }

    hydrateDashboard();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    const summary = contracts.find((contract) => contract.id === selectedContractId) || null;

    if (!selectedContractId || !summary) {
      setSelectedContract(null);
      return undefined;
    }

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

    if (!selectedContractId) {
      setInsightsPending(false);
      setContractInsights(buildEmptyInsights());
      return undefined;
    }

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
            if (bootMode === 'mock' && fallbackContract) {
              setContractInsights(buildMockContractInsights(fallbackContract));
              return;
            }

            setContractInsights(buildEmptyInsights(fallbackContract));
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
  }, [bootMode, contracts, selectedContract, selectedContractId]);

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
    const activeContract = selectedContract || contracts.find((contract) => contract.id === selectedContractId) || null;

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
        if (bootMode === 'mock' && activeContract) {
          setSearchResult(buildMockSearchResult(deferredQuery || query, activeContract));
          return;
        }

        setSearchResult(buildEmptySearchResult(deferredQuery || query));
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
        setContractInsights(response.data.insights || buildEmptyInsights(uploadedContract));
        setSearchResult(buildEmptySearchResult(query));
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

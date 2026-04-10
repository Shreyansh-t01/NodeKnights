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
import DocumentsPage from './pages/DocumentsPage';

const KNOWN_ROUTES = new Set(['/', '/intake', '/contracts', '/insights', '/search', '/documents']);

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
    metadata: contract.metadata || {},
    originalName: contract.metadata?.originalName || contract.originalName || contract.title,
    mimeType: contract.metadata?.mimeType || contract.mimeType || '',
    contractType: contract.metadata?.contractType || contract.contractType || 'Contract',
    parties: contract.metadata?.parties || contract.parties || [],
    dates: contract.metadata?.dates || contract.dates || [],
    riskCounts: contract.metadata?.riskCounts || contract.riskCounts || { low: 0, medium: 0, high: 0 },
    pipeline: contract.pipeline || [],
    clauses: contract.clauses || [],
    risks: contract.risks || [],
    textPreview: contract.textPreview || '',
    artifacts: contract.artifacts || {},
    createdAt: contract.createdAt || null,
    updatedAt: contract.updatedAt || contract.createdAt || null,
  };
}

function normalizeContractDetail(bundle) {
  const summary = normalizeContractSummary(bundle.contract);

  return {
    ...summary,
    clauses: bundle.clauses || [],
    risks: bundle.risks || [],
    pipeline: bundle.contract?.pipeline || [],
    artifacts: bundle.contract?.artifacts || summary.artifacts || {},
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

function getDocumentPreviewMode(mimeType = '') {
  if (mimeType === 'application/pdf') {
    return 'pdf';
  }

  if (mimeType.startsWith('image/')) {
    return 'image';
  }

  if (mimeType.startsWith('text/')) {
    return 'text';
  }

  return 'browser';
}

function normalizeDocumentSearchItem(document) {
  return {
    id: document.id,
    title: document.title,
    originalName: document.originalName,
    mimeType: document.mimeType,
    contractType: document.contractType,
    source: document.source,
    status: document.status,
    parties: document.parties || [],
    riskCounts: document.riskCounts || { low: 0, medium: 0, high: 0 },
    textPreview: document.textPreview || '',
    createdAt: document.createdAt || null,
    updatedAt: document.updatedAt || null,
    available: Boolean(document.available),
    storageMode: document.storageMode || 'disabled',
    previewMode: document.previewMode || getDocumentPreviewMode(document.mimeType || ''),
    artifactReason: document.artifactReason || null,
  };
}

function buildDocumentRecordFromContract(contract, options = {}) {
  const rawArtifact = contract.artifacts?.rawDocument || null;
  const forceUnavailable = Boolean(options.forceUnavailable);
  const available = !forceUnavailable && Boolean(rawArtifact && rawArtifact.mode !== 'disabled' && rawArtifact.path);

  return {
    id: contract.id,
    title: contract.title,
    originalName: contract.originalName || contract.metadata?.originalName || contract.title,
    mimeType: contract.mimeType || contract.metadata?.mimeType || '',
    contractType: contract.contractType || contract.metadata?.contractType || 'Contract',
    source: contract.source || 'unknown',
    status: contract.status || 'unknown',
    parties: contract.parties || contract.metadata?.parties || [],
    riskCounts: contract.riskCounts || contract.metadata?.riskCounts || { low: 0, medium: 0, high: 0 },
    textPreview: contract.textPreview || '',
    createdAt: contract.createdAt || null,
    updatedAt: contract.updatedAt || null,
    available,
    storageMode: forceUnavailable ? 'mock-preview' : rawArtifact?.mode || 'disabled',
    previewMode: getDocumentPreviewMode(contract.mimeType || contract.metadata?.mimeType || ''),
    artifactReason: forceUnavailable ? 'Live artifact preview is unavailable in mock preview mode.' : rawArtifact?.reason || null,
  };
}

function scoreDocumentForQuery(document, query) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return 1;
  }

  const title = String(document.title || '').trim().toLowerCase();
  const originalName = String(document.originalName || '').trim().toLowerCase();
  const combined = `${title} ${originalName}`.trim();
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);

  if (!combined || !terms.every((term) => combined.includes(term))) {
    return 0;
  }

  let score = terms.length * 10;

  if (title === normalizedQuery || originalName === normalizedQuery) {
    score += 500;
  } else if (title.startsWith(normalizedQuery) || originalName.startsWith(normalizedQuery)) {
    score += 300;
  } else if (combined.includes(normalizedQuery)) {
    score += 180;
  }

  return score;
}

function buildFallbackDocumentResults(query, contracts, options = {}) {
  return contracts
    .map((contract) => buildDocumentRecordFromContract(contract, options))
    .map((document) => ({
      document,
      score: scoreDocumentForQuery(document, query),
    }))
    .filter((item) => !query.trim() || item.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return new Date(right.document.createdAt || 0) - new Date(left.document.createdAt || 0);
    })
    .map((item) => item.document);
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
  const [documentQuery, setDocumentQuery] = useState('');
  const [documentResults, setDocumentResults] = useState([]);
  const [documentSearchPending, setDocumentSearchPending] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const deferredDocumentQuery = useDeferredValue(documentQuery);

  const safePath = KNOWN_ROUTES.has(currentPath) ? currentPath : '/';
  const connectors = buildConnectorState(health);
  const metrics = useMemo(() => buildLiveMetrics(contracts), [contracts]);
  const modeLabel = bootMode === 'live' ? 'Live backend mode' : bootMode === 'mock' ? 'Mock preview mode' : 'Connecting';
  const selectedDocument = useMemo(
    () => documentResults.find((document) => document.id === selectedDocumentId) || documentResults[0] || null,
    [documentResults, selectedDocumentId],
  );
  const selectedDocumentViewerUrl = selectedDocument ? api.getDocumentContentUrl(selectedDocument.id) : '';
  const selectedDocumentDownloadUrl = selectedDocument ? api.getDocumentContentUrl(selectedDocument.id, { download: true }) : '';

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
          setDocumentResults(buildFallbackDocumentResults('', sampleContracts, { forceUnavailable: true }));
          setSelectedDocumentId(sampleContracts[0].id);
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
            setDocumentResults([]);
            setSelectedDocumentId(null);
          }
        } else {
          setContracts([]);
          setSelectedContractId(null);
          setSelectedContract(null);
          setContractInsights(buildEmptyInsights());
          setSearchResult(buildEmptySearchResult(query));
          setDocumentResults([]);
          setSelectedDocumentId(null);
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
    if (!documentResults.length) {
      if (selectedDocumentId !== null) {
        setSelectedDocumentId(null);
      }

      return;
    }

    if (!documentResults.some((document) => document.id === selectedDocumentId)) {
      setSelectedDocumentId(documentResults[0].id);
    }
  }, [documentResults, selectedDocumentId]);

  useEffect(() => {
    if (safePath !== '/documents' || bootMode === 'loading') {
      return undefined;
    }

    let ignore = false;

    async function hydrateDocumentResults() {
      setDocumentSearchPending(true);

      try {
        const response = await api.searchDocuments({
          query: documentQuery,
          limit: 20,
        });

        if (!ignore) {
          const items = (response.data?.items || []).map(normalizeDocumentSearchItem);

          startTransition(() => {
            setDocumentResults(items);
          });
        }
      } catch (error) {
        if (!ignore) {
          const fallbackItems = buildFallbackDocumentResults(documentQuery, contracts, {
            forceUnavailable: bootMode !== 'live',
          });

          startTransition(() => {
            setDocumentResults(fallbackItems);
          });
        }
      } finally {
        if (!ignore) {
          setDocumentSearchPending(false);
        }
      }
    }

    hydrateDocumentResults();

    return () => {
      ignore = true;
    };
  }, [bootMode, contracts, safePath]);

  useEffect(() => {
    const titles = {
      '/': 'Overview',
      '/intake': 'Intake',
      '/contracts': 'Contracts',
      '/insights': 'Insights',
      '/search': 'Search',
      '/documents': 'Documents',
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

  async function handleDocumentSearch(event) {
    event.preventDefault();
    setDocumentSearchPending(true);

    try {
      const response = await api.searchDocuments({
        query: documentQuery,
        limit: 20,
      });

      startTransition(() => {
        setDocumentResults((response.data?.items || []).map(normalizeDocumentSearchItem));
      });
    } catch (error) {
      startTransition(() => {
        setDocumentResults(buildFallbackDocumentResults(documentQuery, contracts, {
          forceUnavailable: bootMode !== 'live',
        }));
      });
    } finally {
      setDocumentSearchPending(false);
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
        setDocumentResults((current) => [
          buildDocumentRecordFromContract(uploadedContract),
          ...current.filter((item) => item.id !== uploadedContract.id),
        ]);
        setSelectedDocumentId(uploadedContract.id);
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
  } else if (safePath === '/documents') {
    page = (
      <DocumentsPage
        query={documentQuery}
        deferredQuery={deferredDocumentQuery}
        pending={documentSearchPending}
        results={documentResults}
        selectedDocumentId={selectedDocument?.id || null}
        selectedDocument={selectedDocument}
        viewerUrl={selectedDocumentViewerUrl}
        downloadUrl={selectedDocumentDownloadUrl}
        onQueryChange={setDocumentQuery}
        onSubmit={handleDocumentSearch}
        onSelectDocument={setSelectedDocumentId}
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

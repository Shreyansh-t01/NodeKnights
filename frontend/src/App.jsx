import { startTransition, useDeferredValue, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';

import AppNav from './components/AppNav';
import { api } from './lib/api';
import {
  dashboardMetrics,
  connectorCards,
} from './data/mockData';
import OverviewPage from './pages/OverviewPage';
import IntakePage from './pages/IntakePage';
import ContractsPage from './pages/ContractsPage';
import InsightsPage from './pages/InsightsPage';
import SearchPage from './pages/SearchPage';
import DocumentsPage from './pages/DocumentsPage';

const KNOWN_ROUTES = new Set(['/', '/intake', '/contracts', '/insights', '/search', '/documents']);
const LIVE_REFRESH_INTERVAL_MS = 15000;

function normalizePath(pathname) {
  if (!pathname || pathname === '/') {
    return '/';
  }

  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

function normalizeContractSummary(contract) {
  return {
    id: contract.id,
    isHydrated: false,
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
    isHydrated: true,
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
  if (!health) {
    return connectorCards.map((connector) => ({
      ...connector,
      status: 'fallback',
      description: 'Backend not connected. Connector status will appear automatically once the API responds.',
    }));
  }

  return connectorCards.map((connector) => {
    if (connector.key === 'google-drive') {
      if (!health.googleConnectors?.enabled) {
        return {
          ...connector,
          status: 'configure',
          description: 'Add Google OAuth credentials to the backend before Drive imports can run.',
        };
      }

      if (!health.googleConnectors?.connected) {
        return {
          ...connector,
          status: 'configure',
          description: 'Google OAuth is configured, but the backend still needs to complete the browser consent flow.',
        };
      }

      if (health.googleConnectors?.drive?.watchState?.status === 'active') {
        return {
          ...connector,
          status: 'active',
          description: 'Drive watch is live and will auto-analyze new supported files from monitored folders.',
        };
      }

      if (health.googleConnectors?.drive?.folderIds?.length) {
        return {
          ...connector,
          status: 'ready',
          description: 'Drive is connected for monitored-folder imports. Start the watch to make ingestion continuous.',
        };
      }

      return {
        ...connector,
        status: 'configure',
        description: 'Google is connected, but GOOGLE_DRIVE_FOLDER_IDS still needs to be set for monitored imports.',
      };
    }

    if (connector.key === 'gmail') {
      if (!health.googleConnectors?.enabled) {
        return {
          ...connector,
          status: 'configure',
          description: 'Add Google OAuth credentials to the backend before Gmail attachment imports can run.',
        };
      }

      if (!health.googleConnectors?.connected) {
        return {
          ...connector,
          status: 'configure',
          description: 'Google OAuth is configured, but the backend still needs to complete the browser consent flow.',
        };
      }

      if (health.googleConnectors?.gmail?.enabled) {
        return {
          ...connector,
          status: 'active',
          description: 'Gmail polling is active and will auto-analyze matching attachments on the configured interval.',
        };
      }

      return {
        ...connector,
        status: 'ready',
        description: 'Gmail is connected for attachment imports. Enable polling to ingest new messages automatically.',
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

function normalizeNotificationRecord(notification) {
  return {
    id: notification.id,
    type: notification.type || 'document-analyzed',
    severity: notification.severity || 'info',
    title: notification.title || 'New document analyzed',
    message: notification.message || '',
    source: notification.source || 'unknown',
    sourceLabel: notification.sourceLabel || notification.source || 'Platform',
    trigger: notification.trigger || 'unknown',
    contractId: notification.contractId || null,
    contractTitle: notification.contractTitle || '',
    documentName: notification.documentName || notification.contractTitle || 'Document',
    status: notification.status || 'analysis-ready',
    statusLabel: notification.statusLabel || notification.status || 'Analysis Ready',
    riskCounts: notification.riskCounts || { low: 0, medium: 0, high: 0 },
    readAt: notification.readAt || null,
    createdAt: notification.createdAt || null,
    updatedAt: notification.updatedAt || notification.createdAt || null,
    email: notification.email || {
      attempted: false,
      sent: false,
      recipients: [],
      reason: 'not-attempted',
    },
    details: notification.details || {},
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
    storageMode: forceUnavailable ? 'preview-unavailable' : rawArtifact?.mode || 'disabled',
    previewMode: getDocumentPreviewMode(contract.mimeType || contract.metadata?.mimeType || ''),
    artifactReason: forceUnavailable ? 'Live artifact preview is temporarily unavailable while the backend reconnects.' : rawArtifact?.reason || null,
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
  const [notifications, setNotifications] = useState([]);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [selectedDocumentViewerUrl, setSelectedDocumentViewerUrl] = useState('');
  const viewerObjectUrlRef = useRef('');
  const deferredQuery = useDeferredValue(query);
  const deferredDocumentQuery = useDeferredValue(documentQuery);

  const safePath = KNOWN_ROUTES.has(currentPath) ? currentPath : '/';
  const connectors = buildConnectorState(health);
  const metrics = useMemo(() => buildLiveMetrics(contracts), [contracts]);
  const modeLabel = bootMode === 'live'
    ? 'Live backend mode'
    : bootMode === 'offline'
      ? 'Backend not connected, retrying'
      : 'Connecting to backend';
  const selectedDocument = useMemo(
    () => documentResults.find((document) => document.id === selectedDocumentId) || documentResults[0] || null,
    [documentResults, selectedDocumentId],
  );
  const selectedDocumentDownloadUrl = selectedDocument ? api.getDocumentContentUrl(selectedDocument.id, { download: true }) : '';

  const refreshLiveDashboard = useEffectEvent(async () => {
    if (document.visibilityState === 'hidden') {
      return;
    }

    const [healthResult, contractsResult, notificationsResult] = await Promise.allSettled([
      api.getHealth(),
      api.getContracts(),
      api.getNotifications({ limit: 8 }),
    ]);

    const healthConnected = healthResult.status === 'fulfilled';
    const contractsConnected = (
      contractsResult.status === 'fulfilled'
      && Array.isArray(contractsResult.value.data)
    );
    const notificationsConnected = (
      notificationsResult.status === 'fulfilled'
      && Array.isArray(notificationsResult.value.data?.items)
    );

    if (!healthConnected && !contractsConnected) {
      startTransition(() => {
        setHealth(null);
        setBootMode('offline');
      });
      return;
    }

    startTransition(() => {
      if (healthConnected) {
        setHealth(healthResult.value.services);
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
      }

      if (notificationsConnected) {
        setNotifications(notificationsResult.value.data.items.map(normalizeNotificationRecord));
        setNotificationUnreadCount(notificationsResult.value.data.unreadCount || 0);
      }

      if (bootMode !== 'live') {
        setBootMode('live');
      }
    });
  });

  function navigate(path) {
    const normalized = normalizePath(path);
    window.history.pushState({}, '', normalized);
    setCurrentPath(normalized);
    setNotificationsOpen(false);
  }

  function handleSelectContract(contractId) {
    const summary = contracts.find((contract) => contract.id === contractId) || null;
    setSelectedContractId(contractId);
    setSelectedContract(summary);
  }

  function handleOpenInsights(contractId) {
    const summary = contracts.find((contract) => contract.id === contractId) || null;
    setSelectedContractId(contractId);
    setSelectedContract(summary);
    setContractInsights(buildEmptyInsights(summary));
    navigate('/insights');
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
      const [healthResult, contractsResult, notificationsResult] = await Promise.allSettled([
        api.getHealth(),
        api.getContracts(),
        api.getNotifications({ limit: 8 }),
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
          setContracts([]);
          setSelectedContractId(null);
          setSelectedContract(null);
          setContractInsights(buildEmptyInsights());
          setSearchResult(buildEmptySearchResult(query));
          setDocumentResults([]);
          setSelectedDocumentId(null);
          setNotifications([]);
          setNotificationUnreadCount(0);
          setBootMode('offline');
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

        if (
          notificationsResult.status === 'fulfilled'
          && Array.isArray(notificationsResult.value.data?.items)
        ) {
          setNotifications(notificationsResult.value.data.items.map(normalizeNotificationRecord));
          setNotificationUnreadCount(notificationsResult.value.data.unreadCount || 0);
        } else {
          setNotifications([]);
          setNotificationUnreadCount(0);
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
    if (bootMode === 'loading') {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      void refreshLiveDashboard();
    }, LIVE_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [bootMode]);

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

    if (
      selectedContract?.id === selectedContractId
      && selectedContract.isHydrated
      && selectedContract.updatedAt === summary.updatedAt
    ) {
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
  }, [contracts, selectedContract, selectedContractId]);

  useEffect(() => {
    let ignore = false;

    if (safePath !== '/insights' || !selectedContractId) {
      setInsightsPending(false);
      if (!selectedContractId) {
        setContractInsights(buildEmptyInsights());
      }
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
  }, [bootMode, contracts, safePath, selectedContract, selectedContractId]);

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
    let ignore = false;
    let createdObjectUrl = '';

    async function hydrateSelectedDocumentViewer() {
      if (!selectedDocument?.id || !selectedDocument?.available) {
        if (viewerObjectUrlRef.current) {
          URL.revokeObjectURL(viewerObjectUrlRef.current);
          viewerObjectUrlRef.current = '';
        }

        setSelectedDocumentViewerUrl('');
        return;
      }

      try {
        const response = await fetch(api.getDocumentContentUrl(selectedDocument.id), {
          method: 'GET',
        });

        if (!response.ok) {
          throw new Error(`Failed to load document preview: ${response.status}`);
        }

        const blob = await response.blob();
        createdObjectUrl = URL.createObjectURL(blob);

        if (ignore) {
          URL.revokeObjectURL(createdObjectUrl);
          return;
        }

        if (viewerObjectUrlRef.current) {
          URL.revokeObjectURL(viewerObjectUrlRef.current);
        }

        viewerObjectUrlRef.current = createdObjectUrl;
        setSelectedDocumentViewerUrl(createdObjectUrl);
      } catch (error) {
        if (!ignore) {
          if (viewerObjectUrlRef.current) {
            URL.revokeObjectURL(viewerObjectUrlRef.current);
            viewerObjectUrlRef.current = '';
          }

          setSelectedDocumentViewerUrl('');
        }
      }
    }

    hydrateSelectedDocumentViewer();

    return () => {
      ignore = true;
      if (createdObjectUrl) {
        URL.revokeObjectURL(createdObjectUrl);
      }
    };
  }, [selectedDocument]);

  useEffect(() => {
    return () => {
      if (viewerObjectUrlRef.current) {
        URL.revokeObjectURL(viewerObjectUrlRef.current);
        viewerObjectUrlRef.current = '';
      }
    };
  }, []);

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

  async function handleMarkNotificationsRead() {
    if (!notificationUnreadCount) {
      return;
    }

    try {
      await api.markNotificationsRead();
      const readAt = new Date().toISOString();

      startTransition(() => {
        setNotifications((current) => current.map((item) => (
          item.readAt
            ? item
            : {
              ...item,
              readAt,
            }
        )));
        setNotificationUnreadCount(0);
      });
    } catch (error) {
      console.error(error);
    }
  }

  async function handleNotificationSelect(notification) {
    if (!notification) {
      return;
    }

    if (!notification.readAt) {
      void handleMarkNotificationsRead();
    }

    if (notification.contractId) {
      const summary = contracts.find((contract) => contract.id === notification.contractId) || null;

      if (summary) {
        setSelectedContractId(summary.id);
        setSelectedContract(summary);
        setContractInsights(buildEmptyInsights(summary));
      } else {
        try {
          const response = await api.getContractById(notification.contractId);
          const hydratedContract = normalizeContractDetail(response.data);

          startTransition(() => {
            setContracts((current) => [
              hydratedContract,
              ...current.filter((item) => item.id !== hydratedContract.id),
            ]);
            setSelectedContractId(hydratedContract.id);
            setSelectedContract(hydratedContract);
            setContractInsights(buildEmptyInsights(hydratedContract));
            setDocumentResults((current) => [
              buildDocumentRecordFromContract(hydratedContract),
              ...current.filter((item) => item.id !== hydratedContract.id),
            ]);
          });
        } catch (error) {
          console.error(error);
        }
      }
    }

    navigate(notification.details?.appPath || '/insights');
  }

  const pageProps = {
    contracts,
    selectedContractId,
    selectedContract,
    onSelectContract: handleSelectContract,
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
    page = <ContractsPage {...pageProps} onOpenInsights={handleOpenInsights} />;
  } else if (safePath === '/insights') {
    page = (
      <InsightsPage
        {...pageProps}
        insights={contractInsights}
        insightsPending={insightsPending}
        onNavigate={navigate}
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
        onSelectContract={handleSelectContract}
        onNavigate={navigate}
      />
    );
  }

  return (
    <main className="app-shell">
      <AppNav
        currentPath={safePath}
        notifications={notifications}
        notificationsOpen={notificationsOpen}
        notificationUnreadCount={notificationUnreadCount}
        onMarkNotificationsRead={handleMarkNotificationsRead}
        onNavigate={navigate}
        onNotificationSelect={handleNotificationSelect}
        onToggleNotifications={() => setNotificationsOpen((current) => !current)}
        modeLabel={modeLabel}
      />
      {page}
    </main>
  );
}

export default App;

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');

function buildQueryString(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    searchParams.set(key, value);
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

async function readErrorMessage(response) {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      const payload = await response.json();
      return payload.message || JSON.stringify(payload);
    } catch (error) {
      return `Request failed with status ${response.status}`;
    }
  }

  const message = await response.text();
  return message || `Request failed with status ${response.status}`;
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const isFormData = options.body instanceof FormData;

  if (!isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return response.json();
}

export const api = {
  baseUrl: API_BASE_URL,
  getHealth: () => request('/health'),
  getContracts: () => request('/contracts'),
  getContractById: (contractId) => request(`/contracts/${contractId}`),
  getContractInsights: (contractId, clauseId) => request(
    clauseId
      ? `/contracts/${contractId}/insights?clauseId=${encodeURIComponent(clauseId)}`
      : `/contracts/${contractId}/insights`
  ),
  semanticSearch: (payload) => request('/search/semantic', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  searchDocuments: (params = {}) => request(`/documents${buildQueryString(params)}`),
  getDocumentById: (contractId) => request(`/documents/${contractId}`),
  getDocumentContentUrl: (contractId, options = {}) => (
    `${API_BASE_URL}/documents/${encodeURIComponent(contractId)}/content${buildQueryString({
      download: options.download ? '1' : '',
    })}`
  ),
  uploadContract: (formData) => request('/contracts/upload', {
    method: 'POST',  
    body: formData,
  }),
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

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
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
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
  uploadContract: (formData) => request('/contracts/upload', {
    method: 'POST',  
    body: formData,
  }),
};

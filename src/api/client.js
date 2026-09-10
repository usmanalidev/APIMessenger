const BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || res.statusText || 'Request failed')
  return data
}

export const api = {
  health: () => request('/health'),
  getSettings: () => request('/settings'),
  saveSettings: (body) => request('/settings', { method: 'PUT', body: JSON.stringify(body) }),

  listCollections: () => request('/collections'),
  getCollection: (id) => request(`/collections/${id}`),
  createCollection: (body) => request('/collections', { method: 'POST', body: JSON.stringify(body) }),
  saveCollection: (id, body) => request(`/collections/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteCollection: (id) => request(`/collections/${id}`, { method: 'DELETE' }),

  listEnvironments: () => request('/environments'),
  getEnvironment: (id) => request(`/environments/${id}`),
  createEnvironment: (body) => request('/environments', { method: 'POST', body: JSON.stringify(body) }),
  saveEnvironment: (id, body) => request(`/environments/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteEnvironment: (id) => request(`/environments/${id}`, { method: 'DELETE' }),

  getHistory: () => request('/history'),
  clearHistory: () => request('/history', { method: 'DELETE' }),

  proxy: (body) => request('/proxy', { method: 'POST', body: JSON.stringify(body) }),
  import: (body) => request('/import', { method: 'POST', body: JSON.stringify(body) }),
  importFile: async (file) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch('/api/import/file', { method: 'POST', body: form })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || res.statusText || 'Import failed')
    return data
  },
  importPostman: (body) => request('/import/postman', { method: 'POST', body: JSON.stringify(body) }),
  importOpenApi: (body) => request('/import/openapi', { method: 'POST', body: JSON.stringify(body) }),
}

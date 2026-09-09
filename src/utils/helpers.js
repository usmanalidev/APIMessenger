export function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function createEmptyRequest(name = 'New Request') {
  return {
    id: createId(),
    type: 'request',
    name,
    method: 'GET',
    url: '',
    params: [],
    headers: [{ id: createId(), key: 'Accept', value: 'application/json', enabled: true }],
    auth: { type: 'none', token: '', username: '', password: '', key: '', value: '', addTo: 'header' },
    body: { mode: 'none', raw: '', rawType: 'json', formData: [], urlencoded: [] },
  }
}

export function createEmptyFolder(name = 'New Folder') {
  return {
    id: createId(),
    type: 'folder',
    name,
    children: [],
  }
}

export function createKvRow(partial = {}) {
  return {
    id: createId(),
    key: '',
    value: '',
    enabled: true,
    ...partial,
  }
}

export function findItem(items, id, parent = null) {
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.id === id) return { item, parent, index: i, siblings: items }
    if (item.type === 'folder' && item.children) {
      const found = findItem(item.children, id, item)
      if (found) return found
    }
  }
  return null
}

export function updateItem(items, id, updater) {
  return items.map((item) => {
    if (item.id === id) return typeof updater === 'function' ? updater(item) : { ...item, ...updater }
    if (item.type === 'folder' && item.children) {
      return { ...item, children: updateItem(item.children, id, updater) }
    }
    return item
  })
}

export function removeItem(items, id) {
  return items
    .filter((item) => item.id !== id)
    .map((item) => {
      if (item.type === 'folder' && item.children) {
        return { ...item, children: removeItem(item.children, id) }
      }
      return item
    })
}

export function addItemToFolder(items, folderId, newItem) {
  if (!folderId) return [...items, newItem]
  return items.map((item) => {
    if (item.id === folderId && item.type === 'folder') {
      return { ...item, children: [...(item.children || []), newItem] }
    }
    if (item.type === 'folder' && item.children) {
      return { ...item, children: addItemToFolder(item.children, folderId, newItem) }
    }
    return item
  })
}

export function substituteVariables(value, variables = []) {
  if (value == null) return value
  if (typeof value !== 'string') return value
  return value.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, key) => {
    const found = variables.find((v) => v.enabled !== false && v.key === key)
    return found ? found.value : match
  })
}

export function resolveRequest(request, variables = []) {
  const resolveKv = (rows = []) =>
    rows.map((r) => ({
      ...r,
      key: substituteVariables(r.key, variables),
      value: substituteVariables(r.value, variables),
    }))

  const auth = { ...request.auth }
  if (auth.type === 'bearer') auth.token = substituteVariables(auth.token, variables)
  if (auth.type === 'basic') {
    auth.username = substituteVariables(auth.username, variables)
    auth.password = substituteVariables(auth.password, variables)
  }
  if (auth.type === 'apikey') {
    auth.key = substituteVariables(auth.key, variables)
    auth.value = substituteVariables(auth.value, variables)
  }

  const body = {
    ...request.body,
    raw: substituteVariables(request.body?.raw, variables),
    formData: resolveKv(request.body?.formData),
    urlencoded: resolveKv(request.body?.urlencoded),
  }

  return {
    ...request,
    url: substituteVariables(request.url, variables),
    params: resolveKv(request.params),
    headers: resolveKv(request.headers),
    auth,
    body,
  }
}

export function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function methodColor(method) {
  const m = (method || 'GET').toUpperCase()
  const map = {
    GET: 'method-get',
    POST: 'method-post',
    PUT: 'method-put',
    PATCH: 'method-patch',
    DELETE: 'method-delete',
    HEAD: 'method-head',
    OPTIONS: 'method-options',
  }
  return map[m] || 'method-get'
}

export function exportCollectionFile(collection) {
  const blob = new Blob([JSON.stringify(collection, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${(collection.name || 'collection').replace(/[^\w.-]+/g, '_')}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function toCurl(request) {
  const lines = [`curl -X ${request.method || 'GET'} '${request.url || ''}'`]
  for (const h of request.headers || []) {
    if (!h.enabled || !h.key) continue
    lines.push(`  -H '${h.key}: ${h.value || ''}'`)
  }
  if (request.auth?.type === 'bearer' && request.auth.token) {
    lines.push(`  -H 'Authorization: Bearer ${request.auth.token}'`)
  }
  if (request.body?.mode === 'raw' && request.body.raw) {
    lines.push(`  -d '${request.body.raw.replace(/'/g, `'\\''`)}'`)
  }
  return lines.join(' \\\n')
}

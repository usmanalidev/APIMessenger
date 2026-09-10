import { v4 as uuid } from 'uuid'

function cryptoRandom() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function createKv(key, value, enabled = true) {
  return { id: cryptoRandom(), key, value: value ?? '', enabled }
}

function detectImportKind(json) {
  if (!json || typeof json !== 'object') return 'unknown'
  if (json.openapi || json.swagger) return 'openapi'
  if (json.info && Array.isArray(json.item)) return 'postman'
  if (json.schemaVersion && Array.isArray(json.items)) return 'native'
  return 'unknown'
}

function schemaExample(schema, components = {}, depth = 0) {
  if (!schema || depth > 6) return null
  if (schema.example !== undefined) return schema.example
  if (schema.$ref) {
    const name = String(schema.$ref).split('/').pop()
    return schemaExample(components.schemas?.[name], components, depth + 1)
  }
  if (schema.type === 'object' || schema.properties) {
    const out = {}
    for (const [key, prop] of Object.entries(schema.properties || {})) {
      out[key] = schemaExample(prop, components, depth + 1)
    }
    return out
  }
  if (schema.type === 'array') {
    const item = schemaExample(schema.items, components, depth + 1)
    return item == null ? [] : [item]
  }
  if (schema.enum?.length) return schema.enum[0]
  switch (schema.type) {
    case 'string':
      return schema.format === 'date-time' ? new Date().toISOString() : ''
    case 'number':
    case 'integer':
      return schema.default ?? 0
    case 'boolean':
      return false
    default:
      return schema.default ?? null
  }
}

function joinServerPath(serverUrl, apiPath) {
  const path = apiPath.startsWith('/') ? apiPath : `/${apiPath}`
  if (!serverUrl || serverUrl.startsWith('/')) {
    // Relative server — use environment baseUrl + full path
    return `{{baseUrl}}${path}`
  }
  return `${String(serverUrl).replace(/\/$/, '')}${path}`
}

export function convertOpenApi(doc) {
  if (!doc?.paths) throw new Error('Missing OpenAPI paths')

  const title = doc.info?.title || 'OpenAPI Collection'
  const serverUrl = doc.servers?.[0]?.url || ''
  const components = doc.components || {}
  const folders = new Map()

  const ensureFolder = (name) => {
    if (!folders.has(name)) {
      folders.set(name, {
        id: cryptoRandom(),
        type: 'folder',
        name,
        children: [],
      })
    }
    return folders.get(name)
  }

  for (const [apiPath, methods] of Object.entries(doc.paths)) {
    for (const [method, operation] of Object.entries(methods || {})) {
      if (!['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method)) continue

      const tag = operation.tags?.[0] || 'Default'
      const folder = ensureFolder(tag)
      const headers = [createKv('Accept', 'application/json')]
      const params = []

      for (const p of operation.parameters || []) {
        if (p.in === 'query') {
          params.push(createKv(p.name, p.schema?.default != null ? String(p.schema.default) : '', !!p.required))
        } else if (p.in === 'header') {
          headers.push(createKv(p.name, '', !!p.required))
        }
      }

      let body = { mode: 'none', raw: '', rawType: 'json', formData: [], urlencoded: [] }
      const content = operation.requestBody?.content || {}
      if (content['application/json']) {
        const example = schemaExample(content['application/json'].schema, components)
        body = {
          mode: 'raw',
          raw: JSON.stringify(example ?? {}, null, 2),
          rawType: 'json',
          formData: [],
          urlencoded: [],
        }
        headers.push(createKv('Content-Type', 'application/json'))
      } else if (content['multipart/form-data']) {
        const schema = content['multipart/form-data'].schema
        const resolved = schema?.$ref
          ? components.schemas?.[String(schema.$ref).split('/').pop()]
          : schema
        body = {
          mode: 'formdata',
          raw: '',
          rawType: 'json',
          formData: Object.keys(resolved?.properties || {}).map((key) => createKv(key, '')),
          urlencoded: [],
        }
      } else if (content['application/x-www-form-urlencoded']) {
        const schema = content['application/x-www-form-urlencoded'].schema
        const resolved = schema?.$ref
          ? components.schemas?.[String(schema.$ref).split('/').pop()]
          : schema
        body = {
          mode: 'urlencoded',
          raw: '',
          rawType: 'json',
          formData: [],
          urlencoded: Object.keys(resolved?.properties || {}).map((key) => createKv(key, '')),
        }
      }

      let auth = { type: 'none', token: '', username: '', password: '', key: '', value: '', addTo: 'header' }
      const security = operation.security || doc.security
      if (security?.length) {
        const schemeName = Object.keys(security[0] || {})[0]
        const scheme = components.securitySchemes?.[schemeName]
        if (scheme?.type === 'http' && String(scheme.scheme).toLowerCase() === 'bearer') {
          auth = { type: 'bearer', token: '{{token}}', username: '', password: '', key: '', value: '', addTo: 'header' }
        } else if (scheme?.type === 'apiKey') {
          auth = {
            type: 'apikey',
            token: '',
            username: '',
            password: '',
            key: scheme.name || 'Authorization',
            value: '{{token}}',
            addTo: scheme.in === 'query' ? 'query' : 'header',
          }
        }
      }

      // Keep path params as {{name}} so environment variables can fill them
      const urlPath = apiPath.replace(/\{([^}]+)\}/g, '{{$1}}')

      folder.children.push({
        id: cryptoRandom(),
        type: 'request',
        name: operation.summary || operation.operationId || `${method.toUpperCase()} ${apiPath}`,
        method: method.toUpperCase(),
        url: joinServerPath(serverUrl, urlPath),
        params,
        headers,
        auth,
        body,
      })
    }
  }

  const defaultBase =
    serverUrl && !serverUrl.startsWith('/')
      ? serverUrl.replace(/\/$/, '')
      : 'http://localhost:3000'

  return {
    collection: {
      name: title,
      description: doc.info?.description || 'Imported from OpenAPI / Swagger',
      items: [...folders.values()],
    },
    environment: {
      name: `${title} Env`,
      variables: [
        createKv('baseUrl', defaultBase),
        createKv('token', ''),
      ],
    },
  }
}

export function convertPostmanCollection(pm) {
  if (!pm || !pm.info) throw new Error('Missing Postman collection info')

  const mapItem = (item) => {
    if (item.item) {
      return {
        id: cryptoRandom(),
        type: 'folder',
        name: item.name || 'Folder',
        children: item.item.map(mapItem),
      }
    }

    const req = item.request || {}
    let url = ''
    let params = []
    if (typeof req.url === 'string') {
      url = req.url
    } else if (req.url && typeof req.url === 'object') {
      url = req.url.raw || ''
      if (!url && Array.isArray(req.url.host)) {
        const protocol = req.url.protocol ? `${req.url.protocol}://` : 'http://'
        const host = req.url.host.join('.')
        const path = Array.isArray(req.url.path) ? `/${req.url.path.join('/')}` : ''
        url = `${protocol}${host}${path}`
      }
      params = (req.url.query || []).map((q) =>
        createKv(q.key || '', q.value || '', !q.disabled)
      )
    }

    const method = (req.method || 'GET').toUpperCase()
    const headers = (req.header || []).map((h) =>
      createKv(h.key || '', h.value || '', !h.disabled)
    )

    let body = { mode: 'none', raw: '', rawType: 'json', formData: [], urlencoded: [] }
    if (req.body) {
      if (req.body.mode === 'raw') {
        body = {
          mode: 'raw',
          raw: req.body.raw || '',
          rawType: req.body.options?.raw?.language || 'json',
          formData: [],
          urlencoded: [],
        }
      } else if (req.body.mode === 'urlencoded') {
        body = {
          mode: 'urlencoded',
          raw: '',
          rawType: 'json',
          formData: [],
          urlencoded: (req.body.urlencoded || []).map((r) =>
            createKv(r.key || '', r.value || '', !r.disabled)
          ),
        }
      } else if (req.body.mode === 'formdata') {
        body = {
          mode: 'formdata',
          raw: '',
          rawType: 'json',
          formData: (req.body.formdata || []).map((r) =>
            createKv(r.key || '', r.value || '', !r.disabled)
          ),
          urlencoded: [],
        }
      }
    }

    let auth = { type: 'none', token: '', username: '', password: '', key: '', value: '', addTo: 'header' }
    const a = req.auth || pm.auth
    if (a?.type === 'bearer') {
      auth = {
        type: 'bearer',
        token: a.bearer?.find?.((x) => x.key === 'token')?.value || a.bearer?.[0]?.value || '',
        username: '',
        password: '',
        key: '',
        value: '',
        addTo: 'header',
      }
    } else if (a?.type === 'basic') {
      auth = {
        type: 'basic',
        token: '',
        username: a.basic?.find?.((x) => x.key === 'username')?.value || '',
        password: a.basic?.find?.((x) => x.key === 'password')?.value || '',
        key: '',
        value: '',
        addTo: 'header',
      }
    }

    return {
      id: cryptoRandom(),
      type: 'request',
      name: item.name || 'Request',
      method,
      url,
      params,
      headers,
      auth,
      body,
    }
  }

  const environment =
    Array.isArray(pm.variable) && pm.variable.length
      ? {
          name: `${pm.info.name || 'Imported'} Env`,
          variables: pm.variable.map((v) => createKv(v.key || '', v.value || '', true)),
        }
      : null

  return {
    collection: {
      name: pm.info.name || 'Imported Collection',
      description: pm.info.description || 'Imported from Postman',
      items: (pm.item || []).map(mapItem),
    },
    environment,
  }
}

export { detectImportKind, cryptoRandom, createKv, uuid }

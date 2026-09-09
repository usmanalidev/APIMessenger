import { URL } from 'url'

function headersToObject(headers = []) {
  const out = {}
  for (const h of headers) {
    if (!h || !h.enabled || !h.key) continue
    out[h.key] = h.value ?? ''
  }
  return out
}

function buildUrl(rawUrl, params = []) {
  const url = new URL(rawUrl)
  for (const p of params) {
    if (!p || !p.enabled || !p.key) continue
    url.searchParams.append(p.key, p.value ?? '')
  }
  return url
}

function buildBody(body = {}) {
  if (!body || body.mode === 'none') return { payload: undefined, contentType: null }

  if (body.mode === 'raw') {
    const typeMap = {
      json: 'application/json',
      text: 'text/plain',
      xml: 'application/xml',
      html: 'text/html',
      javascript: 'application/javascript',
    }
    return {
      payload: body.raw ?? '',
      contentType: typeMap[body.rawType] || 'text/plain',
    }
  }

  if (body.mode === 'urlencoded') {
    const params = new URLSearchParams()
    for (const row of body.urlencoded || []) {
      if (!row.enabled || !row.key) continue
      params.append(row.key, row.value ?? '')
    }
    return {
      payload: params.toString(),
      contentType: 'application/x-www-form-urlencoded',
    }
  }

  if (body.mode === 'formdata') {
    // Browser FormData isn't available the same way; send as multipart manually via URLSearchParams fallback
    // For local tooling, prefer raw JSON. Support simple text fields as urlencoded-like multipart.
    const boundary = `----ApiMessenger${Date.now()}`
    const parts = []
    for (const row of body.formData || []) {
      if (!row.enabled || !row.key) continue
      parts.push(
        `--${boundary}\r\nContent-Disposition: form-data; name="${row.key}"\r\n\r\n${row.value ?? ''}\r\n`
      )
    }
    parts.push(`--${boundary}--\r\n`)
    return {
      payload: parts.join(''),
      contentType: `multipart/form-data; boundary=${boundary}`,
    }
  }

  return { payload: undefined, contentType: null }
}

function applyAuth(headers, auth = {}) {
  if (!auth || auth.type === 'none') return headers
  const next = { ...headers }

  if (auth.type === 'bearer' && auth.token) {
    next.Authorization = `Bearer ${auth.token}`
  } else if (auth.type === 'basic' && (auth.username || auth.password)) {
    const token = Buffer.from(`${auth.username || ''}:${auth.password || ''}`).toString('base64')
    next.Authorization = `Basic ${token}`
  } else if (auth.type === 'apikey' && auth.key) {
    if (auth.addTo === 'query') {
      // handled by caller via params
    } else {
      next[auth.key] = auth.value || ''
    }
  }

  return next
}

export async function executeRequest(reqBody) {
  const { method = 'GET', url, params = [], headers = [], auth = {}, body = {} } = reqBody

  if (!url || typeof url !== 'string') {
    const err = new Error('URL is required')
    err.status = 400
    throw err
  }

  let finalParams = [...params]
  if (auth?.type === 'apikey' && auth.addTo === 'query' && auth.key) {
    finalParams = [
      ...finalParams,
      { key: auth.key, value: auth.value || '', enabled: true },
    ]
  }

  let target
  try {
    target = buildUrl(url, finalParams)
  } catch {
    const err = new Error('Invalid URL')
    err.status = 400
    throw err
  }

  let headerObj = headersToObject(headers)
  headerObj = applyAuth(headerObj, auth)

  const { payload, contentType } = buildBody(body)
  if (contentType && !Object.keys(headerObj).some((k) => k.toLowerCase() === 'content-type')) {
    headerObj['Content-Type'] = contentType
  }

  const started = Date.now()
  let response
  try {
    response = await fetch(target.toString(), {
      method: method.toUpperCase(),
      headers: headerObj,
      body: ['GET', 'HEAD'].includes(method.toUpperCase()) ? undefined : payload,
      redirect: 'follow',
    })
  } catch (err) {
    const duration = Date.now() - started
    return {
      ok: false,
      error: err.message || 'Network error',
      duration,
      url: target.toString(),
      method: method.toUpperCase(),
    }
  }

  const duration = Date.now() - started
  const buffer = Buffer.from(await response.arrayBuffer())
  const contentTypeHeader = response.headers.get('content-type') || ''
  let bodyText = buffer.toString('utf8')
  let bodyJson = null

  if (contentTypeHeader.includes('application/json') || looksLikeJson(bodyText)) {
    try {
      bodyJson = JSON.parse(bodyText)
      bodyText = JSON.stringify(bodyJson, null, 2)
    } catch {
      // keep raw text
    }
  }

  const responseHeaders = {}
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value
  })

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
    body: bodyText,
    bodyJson,
    size: buffer.length,
    duration,
    url: target.toString(),
    method: method.toUpperCase(),
  }
}

function looksLikeJson(text) {
  const t = text.trim()
  return (t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))
}

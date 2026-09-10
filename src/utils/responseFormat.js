function detectLanguage(body = '', contentType = '') {
  const type = String(contentType || '').toLowerCase()
  const text = String(body || '').trim()

  if (type.includes('application/json') || type.includes('+json')) return 'JSON'
  if (type.includes('xml') || type.includes('application/soap')) return 'XML'
  if (type.includes('text/html') || type.includes('application/xhtml')) return 'HTML'
  if (type.includes('text/css')) return 'Text'
  if (type.includes('javascript')) return 'Text'

  if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
    try {
      JSON.parse(text)
      return 'JSON'
    } catch {
      // fall through
    }
  }
  if (text.startsWith('<?xml') || /^<\w+[\s>]/.test(text) && text.includes('</')) {
    if (/<html[\s>]/i.test(text) || /<!doctype html/i.test(text)) return 'HTML'
    if (text.startsWith('<?xml') || /<\w+:\w+/.test(text)) return 'XML'
    return 'HTML'
  }
  return 'Text'
}

export function beautifyJson(raw) {
  const parsed = JSON.parse(raw)
  return JSON.stringify(parsed, null, 2)
}

export function minifyJson(raw) {
  const parsed = JSON.parse(raw)
  return JSON.stringify(parsed)
}

function indentXmlLike(raw) {
  const cleaned = String(raw)
    .replace(/>\s*</g, '><')
    .replace(/\r\n/g, '\n')
    .trim()

  const parts = cleaned.replace(/(>)(<)(\/*)/g, '$1\n$2$3').split('\n')
  let indent = 0
  const lines = []

  for (const part of parts) {
    const line = part.trim()
    if (!line) continue
    if (/^<\/\w/.test(line)) indent = Math.max(indent - 1, 0)
    lines.push(`${'  '.repeat(indent)}${line}`)
    if (/^<\w[^>]*[^/]>$/.test(line) && !/^<\?/.test(line) && !/^<!/.test(line)) {
      indent += 1
    }
  }
  return lines.join('\n')
}

export function beautifyXml(raw) {
  return indentXmlLike(raw)
}

export function beautifyHtml(raw) {
  return indentXmlLike(raw)
}

export function formatResponseBody(raw, language) {
  const text = raw ?? ''
  if (!text) return '(empty)'

  try {
    if (language === 'JSON') return beautifyJson(text)
    if (language === 'XML') return beautifyXml(text)
    if (language === 'HTML') return beautifyHtml(text)
    return text
  } catch {
    return text
  }
}

export function getResponseContentType(response) {
  const headers = response?.headers || {}
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === 'content-type')
  return entry?.[1] || ''
}

export function resolveBodyLanguage(response, preferred = 'Auto') {
  if (preferred && preferred !== 'Auto') return preferred
  return detectLanguage(response?.body || response?.error || '', getResponseContentType(response))
}

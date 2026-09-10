import { useEffect, useMemo, useState } from 'react'
import { formatBytes, toCurl } from '../utils/helpers'
import {
  formatResponseBody,
  getResponseContentType,
  minifyJson,
  resolveBodyLanguage,
} from '../utils/responseFormat'

const BODY_MODES = ['Pretty', 'Raw', 'Preview']
const LANGUAGES = ['Auto', 'JSON', 'XML', 'HTML', 'Text']

export function ResponseViewer({ response, sending, sentRequest }) {
  const [tab, setTab] = useState('Body')
  const [bodyMode, setBodyMode] = useState('Pretty')
  const [language, setLanguage] = useState('Auto')
  const [wrap, setWrap] = useState(true)
  const [copied, setCopied] = useState(false)
  const [bodyOverride, setBodyOverride] = useState(null)

  useEffect(() => {
    if (response) {
      setTab('Body')
      setBodyMode('Pretty')
      setLanguage('Auto')
      setBodyOverride(null)
    }
  }, [response])

  const curlText = sentRequest
    ? toCurl({
        ...sentRequest,
        url: response?.url || sentRequest.url,
        params: response?.url ? [] : sentRequest.params,
      })
    : ''

  const rawBody = bodyOverride ?? (response?.error || response?.body || '')
  const contentType = getResponseContentType(response)
  const resolvedLanguage = useMemo(
    () => resolveBodyLanguage({ ...response, body: rawBody }, language),
    [response, rawBody, language]
  )

  const prettyBody = useMemo(() => {
    if (!response) return ''
    return formatResponseBody(rawBody, resolvedLanguage)
  }, [response, rawBody, resolvedLanguage])

  const displayBody = bodyMode === 'Raw' ? rawBody || '(empty)' : prettyBody

  const copyText = async (text) => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const area = document.createElement('textarea')
      area.value = text
      document.body.appendChild(area)
      area.select()
      document.execCommand('copy')
      document.body.removeChild(area)
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  const onBeautify = () => {
    setBodyOverride(null)
    setBodyMode('Pretty')
    if (language === 'Auto') setLanguage(resolvedLanguage)
  }

  const onMinify = () => {
    if (resolvedLanguage !== 'JSON') return
    try {
      const source = response?.error || response?.body || ''
      setBodyOverride(minifyJson(source))
      setBodyMode('Raw')
    } catch {
      // ignore invalid json
    }
  }

  if (sending) {
    return (
      <>
        <div className="meta-row">
          <strong>Response</strong>
          <span className="pill warn sending">Waiting…</span>
        </div>
        <div className="empty-state">
          <p>Request in flight through the local proxy.</p>
        </div>
      </>
    )
  }

  if (!response) {
    return (
      <>
        <div className="meta-row">
          <strong>Response</strong>
        </div>
        <div className="empty-state">
          <h2>Ready when you are</h2>
          <p>Hit Send to run the request. Body, headers, and a full cURL of what was sent will appear here.</p>
        </div>
      </>
    )
  }

  const hasHttpStatus = typeof response.status === 'number'
  const statusClass = !hasHttpStatus
    ? 'err'
    : response.status >= 200 && response.status < 300
      ? 'ok'
      : response.status >= 400
        ? 'err'
        : 'warn'

  return (
    <>
      <div className="meta-row">
        <strong>Response</strong>
        <div className="meta-pills">
          {hasHttpStatus ? (
            <span className={`pill ${statusClass}`}>
              {response.status} {response.statusText || ''}
            </span>
          ) : (
            <span className="pill err">Error</span>
          )}
          {typeof response.duration === 'number' && (
            <span className="pill">{response.duration} ms</span>
          )}
          {typeof response.size === 'number' && (
            <span className="pill">{formatBytes(response.size)}</span>
          )}
          {contentType && <span className="pill">{contentType.split(';')[0]}</span>}
        </div>
      </div>

      <div className="panel-tabs">
        {['Body', 'Headers', 'cURL'].map((t) => (
          <button
            key={t}
            type="button"
            className={`panel-tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
        {tab === 'cURL' && (
          <button type="button" className="btn btn-sm copy-button" onClick={() => copyText(curlText)} disabled={!curlText}>
            {copied ? 'Copied' : 'Copy cURL'}
          </button>
        )}
      </div>

      <div className="panel-body">
        {tab === 'Body' && (
          <>
            <div className="response-toolbar">
              <div className="response-mode-group">
                {BODY_MODES.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`response-mode-btn ${bodyMode === mode ? 'active' : ''}`}
                    onClick={() => setBodyMode(mode)}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              {bodyMode === 'Pretty' && (
                <label className="response-lang">
                  Language
                  <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                    {LANGUAGES.map((lang) => (
                      <option key={lang} value={lang}>
                        {lang === 'Auto' ? `Auto (${resolvedLanguage})` : lang}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="response-wrap">
                <input type="checkbox" checked={wrap} onChange={(e) => setWrap(e.target.checked)} />
                Wrap
              </label>

              <div className="response-toolbar-actions">
                <button type="button" className="btn btn-sm" onClick={onBeautify}>
                  Beautify
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={onMinify}
                  disabled={resolvedLanguage !== 'JSON'}
                  title="Minify JSON and copy"
                >
                  Minify
                </button>
                <button type="button" className="btn btn-sm" onClick={() => copyText(displayBody)}>
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {bodyMode === 'Preview' ? (
              resolvedLanguage === 'HTML' || /<html[\s>]/i.test(rawBody) ? (
                <iframe
                  className="response-preview"
                  title="Response preview"
                  sandbox=""
                  srcDoc={rawBody}
                />
              ) : resolvedLanguage === 'JSON' ? (
                <pre className={`code-block ${wrap ? 'is-wrap' : 'is-nowrap'}`}>{prettyBody}</pre>
              ) : (
                <div className="empty-state">
                  <p>Preview is available for HTML responses. Use Pretty or Raw for {resolvedLanguage}.</p>
                </div>
              )
            ) : (
              <pre className={`code-block ${wrap ? 'is-wrap' : 'is-nowrap'}`}>
                {displayBody}
              </pre>
            )}
          </>
        )}

        {tab === 'Headers' && (
          Object.keys(response.headers || {}).length ? (
            <div className="response-headers">
              {Object.entries(response.headers || {}).map(([key, value]) => (
                <div className="response-header-row" key={key}>
                  <strong>{key}</strong>
                  <span>{value}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="code-caption">No response headers for this call.</p>
          )
        )}

        {tab === 'cURL' && (
          <>
            <p className="code-caption">
              Exact command for the request you just sent
              {response.url ? ` → ${response.url}` : ''}.
              Includes method, final URL, headers, auth, and body.
            </p>
            <pre className="code-block curl-block">{curlText || 'No sent request captured.'}</pre>
          </>
        )}
      </div>
    </>
  )
}

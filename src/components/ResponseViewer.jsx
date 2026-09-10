import { useEffect, useState } from 'react'
import { formatBytes, toCurl } from '../utils/helpers'

export function ResponseViewer({ response, sending, sentRequest }) {
  const [tab, setTab] = useState('Body')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (response) setTab('Body')
  }, [response])

  const curlText = sentRequest
    ? toCurl({
        ...sentRequest,
        url: response?.url || sentRequest.url,
        // Params are already baked into response.url from the proxy
        params: response?.url ? [] : sentRequest.params,
      })
    : ''

  const copyCurl = async () => {
    if (!curlText) return
    try {
      await navigator.clipboard.writeText(curlText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      // Fallback for restricted clipboard
      const area = document.createElement('textarea')
      area.value = curlText
      document.body.appendChild(area)
      area.select()
      document.execCommand('copy')
      document.body.removeChild(area)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
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
          <button type="button" className="btn btn-sm copy-button" onClick={copyCurl} disabled={!curlText}>
            {copied ? 'Copied' : 'Copy cURL'}
          </button>
        )}
      </div>

      <div className="panel-body">
        {tab === 'Body' && (
          <pre className="code-block">
            {response.error || response.body || '(empty)'}
          </pre>
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

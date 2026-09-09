import { useState } from 'react'
import { formatBytes, toCurl } from '../utils/helpers'

export function ResponseViewer({ response, sending, resolvedRequest }) {
  const [tab, setTab] = useState('Body')

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
          <p>Hit Send to run the request. Status, timing, headers, and body will appear here.</p>
        </div>
      </>
    )
  }

  if (response.error) {
    return (
      <>
        <div className="meta-row">
          <strong>Response</strong>
          <div className="meta-pills">
            <span className="pill err">Error</span>
            <span className="pill">{response.duration} ms</span>
          </div>
        </div>
        <div className="panel-body">
          <pre className="code-block">{response.error}</pre>
        </div>
      </>
    )
  }

  const statusClass = response.status >= 200 && response.status < 300 ? 'ok' : response.status >= 400 ? 'err' : 'warn'

  return (
    <>
      <div className="meta-row">
        <strong>Response</strong>
        <div className="meta-pills">
          <span className={`pill ${statusClass}`}>
            {response.status} {response.statusText}
          </span>
          <span className="pill">{response.duration} ms</span>
          <span className="pill">{formatBytes(response.size)}</span>
        </div>
      </div>
      <div className="panel-tabs">
        {['Body', 'Headers', 'cURL'].map((t) => (
          <button key={t} type="button" className={`panel-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="panel-body">
        {tab === 'Body' && <pre className="code-block">{response.body || '(empty)'}</pre>}
        {tab === 'Headers' && (
          <div className="response-headers">
            {Object.entries(response.headers || {}).map(([key, value]) => (
              <div className="response-header-row" key={key}>
                <strong>{key}</strong>
                <span>{value}</span>
              </div>
            ))}
          </div>
        )}
        {tab === 'cURL' && (
          <pre className="code-block">{resolvedRequest ? toCurl(resolvedRequest) : 'No request'}</pre>
        )}
      </div>
    </>
  )
}

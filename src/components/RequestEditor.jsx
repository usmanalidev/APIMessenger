import { useState } from 'react'
import { KeyValueEditor } from './KeyValueEditor'
import { createKvRow } from '../utils/helpers'

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

export function RequestEditor({ request, onChange, onSend, sending, onSave, dirty, responseSlot }) {
  const [tab, setTab] = useState('Params')

  if (!request) {
    return (
      <div className="empty-state">
        <h2>Pick a request</h2>
        <p>Select a request from the sidebar, or create one inside a collection.</p>
      </div>
    )
  }

  const set = (patch) => onChange({ ...request, ...patch })
  const setBody = (patch) => set({ body: { ...request.body, ...patch } })
  const setAuth = (patch) => set({ auth: { ...(request.auth || { type: 'none' }), ...patch } })

  const addRow = (field) => {
    set({ [field]: [...(request[field] || []), createKvRow()] })
  }

  return (
    <>
      <div style={{ display: 'grid', gap: '0.55rem' }}>
        <input
          className="field"
          value={request.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Request name"
        />
        <div className="request-bar">
          <select value={request.method} onChange={(e) => set({ method: e.target.value })}>
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <input
            value={request.url}
            onChange={(e) => set({ url: e.target.value })}
            placeholder="https://api.example.com/resource or {{baseUrl}}/posts"
            spellCheck={false}
          />
          <div className="split-actions">
            <button type="button" className="btn" onClick={onSave} disabled={!dirty}>
              Save
            </button>
            <button
              type="button"
              className={`btn btn-accent ${sending ? 'sending' : ''}`}
              onClick={onSend}
              disabled={sending || !request.url}
            >
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      </div>

      <div className="editor-grid">
        <section className="panel">
          <div className="panel-tabs">
            {['Params', 'Headers', 'Body', 'Auth'].map((t) => (
              <button
                key={t}
                type="button"
                className={`panel-tab ${tab === t ? 'active' : ''}`}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="panel-body">
            {tab === 'Params' && (
              <>
                <KeyValueEditor
                  rows={request.params || []}
                  onChange={(params) => set({ params })}
                  keyPlaceholder="Query param"
                  valuePlaceholder="Value"
                />
                <button type="button" className="btn btn-sm" onClick={() => addRow('params')}>
                  Add param
                </button>
                <p className="hint">Use {'{{variable}}'} syntax to inject environment values.</p>
              </>
            )}

            {tab === 'Headers' && (
              <>
                <KeyValueEditor
                  rows={request.headers || []}
                  onChange={(headers) => set({ headers })}
                  keyPlaceholder="Header"
                  valuePlaceholder="Value"
                />
                <button type="button" className="btn btn-sm" onClick={() => addRow('headers')}>
                  Add header
                </button>
              </>
            )}

            {tab === 'Body' && (
              <BodyEditor body={request.body || { mode: 'none' }} setBody={setBody} />
            )}

            {tab === 'Auth' && (
              <AuthEditor auth={request.auth || { type: 'none' }} setAuth={setAuth} />
            )}
          </div>
        </section>

        <section className="panel">{responseSlot}</section>
      </div>
    </>
  )
}

function BodyEditor({ body, setBody }) {
  return (
    <div className="form-stack">
      <label className="label">
        Body mode
        <select value={body.mode || 'none'} onChange={(e) => setBody({ mode: e.target.value })}>
          <option value="none">None</option>
          <option value="raw">Raw</option>
          <option value="urlencoded">x-www-form-urlencoded</option>
          <option value="formdata">form-data</option>
        </select>
      </label>

      {body.mode === 'raw' && (
        <>
          <label className="label">
            Raw type
            <select value={body.rawType || 'json'} onChange={(e) => setBody({ rawType: e.target.value })}>
              <option value="json">JSON</option>
              <option value="text">Text</option>
              <option value="xml">XML</option>
              <option value="html">HTML</option>
              <option value="javascript">JavaScript</option>
            </select>
          </label>
          <textarea
            className="raw-body"
            value={body.raw || ''}
            onChange={(e) => setBody({ raw: e.target.value })}
            placeholder='{"hello":"world"}'
            spellCheck={false}
          />
        </>
      )}

      {body.mode === 'urlencoded' && (
        <>
          <KeyValueEditor
            rows={body.urlencoded || []}
            onChange={(urlencoded) => setBody({ urlencoded })}
          />
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setBody({ urlencoded: [...(body.urlencoded || []), createKvRow()] })}
          >
            Add field
          </button>
        </>
      )}

      {body.mode === 'formdata' && (
        <>
          <KeyValueEditor
            rows={body.formData || []}
            onChange={(formData) => setBody({ formData })}
          />
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setBody({ formData: [...(body.formData || []), createKvRow()] })}
          >
            Add field
          </button>
        </>
      )}
    </div>
  )
}

function AuthEditor({ auth, setAuth }) {
  return (
    <div className="form-stack">
      <label className="label">
        Auth type
        <select value={auth.type || 'none'} onChange={(e) => setAuth({ type: e.target.value })}>
          <option value="none">No Auth</option>
          <option value="bearer">Bearer Token</option>
          <option value="basic">Basic Auth</option>
          <option value="apikey">API Key</option>
        </select>
      </label>

      {auth.type === 'bearer' && (
        <label className="label">
          Token
          <input
            className="field"
            value={auth.token || ''}
            onChange={(e) => setAuth({ token: e.target.value })}
            placeholder="{{token}}"
          />
        </label>
      )}

      {auth.type === 'basic' && (
        <>
          <label className="label">
            Username
            <input
              className="field"
              value={auth.username || ''}
              onChange={(e) => setAuth({ username: e.target.value })}
            />
          </label>
          <label className="label">
            Password
            <input
              className="field"
              type="password"
              value={auth.password || ''}
              onChange={(e) => setAuth({ password: e.target.value })}
            />
          </label>
        </>
      )}

      {auth.type === 'apikey' && (
        <>
          <label className="label">
            Key
            <input className="field" value={auth.key || ''} onChange={(e) => setAuth({ key: e.target.value })} />
          </label>
          <label className="label">
            Value
            <input
              className="field"
              value={auth.value || ''}
              onChange={(e) => setAuth({ value: e.target.value })}
            />
          </label>
          <label className="label">
            Add to
            <select value={auth.addTo || 'header'} onChange={(e) => setAuth({ addTo: e.target.value })}>
              <option value="header">Header</option>
              <option value="query">Query param</option>
            </select>
          </label>
        </>
      )}
    </div>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from './api/client'
import { CollectionTree } from './components/CollectionTree'
import { RequestEditor } from './components/RequestEditor'
import { ResponseViewer } from './components/ResponseViewer'
import { EnvironmentsPanel } from './components/EnvironmentsPanel'
import { HistoryPanel } from './components/HistoryPanel'
import { Modal } from './components/Modal'
import {
  createEmptyFolder,
  createEmptyRequest,
  exportCollectionFile,
  removeItem,
  resolveRequest,
  updateItem,
} from './utils/helpers'

function BrandMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 12c5-8 13-8 18 0" stroke="#FF7A18" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M6 15c3.2-4.5 8.8-4.5 12 0" stroke="#1AA6A6" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="18" r="1.8" fill="#EFC66A" />
    </svg>
  )
}

function collectFolderIds(items, set) {
  for (const item of items) {
    if (item.type === 'folder') {
      set.add(item.id)
      collectFolderIds(item.children || [], set)
    }
  }
}

export default function App() {
  const [online, setOnline] = useState(false)
  const [dataPath, setDataPath] = useState('')
  const [sideTab, setSideTab] = useState('collections')
  const [collectionSummaries, setCollectionSummaries] = useState([])
  const [collections, setCollections] = useState({})
  const [selected, setSelected] = useState({ collectionId: null, request: null })
  const [draft, setDraft] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [response, setResponse] = useState(null)
  const [sending, setSending] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState(() => new Set())
  const [settings, setSettings] = useState({ activeEnvironmentId: null })
  const [envSummaries, setEnvSummaries] = useState([])
  const [selectedEnv, setSelectedEnv] = useState(null)
  const [activeEnv, setActiveEnv] = useState(null)
  const [envDirty, setEnvDirty] = useState(false)
  const [history, setHistory] = useState([])
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState('')

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  const loadBoot = useCallback(async () => {
    try {
      const health = await api.health()
      setOnline(true)
      setDataPath(health.dataPath || '')
      const [cols, envs, hist, sett] = await Promise.all([
        api.listCollections(),
        api.listEnvironments(),
        api.getHistory(),
        api.getSettings(),
      ])
      setCollectionSummaries(cols)
      setEnvSummaries(envs)
      setHistory(hist)
      setSettings(sett)

      const full = {}
      const folderIds = new Set()
      for (const c of cols) {
        full[c.id] = await api.getCollection(c.id)
        collectFolderIds(full[c.id].items || [], folderIds)
      }
      setCollections(full)
      setExpandedFolders(folderIds)

      if (sett.activeEnvironmentId) {
        try {
          const env = await api.getEnvironment(sett.activeEnvironmentId)
          setSelectedEnv(env)
          setActiveEnv(env)
        } catch {
          setSelectedEnv(null)
          setActiveEnv(null)
        }
      }
    } catch {
      setOnline(false)
    }
  }, [])

  useEffect(() => {
    loadBoot()
  }, [loadBoot])

  const activeVariables = useMemo(() => activeEnv?.variables || [], [activeEnv])

  const resolved = useMemo(() => {
    if (!draft) return null
    return resolveRequest(draft, activeVariables)
  }, [draft, activeVariables])

  const treeCollections = useMemo(
    () =>
      collectionSummaries.map((s) => ({
        ...s,
        items: collections[s.id]?.items || [],
      })),
    [collectionSummaries, collections]
  )

  const refreshCollections = async () => {
    const cols = await api.listCollections()
    setCollectionSummaries(cols)
    const full = { ...collections }
    for (const c of cols) {
      full[c.id] = await api.getCollection(c.id)
    }
    setCollections(full)
  }

  const refreshEnvs = async () => {
    setEnvSummaries(await api.listEnvironments())
  }

  const onSelectRequest = (collectionId, item) => {
    if (dirty && !window.confirm('Discard unsaved changes?')) return
    setSelected({ collectionId, request: item })
    setDraft(structuredClone(item))
    setDirty(false)
    setResponse(null)
  }

  const onDraftChange = (next) => {
    setDraft(next)
    setDirty(true)
  }

  const persistCollection = async (collectionId, nextCollection) => {
    const saved = await api.saveCollection(collectionId, nextCollection)
    setCollections((prev) => ({ ...prev, [collectionId]: saved }))
    setCollectionSummaries(await api.listCollections())
    return saved
  }

  const onSaveRequest = async () => {
    if (!selected.collectionId || !draft) return
    const col = collections[selected.collectionId]
    const items = updateItem(col.items || [], draft.id, draft)
    await persistCollection(selected.collectionId, { ...col, items })
    setSelected({ collectionId: selected.collectionId, request: draft })
    setDirty(false)
    showToast('Saved to filesystem')
  }

  const onSend = async () => {
    if (!resolved) return
    setSending(true)
    setResponse(null)
    try {
      const result = await api.proxy({
        name: resolved.name,
        method: resolved.method,
        url: resolved.url,
        params: resolved.params,
        headers: resolved.headers,
        auth: resolved.auth,
        body: resolved.body,
      })
      setResponse(result)
      setHistory(await api.getHistory())
    } catch (err) {
      setResponse({ error: err.message, duration: 0 })
    } finally {
      setSending(false)
    }
  }

  const onNewCollection = () => {
    setModal({
      type: 'new-collection',
      name: 'New Collection',
      description: '',
    })
  }

  const confirmNewCollection = async () => {
    const created = await api.createCollection({
      name: modal.name || 'New Collection',
      description: modal.description || '',
      items: [createEmptyRequest('Sample GET')],
    })
    await refreshCollections()
    setModal(null)
    onSelectRequest(created.id, created.items[0])
    showToast('Collection created')
  }

  const onNewRequest = async (collectionId) => {
    const name = window.prompt('Request name', 'New Request')
    if (!name) return
    const col = collections[collectionId]
    const req = createEmptyRequest(name)
    const items = [...(col.items || []), req]
    await persistCollection(collectionId, { ...col, items })
    onSelectRequest(collectionId, req)
  }

  const onNewFolder = async (collectionId) => {
    const name = window.prompt('Folder name', 'New Folder')
    if (!name) return
    const col = collections[collectionId]
    const folder = createEmptyFolder(name)
    const items = [...(col.items || []), folder]
    await persistCollection(collectionId, { ...col, items })
    setExpandedFolders((prev) => new Set(prev).add(folder.id))
  }

  const onDeleteCollection = async (id, name) => {
    if (!window.confirm(`Delete collection "${name}"? This removes the JSON file from disk.`)) return
    await api.deleteCollection(id)
    if (selected.collectionId === id) {
      setSelected({ collectionId: null, request: null })
      setDraft(null)
      setDirty(false)
    }
    await refreshCollections()
    showToast('Collection deleted')
  }

  const onRenameCollection = (col) => {
    setModal({ type: 'rename-collection', id: col.id, name: col.name, description: collections[col.id]?.description || '' })
  }

  const confirmRename = async () => {
    const col = collections[modal.id]
    await persistCollection(modal.id, { ...col, name: modal.name, description: modal.description })
    setModal(null)
    showToast('Collection updated')
  }

  const onExportCollection = async (id) => {
    const col = collections[id] || (await api.getCollection(id))
    exportCollectionFile(col)
  }

  const onImportPostman = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const json = JSON.parse(text)
        if (json.info && json.item) {
          await api.importPostman(json)
        } else if (json.schemaVersion && json.items) {
          await api.createCollection({
            name: json.name,
            description: json.description,
            items: json.items,
          })
        } else {
          throw new Error('Unrecognized collection format')
        }
        await refreshCollections()
        showToast('Imported collection')
      } catch (err) {
        alert(err.message || 'Import failed')
      }
    }
    input.click()
  }

  const onToggleFolder = (id) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const onSelectEnv = async (id) => {
    if (envDirty && !window.confirm('Discard environment changes?')) return
    setSelectedEnv(await api.getEnvironment(id))
    setEnvDirty(false)
  }

  const onSaveEnv = async () => {
    if (!selectedEnv) return
    const saved = await api.saveEnvironment(selectedEnv.id, selectedEnv)
    setSelectedEnv(saved)
    if (settings.activeEnvironmentId === saved.id) setActiveEnv(saved)
    setEnvDirty(false)
    await refreshEnvs()
    showToast('Environment saved')
  }

  const onActivateEnv = async (id) => {
    const sett = await api.saveSettings({ activeEnvironmentId: id })
    setSettings(sett)
    const env = await api.getEnvironment(id)
    setActiveEnv(env)
    showToast('Active environment set')
  }

  const onCreateEnv = async () => {
    const name = window.prompt('Environment name', 'Staging')
    if (!name) return
    const env = await api.createEnvironment({
      name,
      variables: [
        { id: crypto.randomUUID(), key: 'baseUrl', value: 'https://api.example.com', enabled: true },
      ],
    })
    await refreshEnvs()
    setSelectedEnv(env)
    setEnvDirty(false)
  }

  const onDeleteEnv = async (id) => {
    if (!window.confirm('Delete this environment file?')) return
    await api.deleteEnvironment(id)
    if (selectedEnv?.id === id) setSelectedEnv(null)
    if (settings.activeEnvironmentId === id) {
      setSettings(await api.saveSettings({ activeEnvironmentId: null }))
      setActiveEnv(null)
    }
    await refreshEnvs()
  }

  const onReplay = (item) => {
    if (!item.requestSnapshot) return
    if (dirty && !window.confirm('Discard unsaved changes?')) return
    const req = {
      ...createEmptyRequest(item.name || 'Replayed'),
      ...item.requestSnapshot,
      id: draft?.id || crypto.randomUUID(),
      type: 'request',
      name: item.name || item.requestSnapshot.url || 'Replayed',
    }
    setDraft(req)
    setSelected({ collectionId: selected.collectionId, request: req })
    setDirty(true)
    setSideTab('collections')
    showToast('Loaded from history — save into a collection if you want to keep it')
  }

  const onClearHistory = async () => {
    if (!window.confirm('Clear request history file?')) return
    await api.clearHistory()
    setHistory([])
  }

  const onDeleteCurrentRequest = async () => {
    if (!selected.collectionId || !draft) return
    if (!window.confirm(`Delete request "${draft.name}"?`)) return
    const col = collections[selected.collectionId]
    const items = removeItem(col.items || [], draft.id)
    await persistCollection(selected.collectionId, { ...col, items })
    setSelected({ collectionId: selected.collectionId, request: null })
    setDraft(null)
    setDirty(false)
    setResponse(null)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <BrandMark />
          </div>
          <div className="brand-copy">
            <div className="brand-name">API Messenger</div>
            <div className="brand-tag">Local API client · collections on your filesystem</div>
          </div>
        </div>
        <div className="topbar-actions">
          <span className="pill" title={dataPath}>
            <span className={`status-dot ${online ? '' : 'offline'}`} />
            {online ? 'Local server' : 'Server offline'}
          </span>
          <span className="pill" title="Active environment">
            Env: {activeEnv?.name || 'None'}
          </span>
          <button type="button" className="btn btn-sm" onClick={onImportPostman}>
            Import
          </button>
          <button type="button" className="btn btn-sm btn-primary" onClick={onNewCollection}>
            New collection
          </button>
          {draft && selected.collectionId && (
            <button type="button" className="btn btn-sm btn-danger" onClick={onDeleteCurrentRequest}>
              Delete request
            </button>
          )}
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <div className="sidebar-tabs">
            {[
              ['collections', 'Collections'],
              ['environments', 'Environments'],
              ['history', 'History'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`sidebar-tab ${sideTab === id ? 'active' : ''}`}
                onClick={() => setSideTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="sidebar-body">
            {sideTab === 'collections' && (
              <CollectionTree
                collections={treeCollections}
                selectedId={draft?.id}
                onSelectRequest={onSelectRequest}
                expandedFolders={expandedFolders}
                onToggleFolder={onToggleFolder}
                onNewRequest={onNewRequest}
                onNewFolder={onNewFolder}
                onRenameCollection={onRenameCollection}
                onDeleteCollection={onDeleteCollection}
                onExportCollection={onExportCollection}
              />
            )}
            {sideTab === 'environments' && (
              <EnvironmentsPanel
                environments={envSummaries}
                activeId={settings.activeEnvironmentId}
                selectedEnv={selectedEnv}
                onSelect={onSelectEnv}
                onActivate={onActivateEnv}
                onChangeVariables={(env) => {
                  setSelectedEnv(env)
                  setEnvDirty(true)
                }}
                onSave={onSaveEnv}
                onCreate={onCreateEnv}
                onDelete={onDeleteEnv}
                dirty={envDirty}
              />
            )}
            {sideTab === 'history' && (
              <HistoryPanel history={history} onReplay={onReplay} onClear={onClearHistory} />
            )}
          </div>
        </aside>

        <main className="main-pane">
          <RequestEditor
            request={draft}
            onChange={onDraftChange}
            onSend={onSend}
            sending={sending}
            onSave={onSaveRequest}
            dirty={dirty}
            responseSlot={
              <ResponseViewer response={response} sending={sending} resolvedRequest={resolved} />
            }
          />
        </main>
      </div>

      {toast && (
        <div
          style={{
            position: 'fixed',
            right: 16,
            bottom: 16,
            background: '#0b3c4a',
            color: '#eef7f8',
            padding: '0.7rem 1rem',
            borderRadius: 12,
            boxShadow: '0 12px 30px rgba(0,0,0,0.2)',
            zIndex: 60,
          }}
        >
          {toast}
        </div>
      )}

      {modal?.type === 'new-collection' && (
        <Modal
          title="New collection"
          onClose={() => setModal(null)}
          onConfirm={confirmNewCollection}
          confirmLabel="Create"
          disableConfirm={!modal.name.trim()}
        >
          <div className="form-stack">
            <label className="label">
              Name
              <input
                className="field"
                value={modal.name}
                onChange={(e) => setModal({ ...modal, name: e.target.value })}
              />
            </label>
            <label className="label">
              Description
              <input
                className="field"
                value={modal.description}
                onChange={(e) => setModal({ ...modal, description: e.target.value })}
              />
            </label>
          </div>
        </Modal>
      )}

      {modal?.type === 'rename-collection' && (
        <Modal title="Edit collection" onClose={() => setModal(null)} onConfirm={confirmRename}>
          <div className="form-stack">
            <label className="label">
              Name
              <input
                className="field"
                value={modal.name}
                onChange={(e) => setModal({ ...modal, name: e.target.value })}
              />
            </label>
            <label className="label">
              Description
              <input
                className="field"
                value={modal.description}
                onChange={(e) => setModal({ ...modal, description: e.target.value })}
              />
            </label>
          </div>
        </Modal>
      )}
    </div>
  )
}

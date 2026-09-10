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
    <img src="/bupa-logo.png" alt="Bupa" />
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
  const [theme, setTheme] = useState(() => localStorage.getItem('b-postman-theme') || 'light')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('b-postman-sidebar-collapsed') === '1'
  )
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = Number(localStorage.getItem('b-postman-sidebar-width'))
    return Number.isFinite(saved) && saved >= 220 ? saved : 300
  })
  const [online, setOnline] = useState(false)
  const [dataPath, setDataPath] = useState('')
  const [sideTab, setSideTab] = useState('collections')
  const [collectionSummaries, setCollectionSummaries] = useState([])
  const [collections, setCollections] = useState({})
  const [selected, setSelected] = useState({ collectionId: null, request: null })
  const [draft, setDraft] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [response, setResponse] = useState(null)
  const [sentRequest, setSentRequest] = useState(null)
  const [sending, setSending] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState(() => new Set())
  const [expandedCollections, setExpandedCollections] = useState(() => new Set())
  const [settings, setSettings] = useState({ activeEnvironmentId: null })
  const [envSummaries, setEnvSummaries] = useState([])
  const [envDetails, setEnvDetails] = useState({})
  const [expandedEnvironments, setExpandedEnvironments] = useState(() => new Set())
  const [activeEnv, setActiveEnv] = useState(null)
  const [dirtyEnvId, setDirtyEnvId] = useState(null)
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
      const collectionIds = new Set()
      for (const c of cols) {
        full[c.id] = await api.getCollection(c.id)
        collectFolderIds(full[c.id].items || [], folderIds)
        collectionIds.add(c.id)
      }
      setCollections(full)
      setExpandedFolders(folderIds)
      setExpandedCollections(collectionIds)

      if (sett.activeEnvironmentId) {
        try {
          const env = await api.getEnvironment(sett.activeEnvironmentId)
          setEnvDetails((prev) => ({ ...prev, [env.id]: env }))
          setExpandedEnvironments(new Set([env.id]))
          setActiveEnv(env)
        } catch {
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

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('b-postman-theme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('b-postman-sidebar-collapsed', sidebarCollapsed ? '1' : '0')
  }, [sidebarCollapsed])

  useEffect(() => {
    localStorage.setItem('b-postman-sidebar-width', String(sidebarWidth))
  }, [sidebarWidth])

  const onResizeSidebarStart = (event) => {
    if (sidebarCollapsed) return
    event.preventDefault()
    const startX = event.clientX
    const startWidth = sidebarWidth

    const onMove = (moveEvent) => {
      const next = Math.min(560, Math.max(220, startWidth + (moveEvent.clientX - startX)))
      setSidebarWidth(next)
    }

    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.classList.remove('resizing-sidebar')
    }

    document.body.classList.add('resizing-sidebar')
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

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
    setExpandedCollections((prev) => {
      const next = new Set(prev)
      for (const c of cols) next.add(c.id)
      return next
    })
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
    setSentRequest(null)
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
    const snapshot = structuredClone(resolved)
    setSending(true)
    setResponse(null)
    setSentRequest(snapshot)
    try {
      const result = await api.proxy({
        name: snapshot.name,
        method: snapshot.method,
        url: snapshot.url,
        params: snapshot.params,
        headers: snapshot.headers,
        auth: snapshot.auth,
        body: snapshot.body,
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
        showToast('Importing…')
        const result = await api.importFile(file)
        await refreshCollections()
        await refreshEnvs()
        const sett = await api.getSettings()
        setSettings(sett)
        if (sett.activeEnvironmentId) {
          const env = await api.getEnvironment(sett.activeEnvironmentId)
          setEnvDetails((prev) => ({ ...prev, [env.id]: env }))
          setExpandedEnvironments(new Set([env.id]))
          setActiveEnv(env)
        }
        if (result.environment?.id) {
          setEnvDetails((prev) => ({ ...prev, [result.environment.id]: result.environment }))
          setExpandedEnvironments((prev) => new Set(prev).add(result.environment.id))
        }
        const kindLabel =
          result.kind === 'openapi'
            ? 'OpenAPI/Swagger'
            : result.kind === 'postman'
              ? 'Postman'
              : 'B Postman'
        showToast(`Imported ${kindLabel} collection${result.environment ? ' + environment' : ''}`)
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

  const onToggleCollection = (id) => {
    setExpandedCollections((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const onToggleEnvironment = async (id) => {
    const isOpen = expandedEnvironments.has(id)
    if (isOpen) {
      if (dirtyEnvId === id && !window.confirm('Discard unsaved environment changes?')) return
      setExpandedEnvironments((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      if (dirtyEnvId === id) setDirtyEnvId(null)
      return
    }

    if (!envDetails[id]) {
      const env = await api.getEnvironment(id)
      setEnvDetails((prev) => ({ ...prev, [id]: env }))
    }
    setExpandedEnvironments((prev) => new Set(prev).add(id))
  }

  const onChangeEnvironment = (env) => {
    setEnvDetails((prev) => ({ ...prev, [env.id]: env }))
    setDirtyEnvId(env.id)
  }

  const onSaveEnv = async (id) => {
    const current = envDetails[id]
    if (!current) return
    const saved = await api.saveEnvironment(id, current)
    setEnvDetails((prev) => ({ ...prev, [id]: saved }))
    if (settings.activeEnvironmentId === saved.id) setActiveEnv(saved)
    if (dirtyEnvId === id) setDirtyEnvId(null)
    await refreshEnvs()
    showToast('Environment saved')
  }

  const onActivateEnv = async (id) => {
    const sett = await api.saveSettings({ activeEnvironmentId: id })
    setSettings(sett)
    const env = envDetails[id] || (await api.getEnvironment(id))
    setEnvDetails((prev) => ({ ...prev, [id]: env }))
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
    setEnvDetails((prev) => ({ ...prev, [env.id]: env }))
    setExpandedEnvironments((prev) => new Set(prev).add(env.id))
    setDirtyEnvId(null)
  }

  const onDeleteEnv = async (id) => {
    if (!window.confirm('Delete this environment file?')) return
    await api.deleteEnvironment(id)
    setEnvDetails((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setExpandedEnvironments((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    if (dirtyEnvId === id) setDirtyEnvId(null)
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
    setSentRequest(null)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <BrandMark />
          </div>
          <div className="brand-copy">
            <div className="brand-name">B Postman</div>
            <div className="brand-tag">Local API client</div>
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
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            <span aria-hidden>{theme === 'dark' ? '☀' : '◐'}</span>
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
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

      <div
        className={`workspace ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}
        style={{ '--sidebar': sidebarCollapsed ? '52px' : `${sidebarWidth}px` }}
      >
        <aside className={`sidebar ${sidebarCollapsed ? 'is-collapsed' : ''}`}>
          {sidebarCollapsed ? (
            <div className="sidebar-rail">
              <button
                type="button"
                className="sidebar-rail-btn sidebar-toggle-btn"
                onClick={() => setSidebarCollapsed(false)}
                title="Expand menu"
                aria-label="Expand menu"
              >
                ☰
              </button>
              <button
                type="button"
                className={`sidebar-rail-btn ${sideTab === 'collections' ? 'active' : ''}`}
                onClick={() => {
                  setSideTab('collections')
                  setSidebarCollapsed(false)
                }}
                title="Collections"
              >
                C
              </button>
              <button
                type="button"
                className={`sidebar-rail-btn ${sideTab === 'environments' ? 'active' : ''}`}
                onClick={async () => {
                  setSideTab('environments')
                  setSidebarCollapsed(false)
                  if (settings.activeEnvironmentId && !expandedEnvironments.has(settings.activeEnvironmentId)) {
                    const envId = settings.activeEnvironmentId
                    if (!envDetails[envId]) {
                      const env = await api.getEnvironment(envId)
                      setEnvDetails((prev) => ({ ...prev, [envId]: env }))
                    }
                    setExpandedEnvironments((prev) => new Set(prev).add(envId))
                  }
                }}
                title="Environments"
              >
                E
              </button>
              <button
                type="button"
                className={`sidebar-rail-btn ${sideTab === 'history' ? 'active' : ''}`}
                onClick={() => {
                  setSideTab('history')
                  setSidebarCollapsed(false)
                }}
                title="History"
              >
                H
              </button>
            </div>
          ) : (
            <>
              <div className="sidebar-tabs">
                <button
                  type="button"
                  className="sidebar-toggle-btn"
                  onClick={() => setSidebarCollapsed(true)}
                  title="Collapse menu"
                  aria-label="Collapse menu"
                >
                  ☰
                </button>
                {[
                  ['collections', 'Collections'],
                  ['environments', 'Environments'],
                  ['history', 'History'],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={`sidebar-tab ${sideTab === id ? 'active' : ''}`}
                    onClick={async () => {
                      setSideTab(id)
                      if (id === 'environments' && settings.activeEnvironmentId) {
                        const envId = settings.activeEnvironmentId
                        if (!expandedEnvironments.has(envId)) {
                          if (!envDetails[envId]) {
                            const env = await api.getEnvironment(envId)
                            setEnvDetails((prev) => ({ ...prev, [envId]: env }))
                          }
                          setExpandedEnvironments((prev) => new Set(prev).add(envId))
                        }
                      }
                    }}
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
                    expandedCollections={expandedCollections}
                    onToggleCollection={onToggleCollection}
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
                    envDetails={envDetails}
                    expandedIds={expandedEnvironments}
                    onToggle={onToggleEnvironment}
                    onActivate={onActivateEnv}
                    onChangeEnvironment={onChangeEnvironment}
                    onSave={onSaveEnv}
                    onCreate={onCreateEnv}
                    onDelete={onDeleteEnv}
                    dirtyId={dirtyEnvId}
                  />
                )}
                {sideTab === 'history' && (
                  <HistoryPanel history={history} onReplay={onReplay} onClear={onClearHistory} />
                )}
              </div>
              <div
                className="sidebar-resizer"
                onMouseDown={onResizeSidebarStart}
                title="Drag to resize sidebar"
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize sidebar"
              />
            </>
          )}
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
              <ResponseViewer response={response} sending={sending} sentRequest={sentRequest} />
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
            background: '#0079c7',
            color: '#ffffff',
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

import { useMemo, useState } from 'react'
import { methodColor } from '../utils/helpers'

function FolderIcon({ open = false }) {
  return (
    <svg className="folder-icon" viewBox="0 0 20 20" aria-hidden="true">
      {open ? (
        <>
          <path
            d="M2.5 6.2h5.1l1.4 1.4H17.5v7.2a1.7 1.7 0 0 1-1.7 1.7H4.2a1.7 1.7 0 0 1-1.7-1.7V6.2z"
            fill="currentColor"
            opacity="0.22"
          />
          <path
            d="M2.5 7.8h15v6.8a1.5 1.5 0 0 1-1.5 1.5H4a1.5 1.5 0 0 1-1.5-1.5V7.8z"
            fill="currentColor"
          />
        </>
      ) : (
        <path
          d="M2.8 5.2h5l1.3 1.4h8.1c.8 0 1.5.7 1.5 1.5v7.2c0 .8-.7 1.5-1.5 1.5H2.8c-.8 0-1.5-.7-1.5-1.5V6.7c0-.8.7-1.5 1.5-1.5z"
          fill="currentColor"
        />
      )}
    </svg>
  )
}

function CollectionIcon() {
  return (
    <svg className="collection-glyph" viewBox="0 0 20 20" aria-hidden="true">
      <rect x="3" y="3" width="14" height="14" rx="3" fill="currentColor" />
      <path d="M6 8h8M6 10.5h8M6 13h5" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function matchesQuery(text, query) {
  if (!query) return true
  return String(text || '').toLowerCase().includes(query)
}

function filterTreeItems(items = [], query) {
  if (!query) return items
  const result = []
  for (const item of items) {
    if (item.type === 'folder') {
      const children = filterTreeItems(item.children || [], query)
      if (matchesQuery(item.name, query) || children.length) {
        result.push({ ...item, children })
      }
    } else if (matchesQuery(item.name, query) || matchesQuery(item.method, query) || matchesQuery(item.url, query)) {
      result.push(item)
    }
  }
  return result
}

function TreeNodes({
  items,
  depth = 0,
  selectedId,
  onSelect,
  expandedFolders,
  onToggleFolder,
  forceExpand,
}) {
  return (
    <div className={depth ? 'tree-children' : undefined}>
      {items.map((item) => {
        if (item.type === 'folder') {
          const open = forceExpand || expandedFolders.has(item.id)
          return (
            <div key={item.id}>
              <button
                type="button"
                className="tree-item"
                onClick={() => onToggleFolder(item.id)}
              >
                <span className="folder-arrow" aria-hidden>{open ? '▾' : '▸'}</span>
                <FolderIcon open={open} />
                <span className="truncate">{item.name}</span>
              </button>
              {open && (
                <TreeNodes
                  items={item.children || []}
                  depth={depth + 1}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  expandedFolders={expandedFolders}
                  onToggleFolder={onToggleFolder}
                  forceExpand={forceExpand}
                />
              )}
            </div>
          )
        }

        return (
          <button
            key={item.id}
            type="button"
            className={`tree-item ${selectedId === item.id ? 'active' : ''}`}
            onClick={() => onSelect(item)}
          >
            <span className={`method-badge ${methodColor(item.method)}`}>{item.method}</span>
            <span className="truncate">{item.name}</span>
          </button>
        )
      })}
    </div>
  )
}

export function CollectionTree({
  collections,
  selectedId,
  onSelectRequest,
  expandedFolders,
  onToggleFolder,
  expandedCollections,
  onToggleCollection,
  onNewRequest,
  onNewFolder,
  onRenameCollection,
  onDeleteCollection,
  onExportCollection,
}) {
  const [search, setSearch] = useState('')
  const query = search.trim().toLowerCase()

  const filteredCollections = useMemo(() => {
    if (!query) return collections
    return collections
      .map((col) => {
        const items = filterTreeItems(col.items || [], query)
        const nameMatch = matchesQuery(col.name, query) || matchesQuery(col.description, query)
        if (!nameMatch && !items.length) return null
        return {
          ...col,
          items: nameMatch && !items.length ? col.items || [] : items,
          itemCount: items.length || col.itemCount,
        }
      })
      .filter(Boolean)
  }, [collections, query])

  if (!collections.length) {
    return (
      <div className="empty-state">
        <h2>No collections yet</h2>
        <p>Create a collection to start saving requests on your filesystem.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="collection-search">
        <input
          className="field collection-search-input"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search collections, folders, requests…"
          aria-label="Search collections"
        />
        {search && (
          <button type="button" className="btn btn-sm collection-search-clear" onClick={() => setSearch('')}>
            Clear
          </button>
        )}
      </div>

      {!filteredCollections.length && (
        <div className="empty-state">
          <h2>No matches</h2>
          <p>No collections or requests match “{search.trim()}”.</p>
        </div>
      )}

      {filteredCollections.map((col) => {
        const searching = Boolean(query)
        const open = searching || expandedCollections.has(col.id)
        const forceExpandFolders = searching
        return (
          <div className={`tree-collection ${open ? 'is-open' : 'is-closed'}`} key={col.id}>
            <div className="tree-collection-head">
              <button
                type="button"
                className="collection-toggle"
                onClick={() => onToggleCollection(col.id)}
                title={open ? 'Collapse collection' : 'Expand collection'}
                aria-expanded={open}
              >
                <span className="folder-arrow" aria-hidden>{open ? '▾' : '▸'}</span>
                <span className="collection-icon" aria-hidden>
                  <CollectionIcon />
                </span>
                <div className="collection-copy">
                  <div className="tree-collection-title">{col.name}</div>
                  <div className="muted">
                    {col.itemCount ?? 0} requests · Local collection
                    {searching ? ' · filtered' : ''}
                  </div>
                </div>
              </button>
              <div className="collection-actions">
                <button type="button" className="btn btn-sm" title="Add request" onClick={() => onNewRequest(col.id)}>
                  +Req
                </button>
                <button type="button" className="btn btn-sm" title="Add folder" onClick={() => onNewFolder(col.id)}>
                  +Folder
                </button>
                <button type="button" className="btn btn-sm" title="Export" onClick={() => onExportCollection(col.id)}>
                  Export
                </button>
                <button type="button" className="btn btn-sm" title="Rename" onClick={() => onRenameCollection(col)}>
                  Rename
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  title="Delete"
                  onClick={() => onDeleteCollection(col.id, col.name)}
                >
                  Delete
                </button>
              </div>
            </div>
            {open && (
              <div className="tree-collection-body">
                <TreeNodes
                  items={col.items || []}
                  selectedId={selectedId}
                  onSelect={(item) => onSelectRequest(col.id, item)}
                  expandedFolders={expandedFolders}
                  onToggleFolder={onToggleFolder}
                  forceExpand={forceExpandFolders}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

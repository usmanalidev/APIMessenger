import { methodColor } from '../utils/helpers'

function TreeNodes({ items, depth = 0, selectedId, onSelect, expandedFolders, onToggleFolder }) {
  return (
    <div className={depth ? 'tree-children' : undefined}>
      {items.map((item) => {
        if (item.type === 'folder') {
          const open = expandedFolders.has(item.id)
          return (
            <div key={item.id}>
              <button
                type="button"
                className="tree-item"
                onClick={() => onToggleFolder(item.id)}
              >
                <span aria-hidden>{open ? '▾' : '▸'}</span>
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
  onNewRequest,
  onNewFolder,
  onRenameCollection,
  onDeleteCollection,
  onExportCollection,
}) {
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
      {collections.map((col) => (
        <div className="tree-collection" key={col.id}>
          <div className="tree-collection-head">
            <div>
              <div className="tree-collection-title">{col.name}</div>
              <div className="muted">{col.itemCount ?? 0} requests</div>
            </div>
            <div className="split-actions">
              <button type="button" className="btn btn-sm" title="Add request" onClick={() => onNewRequest(col.id)}>
                +Req
              </button>
              <button type="button" className="btn btn-sm" title="Add folder" onClick={() => onNewFolder(col.id)}>
                +Folder
              </button>
              <button type="button" className="btn btn-sm" title="Export" onClick={() => onExportCollection(col.id)}>
                ⤓
              </button>
              <button type="button" className="btn btn-sm" title="Rename" onClick={() => onRenameCollection(col)}>
                ✎
              </button>
              <button
                type="button"
                className="btn btn-sm btn-danger"
                title="Delete"
                onClick={() => onDeleteCollection(col.id, col.name)}
              >
                ✕
              </button>
            </div>
          </div>
          <TreeNodes
            items={col.items || []}
            selectedId={selectedId}
            onSelect={(item) => onSelectRequest(col.id, item)}
            expandedFolders={expandedFolders}
            onToggleFolder={onToggleFolder}
          />
        </div>
      ))}
    </div>
  )
}

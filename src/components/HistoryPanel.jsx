import { methodColor, formatBytes } from '../utils/helpers'

export function HistoryPanel({ history, onReplay, onClear }) {
  return (
    <div>
      <div className="sidebar-toolbar">
        <button type="button" className="btn btn-sm btn-danger" onClick={onClear} disabled={!history.length}>
          Clear history
        </button>
      </div>

      {!history.length && (
        <div className="empty-state">
          <h2>No history</h2>
          <p>Sent requests are stored in data/history.json on disk.</p>
        </div>
      )}

      {history.map((item) => (
        <button key={item.id} type="button" className="history-item" onClick={() => onReplay(item)}>
          <div className="history-top">
            <span className={`method-badge ${methodColor(item.method)}`}>{item.method}</span>
            <span className={`pill ${item.status >= 400 ? 'err' : 'ok'}`}>{item.status || '—'}</span>
          </div>
          <div className="truncate" title={item.url}>
            {item.url}
          </div>
          <div className="muted">
            {new Date(item.timestamp).toLocaleString()} · {item.duration} ms · {formatBytes(item.size || 0)}
          </div>
        </button>
      ))}
    </div>
  )
}

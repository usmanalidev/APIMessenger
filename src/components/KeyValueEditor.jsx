export function KeyValueEditor({ rows, onChange, keyPlaceholder = 'Key', valuePlaceholder = 'Value' }) {
  const updateRow = (id, patch) => {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  const removeRow = (id) => {
    onChange(rows.filter((r) => r.id !== id))
  }

  return (
    <div>
      <div className="kv kv-head">
        <span />
        <span>{keyPlaceholder}</span>
        <span>{valuePlaceholder}</span>
        <span />
      </div>
      {rows.map((row) => (
        <div className="kv" key={row.id}>
          <input
            type="checkbox"
            checked={row.enabled !== false}
            onChange={(e) => updateRow(row.id, { enabled: e.target.checked })}
            title="Enabled"
          />
          <input
            value={row.key}
            onChange={(e) => updateRow(row.id, { key: e.target.value })}
            placeholder={keyPlaceholder}
          />
          <input
            value={row.value}
            onChange={(e) => updateRow(row.id, { value: e.target.value })}
            placeholder={valuePlaceholder}
          />
          <button type="button" className="btn btn-sm btn-ghost btn-danger" onClick={() => removeRow(row.id)}>
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}

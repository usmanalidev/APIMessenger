import { KeyValueEditor } from './KeyValueEditor'
import { createKvRow } from '../utils/helpers'

export function EnvironmentsPanel({
  environments,
  activeId,
  selectedEnv,
  onSelect,
  onActivate,
  onChangeVariables,
  onSave,
  onCreate,
  onDelete,
  dirty,
}) {
  return (
    <div>
      <div className="sidebar-toolbar">
        <button type="button" className="btn btn-sm btn-primary" onClick={onCreate}>
          New environment
        </button>
      </div>

      {environments.map((env) => (
        <button
          key={env.id}
          type="button"
          className={`env-item ${selectedEnv?.id === env.id ? 'active' : ''}`}
          onClick={() => onSelect(env.id)}
        >
          <div className="env-top">
            <strong>{env.name}</strong>
            {activeId === env.id && <span className="pill ok">Active</span>}
          </div>
          <div className="muted">{env.variableCount ?? 0} variables</div>
        </button>
      ))}

      {selectedEnv && (
        <div style={{ marginTop: '0.85rem' }}>
          <div className="split-actions" style={{ marginBottom: '0.65rem' }}>
            <button type="button" className="btn btn-sm" onClick={() => onActivate(selectedEnv.id)}>
              Set active
            </button>
            <button type="button" className="btn btn-sm" onClick={onSave} disabled={!dirty}>
              Save
            </button>
            <button type="button" className="btn btn-sm btn-danger" onClick={() => onDelete(selectedEnv.id)}>
              Delete
            </button>
          </div>
          <input
            className="field"
            style={{ marginBottom: '0.55rem' }}
            value={selectedEnv.name}
            onChange={(e) => onChangeVariables({ ...selectedEnv, name: e.target.value })}
          />
          <KeyValueEditor
            rows={selectedEnv.variables || []}
            onChange={(variables) => onChangeVariables({ ...selectedEnv, variables })}
            keyPlaceholder="Variable"
            valuePlaceholder="Value"
          />
          <button
            type="button"
            className="btn btn-sm"
            onClick={() =>
              onChangeVariables({
                ...selectedEnv,
                variables: [...(selectedEnv.variables || []), createKvRow()],
              })
            }
          >
            Add variable
          </button>
          <p className="hint">Reference these as {'{{name}}'} in URLs, headers, body, and auth.</p>
        </div>
      )}
    </div>
  )
}

import { KeyValueEditor } from './KeyValueEditor'
import { createKvRow } from '../utils/helpers'

export function EnvironmentsPanel({
  environments,
  activeId,
  envDetails,
  expandedIds,
  onToggle,
  onActivate,
  onChangeEnvironment,
  onSave,
  onCreate,
  onDelete,
  dirtyId,
}) {
  return (
    <div>
      <div className="sidebar-toolbar">
        <button type="button" className="btn btn-sm btn-primary" onClick={onCreate}>
          New environment
        </button>
      </div>

      {!environments.length && (
        <div className="empty-state">
          <h2>No environments</h2>
          <p>Create one to store {'{{variables}}'} like baseUrl and tokens.</p>
        </div>
      )}

      {environments.map((env) => {
        const open = expandedIds.has(env.id)
        const detail = envDetails[env.id]
        const dirty = dirtyId === env.id

        return (
          <div key={env.id} className={`env-card ${open ? 'is-open' : 'is-closed'} ${activeId === env.id ? 'is-active' : ''}`}>
            <button
              type="button"
              className="env-card-toggle"
              onClick={() => onToggle(env.id)}
              aria-expanded={open}
              title={open ? 'Collapse environment' : 'Expand environment'}
            >
              <span className="folder-arrow" aria-hidden>{open ? '▾' : '▸'}</span>
              <div className="env-card-copy">
                <div className="env-card-title-row">
                  <strong className="truncate">{env.name}</strong>
                  {activeId === env.id && <span className="pill ok">Active</span>}
                </div>
                <div className="muted">
                  {(detail?.variables || []).length || env.variableCount || 0} variables
                  {dirty ? ' · Unsaved' : ''}
                </div>
              </div>
            </button>

            {open && (
              <div className="env-card-body">
                {!detail ? (
                  <p className="muted">Loading…</p>
                ) : (
                  <>
                    <div className="collection-actions">
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => onActivate(env.id)}
                        disabled={activeId === env.id}
                      >
                        {activeId === env.id ? 'Active' : 'Set active'}
                      </button>
                      <button type="button" className="btn btn-sm" onClick={() => onSave(env.id)} disabled={!dirty}>
                        Save
                      </button>
                      <button type="button" className="btn btn-sm btn-danger" onClick={() => onDelete(env.id)}>
                        Delete
                      </button>
                    </div>

                    <label className="label">
                      Name
                      <input
                        className="field"
                        value={detail.name}
                        onChange={(e) => onChangeEnvironment({ ...detail, name: e.target.value })}
                      />
                    </label>

                    <KeyValueEditor
                      rows={detail.variables || []}
                      onChange={(variables) => onChangeEnvironment({ ...detail, variables })}
                      keyPlaceholder="Variable"
                      valuePlaceholder="Value"
                    />

                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() =>
                        onChangeEnvironment({
                          ...detail,
                          variables: [...(detail.variables || []), createKvRow()],
                        })
                      }
                    >
                      Add variable
                    </button>
                    <p className="hint">Use {'{{name}}'} in URLs, headers, body, and auth.</p>
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

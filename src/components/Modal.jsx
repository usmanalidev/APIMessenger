export function Modal({ title, children, onClose, onConfirm, confirmLabel = 'Save', disableConfirm = false }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {children}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          {onConfirm && (
            <button type="button" className="btn btn-primary" onClick={onConfirm} disabled={disableConfirm}>
              {confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

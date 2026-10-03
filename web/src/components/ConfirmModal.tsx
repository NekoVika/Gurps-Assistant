
export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  note,
  secondaryText,
  onSecondary,
  confirmDisabled = false,
}: {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Shown under the message -- a refusal reason, a caveat. */
  note?: string | null;
  /** An alternative to confirming, e.g. "Create & open". */
  secondaryText?: string;
  onSecondary?: () => void;
  confirmDisabled?: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0, 0, 0, 0.75)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 9999
    }}>
      <div className="modal-content" style={{
        background: "#161b22", padding: "32px", borderRadius: "12px",
        border: "1px solid rgba(255, 60, 60, 0.3)", maxWidth: "400px", width: "100%",
        boxShadow: "0 12px 24px rgba(0,0,0,0.5)"
      }}>
        <h3 style={{ margin: "0 0 12px 0", color: "#ff7b72" }}>{title}</h3>
        <p style={{ margin: note ? "0 0 12px 0" : "0 0 24px 0", color: "#c9d1d9", lineHeight: 1.5 }}>{message}</p>
        {note && (
          <p role="alert" style={{
            margin: "0 0 20px 0", padding: "8px 12px", borderRadius: "6px", lineHeight: 1.5,
            background: "rgba(255, 180, 77, 0.10)", border: "1px solid rgba(255, 180, 77, 0.4)",
            color: "#ffb44d", fontSize: "0.85rem",
          }}>
            {note}
          </p>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
          <button onClick={onCancel} className="ghost-button" style={{ padding: "8px 16px", borderRadius: "6px" }}>
            {cancelText}
          </button>
          {secondaryText && onSecondary && (
            <button
              onClick={onSecondary}
              disabled={confirmDisabled}
              className="ghost-button"
              style={{ padding: "8px 16px", borderRadius: "6px", opacity: confirmDisabled ? 0.5 : 1 }}
            >
              {secondaryText}
            </button>
          )}
          <button onClick={onConfirm} disabled={confirmDisabled} style={{
            background: "#da3633", border: "1px solid transparent", color: "white",
            padding: "8px 16px", borderRadius: "6px", fontWeight: "bold",
            cursor: confirmDisabled ? "not-allowed" : "pointer", opacity: confirmDisabled ? 0.5 : 1,
          }}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

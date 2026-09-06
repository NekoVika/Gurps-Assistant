import { useEffect, useMemo, useRef, useState } from 'react';
import { useChatStore } from '../../stores/useChatStore';

/** Epoch seconds -> a short, glanceable age. */
function relativeTime(epochSeconds: number): string {
  const diff = Date.now() / 1000 - epochSeconds;
  if (!isFinite(diff) || diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 172800) return "yesterday";
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(epochSeconds * 1000).toLocaleDateString();
}

const ACCENT = "#79c0ff";
const MUTED = "#8b949e";
const TEXT = "#c9dfff";

/**
 * Session picker for the chat panel.
 *
 * Collapsed it shows the current chat; expanded it lists every session with
 * rename and delete on the row itself. Replaces a <select> plus window.prompt,
 * which gave no sense of what else was open and no way to act on a chat
 * without first switching to it.
 */
export function ChatSessionList() {
  const sessions = useChatStore(s => s.sessions);
  const activeSessionId = useChatStore(s => s.activeSessionId);
  const sessionsLoading = useChatStore(s => s.sessionsLoading);
  const setActiveSessionId = useChatStore(s => s.setActiveSessionId);
  const createNewSession = useChatStore(s => s.createNewSession);
  const renameSession = useChatStore(s => s.renameSession);
  const removeSession = useChatStore(s => s.removeSession);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const editRef = useRef<HTMLInputElement | null>(null);

  const ordered = useMemo(
    () => [...sessions].sort((a, b) => (b.updated_at ?? 0) - (a.updated_at ?? 0)),
    [sessions]
  );
  const active = sessions.find(s => s.id === activeSessionId) ?? null;

  useEffect(() => {
    if (editingId && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [editingId]);

  // Collapsing should not leave a half-finished rename or an armed delete.
  useEffect(() => {
    if (!open) {
      setEditingId(null);
      setConfirmingId(null);
    }
  }, [open]);

  const commitRename = (id: string) => {
    const next = draftTitle.trim();
    if (next && next !== sessions.find(s => s.id === id)?.title) {
      renameSession(id, next);
    }
    setEditingId(null);
  };

  const iconButton = (extra: React.CSSProperties = {}): React.CSSProperties => ({
    background: "transparent",
    border: "none",
    color: MUTED,
    cursor: "pointer",
    padding: "2px 4px",
    fontSize: "0.75rem",
    lineHeight: 1,
    borderRadius: "4px",
    ...extra,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          title={open ? "Hide chats" : "Show all chats"}
          style={{
            flexGrow: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "8px",
            background: "rgba(0,0,0,0.2)", border: "1px solid rgba(149, 181, 255, 0.2)",
            borderRadius: "6px", padding: "5px 9px", color: TEXT, cursor: "pointer",
            fontSize: "0.8rem", textAlign: "left",
          }}
        >
          <span style={{ color: MUTED, fontSize: "0.65rem", transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" }}>▶</span>
          <span style={{ flexGrow: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {active?.title ?? "No chat selected"}
          </span>
          <span style={{ color: MUTED, fontSize: "0.7rem", flexShrink: 0 }}>{sessions.length}</span>
        </button>
        <button
          type="button"
          onClick={() => { createNewSession(); setOpen(false); }}
          disabled={sessionsLoading}
          title="New chat"
          style={{
            background: "rgba(56, 139, 253, 0.15)", border: "1px solid rgba(56, 139, 253, 0.4)",
            borderRadius: "6px", padding: "0 10px", color: ACCENT,
            cursor: sessionsLoading ? "not-allowed" : "pointer", flexShrink: 0, fontSize: "0.9rem",
          }}
        >
          ＋
        </button>
      </div>

      {open && (
        <div
          role="list"
          style={{
            maxHeight: "240px", overflowY: "auto",
            display: "flex", flexDirection: "column", gap: "2px",
            background: "rgba(0,0,0,0.18)", border: "1px solid rgba(149, 181, 255, 0.15)",
            borderRadius: "6px", padding: "4px",
          }}
        >
          {ordered.length === 0 && (
            <p style={{ color: MUTED, fontSize: "0.75rem", margin: 0, padding: "8px" }}>No chats yet.</p>
          )}

          {ordered.map(session => {
            const isActive = session.id === activeSessionId;
            const isEditing = editingId === session.id;
            const isConfirming = confirmingId === session.id;

            return (
              <div
                key={session.id}
                role="listitem"
                style={{
                  display: "flex", alignItems: "center", gap: "4px",
                  padding: "4px 6px", borderRadius: "5px",
                  background: isActive ? "rgba(56, 139, 253, 0.16)" : "transparent",
                  border: isActive ? "1px solid rgba(56, 139, 253, 0.35)" : "1px solid transparent",
                }}
              >
                {isEditing ? (
                  <input
                    ref={editRef}
                    value={draftTitle}
                    onChange={e => setDraftTitle(e.target.value)}
                    onBlur={() => commitRename(session.id)}
                    onKeyDown={e => {
                      if (e.key === "Enter") { e.preventDefault(); commitRename(session.id); }
                      if (e.key === "Escape") { e.preventDefault(); setEditingId(null); }
                    }}
                    style={{
                      flexGrow: 1, minWidth: 0, background: "rgba(0,0,0,0.35)",
                      border: "1px solid rgba(149, 181, 255, 0.4)", borderRadius: "4px",
                      color: "white", fontSize: "0.78rem", padding: "2px 6px",
                    }}
                  />
                ) : isConfirming ? (
                  <>
                    <span style={{ flexGrow: 1, minWidth: 0, fontSize: "0.75rem", color: "#ff9c94" }}>
                      Delete this chat?
                    </span>
                    <button
                      type="button"
                      onClick={() => { removeSession(session.id); setConfirmingId(null); }}
                      style={iconButton({ color: "#ff7b72", fontWeight: 600 })}
                    >
                      Delete
                    </button>
                    <button type="button" onClick={() => setConfirmingId(null)} style={iconButton({ color: TEXT })}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => { setActiveSessionId(session.id); setOpen(false); }}
                      title={session.title}
                      style={{
                        flexGrow: 1, minWidth: 0, background: "transparent", border: "none",
                        color: isActive ? "white" : TEXT, cursor: "pointer", textAlign: "left",
                        padding: "2px 2px", fontSize: "0.78rem",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}
                    >
                      {session.title}
                    </button>
                    <span style={{ color: MUTED, fontSize: "0.65rem", flexShrink: 0 }}>
                      {relativeTime(session.updated_at)}
                    </span>
                    <button
                      type="button"
                      title="Rename"
                      onClick={() => { setDraftTitle(session.title); setEditingId(session.id); }}
                      style={iconButton()}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      title="Delete"
                      onClick={() => setConfirmingId(session.id)}
                      style={iconButton({ color: "#ff7b72" })}
                    >
                      🗑
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

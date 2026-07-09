import React, { createContext, useContext, useState, useCallback, useRef } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

type ToastKind = "success" | "error" | "info";

export type Toast = {
  id: string;
  kind: ToastKind;
  message: string;
};

type ToastContextValue = {
  toasts: Toast[];
  toast: {
    success: (msg: string) => void;
    error:   (msg: string) => void;
    info:    (msg: string) => void;
  };
  dismiss: (id: string) => void;
};

// ── Context ────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

// ── Provider ───────────────────────────────────────────────────────────────

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const t = timers.current.get(id);
    if (t) { clearTimeout(t); timers.current.delete(id); }
  }, []);

  const add = useCallback((kind: ToastKind, message: string, autoDismissMs?: number) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, kind, message }]);
    const ms = autoDismissMs ?? (kind === "error" ? 0 : 4000);
    if (ms > 0) {
      const t = setTimeout(() => dismiss(id), ms);
      timers.current.set(id, t);
    }
    return id;
  }, [dismiss]);

  const toast = {
    success: (msg: string) => add("success", msg, 4000),
    error:   (msg: string) => add("error",   msg, 0),      // errors persist until dismissed
    info:    (msg: string) => add("info",    msg, 3000),
  };

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
};

// ── Toast stack UI ─────────────────────────────────────────────────────────

const COLORS: Record<ToastKind, { bg: string; border: string; icon: string }> = {
  success: { bg: "rgba(16, 40, 24, 0.95)", border: "rgba(74, 222, 128, 0.35)", icon: "✓" },
  error:   { bg: "rgba(40, 12, 12, 0.95)", border: "rgba(248, 81, 73, 0.4)",   icon: "✕" },
  info:    { bg: "rgba(10, 20, 40, 0.95)", border: "rgba(149, 181, 255, 0.35)", icon: "ℹ" },
};

const ICON_COLORS: Record<ToastKind, string> = {
  success: "#4ade80",
  error:   "#f85149",
  info:    "#9fbeff",
};

function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div style={{
      position: "fixed", bottom: "24px", right: "24px",
      zIndex: 99999, display: "flex", flexDirection: "column", gap: "10px",
      maxWidth: "360px", width: "100%",
    }}>
      {toasts.map(t => {
        const c = COLORS[t.kind];
        return (
          <div key={t.id} style={{
            display: "flex", alignItems: "flex-start", gap: "12px",
            padding: "14px 16px",
            background: c.bg, border: `1px solid ${c.border}`,
            borderRadius: "12px",
            backdropFilter: "blur(12px)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            animation: "toast-in 0.2s ease",
          }}>
            <span style={{ fontSize: "1rem", color: ICON_COLORS[t.kind], flexShrink: 0, fontWeight: 700 }}>
              {c.icon}
            </span>
            <span style={{ flex: 1, fontSize: "0.88rem", color: "#e6edf3", lineHeight: 1.4 }}>
              {t.message}
            </span>
            <button
              onClick={() => onDismiss(t.id)}
              style={{
                background: "transparent", border: "none", cursor: "pointer",
                color: "#8b949e", fontSize: "0.9rem", padding: "0 0 0 8px", flexShrink: 0
              }}
            >✕</button>
          </div>
        );
      })}
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}


interface DraftReviewCardProps {
  path: string;
  proposedContent: string;
  isComplete: boolean;
  isConsumed?: boolean;
  onReviewDraft: (path: string, content: string, isComplete: boolean) => void;
}

export function DraftReviewCard({ path, proposedContent, isComplete, isConsumed, onReviewDraft }: DraftReviewCardProps) {
  return (
    <div style={{ margin: "8px 0", display: "inline-block" }}>
      {!isComplete ? (
        <span className="status-pill pending" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "#e3b341", animation: "pulse 1.5s infinite" }} />
          Drafting: {path}...
        </span>
      ) : isConsumed ? (
        <div 
          style={{ 
            display: "flex", alignItems: "center", gap: "8px", padding: "6px 12px", 
            background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.1)", 
            borderRadius: "6px", color: "#8b949e", fontSize: "0.85rem",
            fontFamily: "inherit"
          }}
        >
          <span>✓</span>
          <span>Draft Consumed ({path.split('/').pop()})</span>
        </div>
      ) : (
        <button 
          type="button" 
          onClick={() => onReviewDraft(path, proposedContent, true)}
          style={{ 
            display: "flex", alignItems: "center", gap: "8px", padding: "6px 12px", 
            background: "rgba(56, 139, 253, 0.15)", border: "1px solid rgba(56, 139, 253, 0.4)", 
            borderRadius: "6px", color: "#79c0ff", cursor: "pointer", fontSize: "0.85rem",
            fontFamily: "inherit"
          }}
        >
          <span>📝</span>
          <span style={{ textDecoration: "underline" }}>Review Changes to {path.split('/').pop()}</span>
        </button>
      )}
    </div>
  );
}

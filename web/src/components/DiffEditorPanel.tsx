import { useState, useEffect } from 'react';
import { diffLines, type Change } from 'diff';
import { getFileContent, writeFileContent } from '../lib/api';

export type Draft = {
  path: string;
  content: string;
  isComplete: boolean;
};

interface Props {
  draft: Draft;
  onClose: (consumed?: boolean) => void;
  onRefreshTree: () => Promise<void>;
}

export function DiffEditorPanel({ draft, onClose, onRefreshTree }: Props) {
  const [originalContent, setOriginalContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  
  // Track which change indices are "accepted"
  const [hunkStates, setHunkStates] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setLoading(true);
    getFileContent(draft.path)
      .then(res => {
        setOriginalContent(res.content);
        setLoading(false);
      })
      .catch(_err => {
        // New file
        setOriginalContent("");
        setLoading(false);
      });
  }, [draft.path]);

  // Compute diff once when original text is ready
  // We use state to store it so we can iterate its indices
  const [changes, setChanges] = useState<Change[]>([]);

  useEffect(() => {
    if (originalContent !== null && draft.isComplete) {
      const computed = diffLines(originalContent, draft.content);
      setChanges(computed);
      
      // Initialize all modifications to "accepted" (true)
      const initialStates: Record<number, boolean> = {};
      computed.forEach((part, index) => {
        if (part.added || part.removed) {
          initialStates[index] = true;
        }
      });
      setHunkStates(initialStates);
    }
  }, [originalContent, draft.content, draft.isComplete]);

  const toggleHunk = (index: number) => {
    setHunkStates(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const handleApply = async () => {
    setApplying(true);
    setErrorMsg(null);
    try {
      // Assemble the final string based on user toggle states
      let finalString = "";
      changes.forEach((part, index) => {
        if (!part.added && !part.removed) {
           finalString += part.value; // Unchanged lines are always kept
        } else {
           const isAccepted = hunkStates[index] ?? true;
           if (part.added && isAccepted) {
              finalString += part.value; // Keep the addition
           } else if (part.removed && !isAccepted) {
              finalString += part.value; // Reject the removal -> Keep original
           }
        }
      });

      await writeFileContent(draft.path, finalString);
      await onRefreshTree();
      onClose(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setApplying(false);
    }
  };

  if (!draft.isComplete) {
    return (
      <div className="panel main-panel workspace-centered" style={{ justifyContent: "center", minHeight: "100%" }}>
        <h2 style={{ color: "#9fbeff" }}>Drafting in progress...</h2>
        <p className="status-copy">Receiving chunks for {draft.path}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="panel main-panel workspace-centered" style={{ justifyContent: "center", minHeight: "100%" }}>
        <p className="status-copy">Loading diff...</p>
      </div>
    );
  }

  const numChanges = changes.filter(c => c.added || c.removed).length;
  const numAccepted = Object.values(hunkStates).filter(Boolean).length;

  return (
    <div className="panel main-panel" style={{ display: "flex", flexDirection: "column", height: "100%", padding: 0, overflow: "hidden" }}>
      <header style={{ padding: "16px 24px", borderBottom: "1px solid rgba(149, 181, 255, 0.12)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, background: "rgba(10, 16, 28, 0.8)" }}>
        <div>
          <p className="eyebrow" style={{ color: "#3fb950" }}>Reviewing Diff</p>
          <h2 style={{ fontSize: "1.2rem", margin: "4px 0 0", wordBreak: "break-all" }}>{draft.path}</h2>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          {errorMsg && <span style={{ color: "#ff7b72", fontSize: "0.85rem" }}>{errorMsg}</span>}
          <button type="button" className="ghost-button" onClick={() => onClose(true)} style={{ padding: "6px 12px", borderRadius: "8px", width: "auto" }}>
            Discard Draft
          </button>
          <button 
            type="button" 
            className="primary-button" 
            onClick={handleApply} 
            disabled={applying}
            style={{ padding: "8px 16px", borderRadius: "8px" }}
          >
            {applying ? "Saving..." : `Apply ${numAccepted}/${numChanges} Changes`}
          </button>
        </div>
      </header>

      <div style={{ flexGrow: 1, overflowY: "auto", padding: "24px", background: "rgba(8, 15, 30, 0.95)" }}>
         <div style={{ 
           fontFamily: 'Consolas, "Cascadia Mono", monospace', 
           fontSize: '13px', 
           color: "#e2e8f0",
           background: "#0d1117",
           border: "1px solid rgba(149, 181, 255, 0.15)",
           borderRadius: "8px",
           overflow: "hidden"
         }}>
           {changes.map((part, index) => {
             const isModified = part.added || part.removed;
             const isAccepted = hunkStates[index] ?? true;
             
             let bg = 'transparent';
             let color = '#c9d1d9';
             let prefix = '  ';
             let borderLeft = '4px solid transparent';
             
             if (isModified) {
               if (part.added) {
                 prefix = '+ ';
                 if (isAccepted) {
                   bg = 'rgba(63, 185, 80, 0.15)';
                   color = '#e6ffec';
                   borderLeft = '4px solid #3fb950';
                 } else {
                   bg = 'transparent';
                   color = '#8b949e';
                   borderLeft = '4px solid #8b949e';
                 }
               } else if (part.removed) {
                 prefix = '- ';
                 if (isAccepted) {
                   bg = 'rgba(248, 81, 73, 0.15)';
                   color = '#ffebe9';
                   borderLeft = '4px solid #f85149';
                 } else {
                   bg = 'transparent';
                   color = '#8b949e';
                   borderLeft = '4px solid #8b949e';
                   prefix = '  '; // Reverted removal is just context now
                 }
               }
             }

             const lines = part.value.split('\n');
             if (lines[lines.length - 1] === '') lines.pop();

             return (
               <div key={index} style={{ display: 'flex', borderBottom: index < changes.length - 1 && !isModified ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                 {/* Action Bar (Only for modifications) */}
                 {isModified && (
                   <div style={{ width: "40px", flexShrink: 0, background: bg, borderLeft, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "8px 0" }}>
                     <input 
                       type="checkbox" 
                       checked={isAccepted} 
                       onChange={() => toggleHunk(index)} 
                       title={isAccepted ? "Reject this change" : "Accept this change"}
                       style={{ cursor: "pointer" }}
                     />
                   </div>
                 )}
                 {/* Empty padding for unchanged lines to align text */}
                 {!isModified && (
                   <div style={{ width: "40px", flexShrink: 0, background: "rgba(255,255,255,0.02)", borderLeft: '4px solid transparent' }} />
                 )}
                 
                 {/* Code Chunk */}
                 <div style={{ flexGrow: 1, color, backgroundColor: bg, padding: "8px 16px 8px 8px", position: "relative" }}>
                   {isModified && !isAccepted && (
                     <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(13, 17, 23, 0.6)", pointerEvents: "none" }}>
                       <span style={{ fontSize: "0.8rem", color: "#8b949e", fontWeight: "bold", letterSpacing: "1px", textTransform: "uppercase", background: "#0d1117", padding: "2px 8px", borderRadius: "4px" }}>
                         {part.added ? "Addition Rejected" : "Removal Rejected (Kept)"}
                       </span>
                     </div>
                   )}
                   {lines.map((line, i) => (
                     <div key={i} style={{ display: 'flex', opacity: isModified && !isAccepted ? 0.4 : 1, textDecoration: part.removed && isAccepted ? "line-through" : "none" }}>
                       <span style={{ opacity: 0.5, userSelect: 'none', marginRight: '12px', minWidth: '16px' }}>{prefix}</span>
                       <span style={{ wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>{line}</span>
                     </div>
                   ))}
                 </div>
               </div>
             );
           })}
         </div>
      </div>
    </div>
  );
}

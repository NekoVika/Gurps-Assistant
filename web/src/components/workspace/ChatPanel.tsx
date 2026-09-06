import { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { useChatStore } from '../../stores/useChatStore';
import { useWorkspaceStore } from '../../stores/useWorkspaceStore';
import { useCampaignStore } from '../../stores/useCampaignStore';
import { DraftReviewCard } from '../DraftReviewCard';
import { ChatSessionList } from './ChatSessionList';

export function ChatPanel() {
  const {
    chatMessages,
    chatInput,
    setChatInput,
    chatError,
    chatLoading,
    handleChatSubmit,
    clearChatError,
    retryLastExchange,
    consumedDrafts,
    setPendingDraft
  } = useChatStore();

  const { providers, selectedProvider, selectedModel, setSelectedProvider, setSelectedModel } = useWorkspaceStore();
  const { fileTree } = useCampaignStore();

  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const [activeContextFiles, setActiveContextFiles] = useState<any[]>([]);

  const availableContextFiles = useMemo(() => {
    const results: any[] = [];
    function traverse(node: any) {
      if (node.node_type === "directory") {
        if (node.name === ".planning" || node.name === ".agents" || node.name === "_reports" || node.name === "_templates") return;
        node.children.forEach(traverse);
      } else {
        if (!(node.path.endsWith(".md") || node.path.endsWith(".json")) || ["SYSTEM.md", "state.md", "state.json", "AGENTS.md", "00_System_Rules.md", "00_System_Rules.json", "System_Rules.json", "README.md", "TODO.md", ".gurpsai_state.json"].includes(node.name)) return;
        
        let type = "Note";
        if (node.path.includes("02_Characters") || node.path.includes("Bestiary")) type = "Character";
        else if (node.path.includes("Locations")) type = "Location";
        else if (node.path.includes("sessions") || node.path.includes("Episode") || node.path.includes("03_Story")) type = "Story";
        else if (node.path.includes("01_World_Bible")) type = "Lore";
        
        const cleanName = node.name.replace(/\.(md|json)$/i, "").replace(/_/g, " ");
        results.push({ name: cleanName, path: node.path, type });
      }
    }
    
    const campaignNode = fileTree.find(n => n.node_type === "directory" && n.path === "Campaign");
    if (campaignNode) traverse(campaignNode);
    return results;
  }, [fileTree]);

  const filteredMentionFiles = useMemo(() => {
     if (!mentionQuery) return availableContextFiles.slice(0, 10);
     const query = mentionQuery.toLowerCase();
     return availableContextFiles.filter(f => f.name.toLowerCase().includes(query)).slice(0, 10);
  }, [mentionQuery, availableContextFiles]);

  const activeProvider = providers.find((provider) => provider.name === selectedProvider) ?? null;

  return (
    <aside className="panel inspector chat-sidebar" style={{ display: "flex", flexDirection: "column", overflow: "hidden", padding: "12px 14px" }}>
      <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: "8px", borderBottom: "1px solid rgba(149, 181, 255, 0.12)", paddingBottom: "12px", marginBottom: "8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="eyebrow" style={{ color: "#c9dfff", fontWeight: 600 }}>Assistant</span>
          <span className={`status-pill ${activeProvider?.available ? "online" : "offline"}`} style={{ fontSize: "0.65rem", padding: "2px 6px" }}>
            {activeProvider?.available ? "Ready" : "Offline"}
          </span>
        </div>
        <ChatSessionList />
      </div>

      <div className="chat-transcript" style={{ flexGrow: 1, overflowY: "auto", margin: "16px 0", paddingRight: "8px" }}>
        {chatMessages.length > 0 ? (
          chatMessages.map((message, index) => {
            if (message.role === "system" || message.content.startsWith("[SYSTEM:") || message.role === "tool") return null;
            return (
              <div key={`${message.role}-${index}`} className={`chat-bubble ${message.role}`}>
                <span className="section-label">{message.role}</span>
                {message.content && (
                  <div className="markdown-content">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                )}
                {message.tool_calls?.map((tc, tcIdx) => {
                  if (tc.name === "read_file") {
                    return (
                      <div key={`tc-${tcIdx}`} style={{ margin: "12px 0", padding: "8px 12px", background: "rgba(46, 160, 67, 0.15)", border: "1px solid rgba(46, 160, 67, 0.4)", borderRadius: "6px", display: "inline-block", fontSize: "0.85rem", color: "#3fb950" }}>
                        📖 Reading file: <span style={{fontFamily: "monospace"}}>{tc.arguments?.path || "..."}</span>
                      </div>
                    );
                  } else if (tc.name === "query_rules") {
                    return (
                      <div key={`tc-${tcIdx}`} style={{ margin: "12px 0", padding: "8px 12px", background: "rgba(163, 113, 247, 0.15)", border: "1px solid rgba(163, 113, 247, 0.4)", borderRadius: "6px", display: "inline-block", fontSize: "0.85rem", color: "#d2a8ff" }}>
                        ⚖️ Querying rules: <span style={{fontFamily: "monospace"}}>{tc.arguments?.query || "..."}</span>
                      </div>
                    );
                  } else if (tc.name === "draft_file") {
                    return (
                      <DraftReviewCard
                        key={`tc-${tcIdx}`}
                        path={tc.arguments?.path || ""}
                        proposedContent={tc.arguments?.content || ""}
                        isComplete={true}
                        isConsumed={consumedDrafts.includes(tc.arguments?.content || "")}
                        onReviewDraft={(path, content, isComplete) => setPendingDraft({ path, content, isComplete })}
                      />
                    );
                  }
                  return null;
                })}
              </div>
            );
          })
        ) : (
          <p className="status-copy">Start with a prompt.</p>
        )}
      </div>

      <form className="chat-form" onSubmit={(e) => {
         handleChatSubmit(e, selectedProvider, selectedModel, activeContextFiles);
         setActiveContextFiles([]);
      }} style={{ flexShrink: 0, marginTop: 0, gap: 0 }}>
        {chatError ? (
          <div
            role="alert"
            style={{
              margin: "0 0 8px 0", padding: "10px 12px",
              background: "rgba(248, 81, 73, 0.10)",
              border: "1px solid rgba(248, 81, 73, 0.35)",
              borderRadius: "8px", color: "#ff9c94", fontSize: "0.8rem",
              display: "flex", flexDirection: "column", gap: "8px"
            }}
          >
            <span style={{ lineHeight: 1.5, wordBreak: "break-word" }}>{chatError}</span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={() => retryLastExchange(selectedProvider, selectedModel)}
                disabled={chatLoading}
                style={{
                  background: "rgba(248, 81, 73, 0.18)", border: "1px solid rgba(248, 81, 73, 0.45)",
                  borderRadius: "6px", padding: "3px 10px", color: "#ff9c94",
                  cursor: chatLoading ? "not-allowed" : "pointer", fontSize: "0.75rem"
                }}
              >
                Retry
              </button>
              <button
                type="button"
                onClick={clearChatError}
                style={{
                  background: "transparent", border: "1px solid rgba(255, 255, 255, 0.18)",
                  borderRadius: "6px", padding: "3px 10px", color: "#c9dfff",
                  cursor: "pointer", fontSize: "0.75rem"
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : null}
        <div 
          style={{ 
            display: "flex", 
            flexDirection: "column", 
            background: "rgba(16, 28, 49, 0.96)", 
            border: "1px solid rgba(149, 181, 255, 0.25)", 
            borderRadius: "12px",
            position: "relative"
          }}
        >
          {showMentionMenu && filteredMentionFiles.length > 0 && (
            <div className="mention-menu" style={{
                position: "absolute", bottom: "100%", left: 0,
                background: "rgba(16, 28, 49, 0.98)", border: "1px solid rgba(149, 181, 255, 0.4)",
                borderRadius: "8px", padding: "8px", display: "flex", flexDirection: "column", gap: "4px",
                boxShadow: "0 -8px 24px rgba(0,0,0,0.6)", zIndex: 100,
                maxHeight: "250px", overflowY: "auto", minWidth: "250px",
                marginBottom: "8px"
            }}>
                {filteredMentionFiles.map((file, i) => (
                  <div key={file.path} 
                      onClick={() => {
                          if (!activeContextFiles.some(f => f.path === file.path)) {
                            setActiveContextFiles(prev => [...prev, file]);
                          }
                          const replaced = chatInput.replace(/(?:^|\s)@[^\s]*$/, " ");
                          setChatInput(replaced);
                          setShowMentionMenu(false);
                      }}
                      style={{
                          padding: "6px 10px", borderRadius: "4px", cursor: "pointer",
                          background: i === mentionIndex ? "rgba(88, 166, 255, 0.2)" : "transparent",
                          display: "flex", justifyContent: "space-between", alignItems: "center"
                      }}>
                    <span style={{ color: "#c9dfff", fontWeight: 500, fontSize: "0.85rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "200px" }}>{file.name}</span>
                    <span style={{ fontSize: "0.65rem", padding: "2px 6px", background: "rgba(0,0,0,0.3)", borderRadius: "12px", color: file.type === "Character" ? "#58a6ff" : file.type === "Location" ? "#e3b341" : file.type === "Story" ? "#d2a8ff" : "#8b949e", textTransform: "uppercase" }}>
                        {file.type}
                    </span>
                  </div>
                ))}
            </div>
          )}
          
          {activeContextFiles.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", padding: "8px 14px", borderBottom: "1px solid rgba(149, 181, 255, 0.1)" }}>
                {activeContextFiles.map(file => (
                  <span key={file.path} style={{
                      display: "inline-flex", alignItems: "center", gap: "6px",
                      background: "rgba(46, 160, 67, 0.15)", border: "1px solid rgba(46, 160, 67, 0.4)",
                      padding: "2px 8px", borderRadius: "12px", fontSize: "0.75rem", color: "#3fb950"
                  }}>
                      📖 {file.name}
                      <button type="button" onClick={() => setActiveContextFiles(prev => prev.filter(f => f.path !== file.path))} style={{ background: "transparent", border: "none", color: "#3fb950", cursor: "pointer", padding: 0, fontSize: "1.1rem", lineHeight: 1, outline: "none" }}>×</button>
                  </span>
                ))}
            </div>
          )}

          <textarea
            className="chat-textarea"
            value={chatInput}
            onChange={(e) => {
              const val = e.target.value;
              setChatInput(val);
              const cursor = e.target.selectionStart;
              const textBeforeCursor = val.slice(0, cursor);
              const match = textBeforeCursor.match(/(?:^|\s)@([^\s]*)$/);
              if (match) {
                 setShowMentionMenu(true);
                 setMentionQuery(match[1]);
                 setMentionIndex(0);
              } else {
                 setShowMentionMenu(false);
              }
            }}
            onKeyDown={(e) => {
              if (showMentionMenu) {
                 if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setMentionIndex(prev => Math.min(prev + 1, filteredMentionFiles.length - 1));
                    return;
                 }
                 if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setMentionIndex(prev => Math.max(prev - 1, 0));
                    return;
                 }
                 if (e.key === "Enter") {
                    e.preventDefault();
                    const picked = filteredMentionFiles[mentionIndex];
                    if (picked && !activeContextFiles.some(f => f.path === picked.path)) {
                       setActiveContextFiles(prev => [...prev, picked]);
                    }
                    const cursor = e.currentTarget.selectionStart;
                    const textBeforeCursor = chatInput.slice(0, cursor);
                    const textAfterCursor = chatInput.slice(cursor);
                    const replaced = textBeforeCursor.replace(/(?:^|\s)@[^\s]*$/, " ");
                    setChatInput(replaced + textAfterCursor);
                    setShowMentionMenu(false);
                    return;
                 }
                 if (e.key === "Escape") {
                    setShowMentionMenu(false);
                    return;
                 }
              }

              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (chatInput.trim() && !chatLoading) {
                  e.currentTarget.form?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                }
              }
            }}
            rows={2}
            placeholder="Message AI... (@ for context)"
            style={{ 
              border: "none", 
              background: "transparent", 
              resize: "none", 
              boxShadow: "none",
              outline: "none",
              borderRadius: 0,
              padding: "12px 14px",
              minHeight: "60px"
            }}
          />
          
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px 8px 8px", flexWrap: "wrap", gap: "8px" }}>
            <div style={{ display: "flex", gap: "6px", flexShrink: 1, minWidth: 0 }}>
              <select 
                className="chat-select" 
                value={selectedProvider} 
                onChange={(e) => setSelectedProvider(e.target.value)}
                style={{ maxWidth: "120px", textOverflow: "ellipsis", border: "none", background: "rgba(0,0,0,0.3)", padding: "4px 8px", fontSize: "0.75rem" }}
              >
                {providers.map((p) => <option key={p.name} value={p.name}>{p.display_name}</option>)}
              </select>
              <select 
                className="chat-select" 
                value={selectedModel} 
                onChange={(e) => setSelectedModel(e.target.value)} 
                disabled={!activeProvider || activeProvider.models.length === 0}
                style={{ maxWidth: "140px", textOverflow: "ellipsis", border: "none", background: "rgba(0,0,0,0.3)", padding: "4px 8px", fontSize: "0.75rem" }}
              >
                {activeProvider && activeProvider.models.length > 0 ? (
                  activeProvider.models.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)
                ) : <option value="">No models</option>}
              </select>
            </div>
            
            <button 
              type="submit" 
              className="primary-button" 
              disabled={chatLoading || (!chatInput.trim() && activeContextFiles.length === 0)} 
              style={{ padding: "6px 14px", fontSize: "0.8rem", borderRadius: "8px", flexShrink: 0 }}
            >
              {chatLoading ? "..." : "Send"}
            </button>
          </div>
        </div>
      </form>
    </aside>
  );
}

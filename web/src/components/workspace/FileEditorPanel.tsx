import { useCampaignStore } from '../../stores/useCampaignStore';
import { useWorkspaceStore } from '../../stores/useWorkspaceStore';
import { useChatStore } from '../../stores/useChatStore';

import { DiffEditorPanel } from '../DiffEditorPanel';
import { CharacterPassport } from '../CharacterPassport';
import { LocationPassport } from '../LocationPassport';
import { StoryPassport } from '../StoryPassport';
import { FactionPassport } from '../FactionPassport';
import { StatePassport } from '../StatePassport';
import { SystemRulesPassport } from '../SystemRulesPassport';
import { CampaignOverviewPassport } from '../CampaignOverviewPassport';
import { WorldDossierPassport } from '../WorldDossierPassport';
import { MissingEntitiesBanner } from '../MissingEntitiesBanner';

import { CharacterEditor } from '../editors/CharacterEditor';
import { LocationEditor } from '../editors/LocationEditor';
import { StoryEditor } from '../editors/StoryEditor';
import { FactionEditor } from '../editors/FactionEditor';
import { WorldDossierEditor } from '../editors/WorldDossierEditor';
import { CampaignOverviewEditor } from '../editors/CampaignOverviewEditor';
import { SystemRulesEditor } from '../editors/SystemRulesEditor';
import { StateEditor } from '../editors/StateEditor';
import MDEditor from "@uiw/react-md-editor";
import ReactMarkdown from "react-markdown";

import { parseCharacter } from "../../lib/CharacterParser";
import { parseLocation } from "../../lib/LocationParser";
import { parseStory } from "../../lib/StoryParser";
import { parseFaction } from "../../lib/FactionParser";
import { getFileContent } from '../../lib/api';

export function FileEditorPanel() {
  const { 
    selectedFile, 
    fileContentError, 
    isEditing, 
    setIsEditing,
    editedContent,
    setEditedContent,
    handleSaveEdit,
    isSaving,
    isMendingFile,
    fileUndoStack,
    handleUndoFileAction,
    handleMendFile,
    handleNavigateTo,
    handleSaveParsedData
  } = useCampaignStore();

  const { providerSettings } = useWorkspaceStore();
  const { pendingDraft, setPendingDraft, addConsumedDraft } = useChatStore();

  if (fileContentError) {
    return (
      <main className="panel main-panel" style={{ overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <section style={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
           <div className="error-copy" style={{ whiteSpace: "pre-wrap", padding: "12px", background: "rgba(255, 60, 60, 0.1)", border: "1px solid rgba(255, 60, 60, 0.4)", borderRadius: "6px" }}>{fileContentError}</div>
        </section>
      </main>
    );
  }

  if (pendingDraft) {
    return (
      <main className="panel main-panel" style={{ overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <section style={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
          <DiffEditorPanel 
            draft={pendingDraft} 
            onClose={(consumed) => {
              if (consumed) {
                addConsumedDraft(pendingDraft.content);
              }
              setPendingDraft(null);
            }} 
            onRefreshTree={async () => {
              await useCampaignStore.getState().refreshCampaignArtifacts();
              if (selectedFile && selectedFile.path === pendingDraft.path) {
                const updated = await getFileContent(pendingDraft.path);
                useCampaignStore.setState({ selectedFile: updated });
              }
            }}
          />
        </section>
      </main>
    );
  }

  if (!selectedFile) {
    return (
      <main className="panel main-panel" style={{ overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <section style={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: "400px", opacity: 0.4 }}>
            <span style={{ fontSize: "48px", marginBottom: "16px" }}>📄</span>
            <p className="status-copy" style={{ fontSize: "1.1rem" }}>Select a file from the browser to view it.</p>
          </div>
        </section>
      </main>
    );
  }

  let displayTitle = selectedFile.path.split(/[/\\]/).pop() || selectedFile.path;
  if (selectedFile.path.endsWith('.json')) {
    try {
      const d = JSON.parse(selectedFile.content);
      displayTitle = d.title || d.name || d.campaignName || displayTitle;
      if (displayTitle.toLowerCase() === "state") displayTitle = "Campaign State";
      if (displayTitle.toLowerCase() === "00 system rules" || displayTitle.toLowerCase() === "system rules") displayTitle = "System Rules";
    } catch(e){}
  }

  const showDeepMend = selectedFile.path.includes("02_Characters") || selectedFile.path.includes("Locations") || selectedFile.path.includes("03_Story") || selectedFile.path.includes("Episode") || selectedFile.path.includes("sessions");
  const mendTargetType = selectedFile.path.includes("02_Characters") ? "Character" : (selectedFile.path.includes("Locations") ? "Location" : "Story");
  const mendProvider = providerSettings?.default_mending_provider || "gemini";
  const mendModel = providerSettings?.default_mending_model || "";

  return (
    <main className="panel main-panel" style={{ overflowY: "auto", display: "flex", flexDirection: "column" }}>
      <section style={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
        <div className="file-preview-wrapper" style={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
          {!isEditing && (
            <div className="workspace-document-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid rgba(89, 137, 219, 0.3)", paddingBottom: "16px", marginBottom: "24px" }}>
              <div>
                <h1 style={{ fontSize: "2rem", color: "#f3f4f6", margin: 0, fontWeight: 700, letterSpacing: "0.5px" }}>{displayTitle}</h1>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                {selectedFile.truncated ? <span className="status-pill pending">Preview truncated</span> : null}
                
                {showDeepMend && (selectedFile.path.endsWith('.json') || selectedFile.path.endsWith('.md')) && (
                  <button type="button" className="chip-button" style={{ borderColor: "rgba(255, 183, 0, 0.4)", color: "#ffb700" }} onClick={() => handleMendFile(mendTargetType, mendProvider, mendModel)} disabled={isMendingFile}>
                    {isMendingFile ? "Mending..." : "🪄 Deep Mend File"}
                  </button>
                )}

                {fileUndoStack.length > 0 && (
                  <button type="button" className="chip-button" style={{ borderColor: "rgba(255, 183, 0, 0.4)", color: "#ffb700" }} onClick={handleUndoFileAction}>
                    ⎌ Undo Last Action
                  </button>
                )}
                
                <button type="button" className="chip-button" onClick={() => setIsEditing(true)}>📝 Edit</button>
                <button type="button" className="chip-button" style={{ borderColor: "rgba(255, 60, 60, 0.4)", color: "#ff7b72" }} onClick={() => useCampaignStore.setState({ isDeleteModalOpen: true })}>🗑️ Delete</button>
              </div>
            </div>
          )}

          {isEditing && (
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginBottom: "16px" }}>
              <button type="button" className="ghost-button" style={{ width: "auto", display: "flex", alignItems: "center", justifyContent: "center", padding: "6px 16px", fontSize: "0.95rem" }} onClick={() => setIsEditing(false)} disabled={isSaving}>Cancel</button>
              <button type="button" className="primary-button" style={{ width: "auto", display: "flex", alignItems: "center", justifyContent: "center", padding: "6px 20px", fontSize: "0.95rem", boxShadow: "0 0 12px rgba(88,166,255,0.2)" }} onClick={handleSaveEdit} disabled={isSaving}>
                {isSaving ? "Saving..." : "💾 Save Changes"}
              </button>
            </div>
          )}

          <div className="file-content-container" style={{ flexGrow: 1, paddingBottom: "32px", display: "flex", flexDirection: "column" }}>
            {isEditing ? (
              <div style={{ flexGrow: 1, borderRadius: "8px", overflow: "hidden", minHeight: "75vh" }} data-color-mode="dark">
                {(() => {
                  if (selectedFile.path.includes("System_Rules")) return <SystemRulesEditor value={editedContent} onChange={setEditedContent} documentPath={selectedFile.path} />;
                  if (selectedFile.path.includes("state.md") || selectedFile.path.includes("state.json")) return <StateEditor value={editedContent} onChange={setEditedContent} documentPath={selectedFile.path} />;
                  if (selectedFile.path.includes("Campaign_Overview")) return <CampaignOverviewEditor value={editedContent} onChange={setEditedContent} documentPath={selectedFile.path} />;
                  if (selectedFile.path.includes("World_Dossier")) return <WorldDossierEditor value={editedContent} onChange={setEditedContent} documentPath={selectedFile.path} />;
                  if (selectedFile.path.includes("Factions")) return <FactionEditor value={editedContent} onChange={setEditedContent} documentPath={selectedFile.path} />;
                  if (selectedFile.path.includes("02_Characters")) return <CharacterEditor value={editedContent} onChange={setEditedContent} documentPath={selectedFile.path} />;
                  if (selectedFile.path.includes("Locations")) return <LocationEditor value={editedContent} onChange={setEditedContent} documentPath={selectedFile.path} />;
                  if (selectedFile.path.includes("Episode") || selectedFile.path.includes("03_Story") || selectedFile.path.includes("sessions")) return <StoryEditor value={editedContent} onChange={setEditedContent} documentPath={selectedFile.path} />;
                  return <MDEditor value={editedContent} onChange={(val) => setEditedContent(val || "")} height="100%" previewOptions={{ components: {} }} />;
                })()}
              </div>
            ) : (
              <div className="file-preview-content" style={{ flexGrow: 1 }}>
                {(() => {
                  if (selectedFile.path.includes("state.json")) {
                    try { return <StatePassport data={JSON.parse(selectedFile.content)} />; } catch (e) {}
                  }
                  if (selectedFile.path.includes("System_Rules.json")) {
                    try { return <SystemRulesPassport data={JSON.parse(selectedFile.content)} />; } catch (e) {}
                  }
                  if (selectedFile.path.includes("Campaign_Overview.json")) {
                    try { return <CampaignOverviewPassport data={JSON.parse(selectedFile.content)} documentPath={selectedFile.path} />; } catch (e) {}
                  }
                  if (selectedFile.path.includes("World_Dossier.json")) {
                    try { return <WorldDossierPassport data={JSON.parse(selectedFile.content)} documentPath={selectedFile.path} />; } catch (e) {}
                  }
                  if (selectedFile.path.includes("02_Characters")) {
                    const parsed = parseCharacter(selectedFile.content);
                    if (parsed && parsed.name && parsed.name !== "Unknown Character") return <CharacterPassport data={parsed} documentPath={selectedFile.path} onUpdate={handleSaveParsedData} onNavigate={handleNavigateTo} />;
                  }
                  if (selectedFile.path.includes("Factions")) {
                    const parsed = parseFaction(selectedFile.content);
                    if (parsed && parsed.name && parsed.name !== "Unknown Faction") return <FactionPassport data={parsed} documentPath={selectedFile.path} onNavigate={handleNavigateTo} />;
                  }
                  if (selectedFile.path.includes("Locations")) {
                    const parsed = parseLocation(selectedFile.content);
                    if (parsed && parsed.name && parsed.name !== "Unknown Location") return <LocationPassport data={parsed} documentPath={selectedFile.path} onNavigate={handleNavigateTo} />;
                  }
                  if (selectedFile.path.includes("Episode") || selectedFile.path.includes("03_Story") || selectedFile.path.includes("sessions")) {
                    const parsed = parseStory(selectedFile.content);
                    if (parsed && parsed.title && parsed.title !== "Unknown Story Part") return (
                      <>
                        <MissingEntitiesBanner data={parsed} documentPath={selectedFile.path} />
                        <StoryPassport data={parsed} documentPath={selectedFile.path} onNavigate={handleNavigateTo} />
                      </>
                    );
                  }
                  
                  if (selectedFile.path.endsWith('.json')) {
                    return (
                      <div className="json-content" style={{ whiteSpace: "pre-wrap", fontFamily: "monospace", padding: "20px" }}>
                        {showDeepMend && (
                          <div style={{ padding: "16px", background: "rgba(255, 100, 100, 0.1)", border: "1px solid #ff4444", borderRadius: "8px", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <strong style={{ color: "#ff4444" }}>Malformed JSON Detected</strong>
                              <p style={{ margin: "4px 0 0 0", fontSize: "0.9em", opacity: 0.8 }}>This {mendTargetType} file failed to parse into the rich passport view.</p>
                            </div>
                            <button className="primary-button" onClick={() => handleMendFile(mendTargetType, mendProvider, mendModel)} disabled={isMendingFile}>
                              {isMendingFile ? "Mending..." : "🪄 AI Mend File"}
                            </button>
                          </div>
                        )}
                        {selectedFile.content}
                      </div>
                    );
                  }

                  return (
                    <div className="markdown-content">
                      <ReactMarkdown>{selectedFile.content}</ReactMarkdown>
                    </div>
                  );
                })()}
              </div>
            )}
            
            {isEditing && (
              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "16px", paddingBottom: "24px" }}>
                <button type="button" className="ghost-button" style={{ width: "auto", display: "flex", alignItems: "center", justifyContent: "center", padding: "6px 16px", fontSize: "0.95rem" }} onClick={() => setIsEditing(false)} disabled={isSaving}>Cancel</button>
                <button type="button" className="primary-button" style={{ width: "auto", display: "flex", alignItems: "center", justifyContent: "center", padding: "6px 20px", fontSize: "0.95rem", boxShadow: "0 0 12px rgba(88,166,255,0.2)" }} onClick={handleSaveEdit} disabled={isSaving}>
                  {isSaving ? "Saving..." : "💾 Save Changes"}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

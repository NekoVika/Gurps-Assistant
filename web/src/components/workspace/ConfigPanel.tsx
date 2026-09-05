import { useState } from 'react';
import { useWorkspaceStore } from '../../stores/useWorkspaceStore';
import { useCampaignStore } from '../../stores/useCampaignStore';
import { createBatchStubs, type DanglingRef, type StubRequest } from '../../lib/api';

export function ConfigPanel() {
  const {
    providerSettings,
    geminiApiKeyDraft,
    geminiBaseUrlDraft,
    geminiTimeoutDraft,
    ollamaBaseUrlDraft,
    ollamaTimeoutDraft,
    chatProviderDraft,
    chatModelDraft,
    wizardProviderDraft,
    wizardModelDraft,
    mendingProviderDraft,
    mendingModelDraft,
    setDraftSetting,
    saveSettings,
    settingsLoading,
    settingsSaveMessage,
    settingsError,
    providers
  } = useWorkspaceStore();

  const {
    campaignPathDraft,
    setCampaignPathDraft,
    handleCampaignSubmit,
    handleBrowse,
    campaignLoading,
    campaignMessage,
    menderLoading,
    handleValidateCampaign,
    menderError,
    menderValidation
  } = useCampaignStore();

  const refreshCampaignArtifacts = useCampaignStore(s => s.refreshCampaignArtifacts);
  const [stubsBusy, setStubsBusy] = useState(false);

  const dangling = menderValidation?.dangling ?? [];
  const danglingBySource = dangling.reduce((acc, ref) => {
    (acc[ref.source_path] = acc[ref.source_path] || []).push(ref);
    return acc;
  }, {} as Record<string, DanglingRef[]>);

  const createStubsFor = async (refs: DanglingRef[]) => {
    setStubsBusy(true);
    try {
      const seen = new Set<string>();
      const stubs: StubRequest[] = [];
      for (const ref of refs) {
        if (seen.has(ref.name)) continue;
        seen.add(ref.name);
        stubs.push({
          name: ref.name,
          type: ref.suggested_type,
          // childLinks stubs nest under their source story file
          parent_path: ref.field === "childLinks" ? ref.source_path : undefined
        });
      }
      await createBatchStubs(stubs);
      await refreshCampaignArtifacts();
      await handleValidateCampaign();
    } catch (e) {
      console.error("Failed to create stubs", e);
      alert("Failed to create stubs");
    } finally {
      setStubsBusy(false);
    }
  };

  return (
    <div className="workspace-grid workspace-centered">
      <section className="preview-card" style={{ padding: "32px", width: "100%" }}>
        <div className="preview-header">
          <p className="section-label">Campaign Setup</p>
          <h3>Local Directory Selection</h3>
          <p className="lede">Point the workspace to your `Campaign/` directory.</p>
        </div>
        <form className="settings-form" onSubmit={handleCampaignSubmit} style={{ display: "grid", gap: "16px", marginTop: "24px" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <input
              type="text"
              className="campaign-path-input"
              style={{ width: "100%" }}
              value={campaignPathDraft}
              onChange={(e) => setCampaignPathDraft(e.target.value)}
              placeholder="Absolute path or relative path to workspace..."
            />
            <button type="button" className="ghost-button" onClick={handleBrowse} disabled={campaignLoading} title="Browse for a folder via OS dialogue" style={{ width: "auto", whiteSpace: "nowrap" }}>
              📁 Browse
            </button>
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <button type="submit" className="primary-button" disabled={campaignLoading} style={{ width: "auto" }}>
              {campaignLoading ? "Saving..." : "Save Selection"}
            </button>
            {campaignMessage && <span className="status-copy">{campaignMessage}</span>}
          </div>
        </form>
      </section>

      <section className="preview-card" style={{ padding: "32px", width: "100%" }}>
        <div className="preview-header">
          <p className="section-label">Providers</p>
          <h3>LLM Integrations</h3>
          <p className="lede">Configure provider keys and connection endpoints.</p>
        </div>
        <form className="settings-form settings-grid" onSubmit={saveSettings} style={{ marginTop: "24px" }}>
          <label className="chat-control settings-span-two">
            <span className="section-label">Gemini API key</span>
            <input
              className="chat-select"
              type="password"
              value={geminiApiKeyDraft}
              onChange={(event) => setDraftSetting('geminiApiKeyDraft', event.target.value)}
              placeholder={
                providerSettings?.gemini_api_key_configured
                  ? "Key already saved. Type a new one to replace it."
                  : "Paste your Gemini API key"
              }
            />
          </label>
          <label className="chat-control settings-span-two">
            <span className="section-label">Gemini Base URL</span>
            <input className="chat-select" type="text" value={geminiBaseUrlDraft} onChange={(e) => setDraftSetting('geminiBaseUrlDraft', e.target.value)} />
          </label>
          <label className="chat-control settings-span-two">
            <span className="section-label">Gemini Timeout (Seconds)</span>
            <input className="chat-select" type="number" min="1" value={geminiTimeoutDraft} onChange={(e) => setDraftSetting('geminiTimeoutDraft', e.target.value)} />
          </label>
          <label className="chat-control settings-span-two">
            <span className="section-label">Ollama Address Endpoint</span>
            <input className="chat-select" type="text" value={ollamaBaseUrlDraft} onChange={(e) => setDraftSetting('ollamaBaseUrlDraft', e.target.value)} />
          </label>
          <label className="chat-control settings-span-two">
            <span className="section-label">Ollama Timeout (Seconds)</span>
            <input className="chat-select" type="number" min="1" value={ollamaTimeoutDraft} onChange={(e) => setDraftSetting('ollamaTimeoutDraft', e.target.value)} />
          </label>

          <div className="settings-span-two" style={{ marginTop: "16px", borderTop: "1px solid rgba(149, 181, 255, 0.1)", paddingTop: "16px" }}>
             <p className="section-label" style={{ marginBottom: "12px" }}>Default Models</p>
             <div style={{ display: "grid", gap: "24px", gridTemplateColumns: "1fr" }}>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "12px", alignItems: "end" }}>
                  <label className="chat-control">
                    <span className="section-label">Default Chat Provider</span>
                    <select className="chat-select" value={chatProviderDraft} onChange={(e) => setDraftSetting('chatProviderDraft', e.target.value)}>
                      <option value="">-- Select --</option>
                      {providers.map(p => <option key={p.name} value={p.name}>{p.display_name}</option>)}
                    </select>
                  </label>
                  <label className="chat-control">
                    <span className="section-label">Model</span>
                    <select className="chat-select" value={chatModelDraft} onChange={(e) => setDraftSetting('chatModelDraft', e.target.value)}>
                      <option value="">-- Select Model --</option>
                      {providers.find(p => p.name === chatProviderDraft)?.models.map(m => (
                        <option key={m.id} value={m.id}>{m.display_name}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "12px", alignItems: "end" }}>
                  <label className="chat-control">
                    <span className="section-label">Default Wizard Provider</span>
                    <select className="chat-select" value={wizardProviderDraft} onChange={(e) => setDraftSetting('wizardProviderDraft', e.target.value)}>
                      <option value="">-- Select --</option>
                      {providers.map(p => <option key={p.name} value={p.name}>{p.display_name}</option>)}
                    </select>
                  </label>
                  <label className="chat-control">
                    <span className="section-label">Model</span>
                    <select className="chat-select" value={wizardModelDraft} onChange={(e) => setDraftSetting('wizardModelDraft', e.target.value)}>
                      <option value="">-- Select Model --</option>
                      {providers.find(p => p.name === wizardProviderDraft)?.models.map(m => (
                        <option key={m.id} value={m.id}>{m.display_name}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "12px", alignItems: "end" }}>
                  <label className="chat-control">
                    <span className="section-label">Default Mending Provider (Fixes/Validation)</span>
                    <select className="chat-select" value={mendingProviderDraft} onChange={(e) => setDraftSetting('mendingProviderDraft', e.target.value)}>
                      <option value="">-- Select --</option>
                      {providers.map(p => <option key={p.name} value={p.name}>{p.display_name}</option>)}
                    </select>
                  </label>
                  <label className="chat-control">
                    <span className="section-label">Model</span>
                    <select className="chat-select" value={mendingModelDraft} onChange={(e) => setDraftSetting('mendingModelDraft', e.target.value)}>
                      <option value="">-- Select Model --</option>
                      {providers.find(p => p.name === mendingProviderDraft)?.models.map(m => (
                        <option key={m.id} value={m.id}>{m.display_name}</option>
                      ))}
                    </select>
                  </label>
                </div>

             </div>
          </div>

          <div className="settings-actions settings-span-two" style={{ marginTop: "16px" }}>
            <button type="submit" className="primary-button" disabled={settingsLoading} style={{ width: "auto" }}>
              {settingsLoading ? "Saving..." : "Save Provider Configuration"}
            </button>
            {settingsSaveMessage && <span className="success-copy" style={{marginLeft: "16px"}}>{settingsSaveMessage}</span>}
            {settingsError && <span className="error-copy compact-error" style={{marginLeft: "16px"}}>{settingsError}</span>}
          </div>
        </form>
      </section>

      <section className="preview-card" style={{ padding: "32px", width: "100%" }}>
        <div className="preview-header">
          <p className="section-label">Maintenance</p>
          <h3>Deep Campaign Mender & Validator</h3>
          <p className="lede">Recursively scan all Campaign JSON files through the structural Pydantic schemas to expose data fractures.</p>
        </div>
        <div style={{ marginTop: "24px" }}>
          <button 
            type="button" 
            className="secondary-button" 
            onClick={handleValidateCampaign} 
            disabled={menderLoading} 
            style={{ width: "auto" }}
          >
            {menderLoading ? "Scanning Matrix..." : "Run Global Validation"}
          </button>

          {menderError && <p className="error-copy" style={{ marginTop: "16px" }}>{menderError}</p>}
          
          {menderValidation && (
            <div style={{ marginTop: "24px", background: "rgba(16, 28, 49, 0.4)", borderRadius: "8px", padding: "16px" }}>
              <p style={{ margin: "0 0 16px 0", fontWeight: "bold" }}>
                Scanned {menderValidation.scanned_files} structural files.
              </p>
              
              {menderValidation.errors.length === 0 && dangling.length === 0 ? (
                <p style={{ color: "#3fb950", margin: 0 }}>✓ All systems structurally sound. No faults detected.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  {menderValidation.errors.length > 0 && (
                    <div>
                      <p style={{ color: "#f85149", fontWeight: "bold", margin: "0 0 8px 0" }}>
                        ⚠️ Detected {menderValidation.errors.length} systemic faults:
                      </p>
                      <ul style={{ color: "#f85149", paddingLeft: "20px", margin: 0, fontSize: "0.9rem", display: "flex", flexDirection: "column", gap: "8px" }}>
                        {menderValidation.errors.map((err, i) => (
                          <li key={i} style={{ whiteSpace: "pre-wrap" }}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {dangling.length > 0 && (
                    <div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                        <p style={{ color: "#ffb44d", fontWeight: "bold", margin: 0 }}>
                          ◇ {dangling.length} proposed {dangling.length === 1 ? "entity" : "entities"} without files:
                        </p>
                        <button
                          type="button"
                          onClick={() => createStubsFor(dangling)}
                          disabled={stubsBusy}
                          style={{ background: "#4a3311", border: "1px solid #c27d0a", color: "#ffb44d", borderRadius: "4px", padding: "4px 10px", fontSize: "0.8rem", cursor: stubsBusy ? "not-allowed" : "pointer" }}
                        >
                          {stubsBusy ? "Creating..." : `Create all missing stubs (${new Set(dangling.map(d => d.name)).size})`}
                        </button>
                      </div>
                      {Object.entries(danglingBySource).map(([sourcePath, refs]) => (
                        <div key={sourcePath} style={{ marginBottom: "10px" }}>
                          <p style={{ color: "#8ab4f8", fontSize: "0.8rem", margin: "0 0 4px 0", fontFamily: "monospace" }}>{sourcePath}</p>
                          <ul style={{ paddingLeft: "20px", margin: 0, fontSize: "0.85rem", display: "flex", flexDirection: "column", gap: "4px" }}>
                            {refs.map((ref, i) => (
                              <li key={i} style={{ color: "#ffb44d", display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ flex: 1 }}>
                                  <em>{ref.name}</em>
                                  <span style={{ opacity: 0.7 }}> — {ref.suggested_type} (in {ref.field})</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => createStubsFor([ref])}
                                  disabled={stubsBusy}
                                  style={{ background: "rgba(255,180,77,0.12)", border: "1px solid rgba(255,180,77,0.4)", color: "#ffb44d", borderRadius: "4px", padding: "1px 8px", fontSize: "0.75rem", cursor: stubsBusy ? "not-allowed" : "pointer" }}
                                >
                                  Create stub
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

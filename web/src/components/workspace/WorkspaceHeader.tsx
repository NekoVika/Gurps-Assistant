import { useWorkspaceStore } from '../../stores/useWorkspaceStore';

export function WorkspaceHeader() {
  const { activeTab, setActiveTab, updateInfo, isUpdating, triggerUpdate } = useWorkspaceStore();

  return (
    <header className="panel top-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 24px", flexShrink: 0, borderRadius: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <img src="/logo.png" alt="GurpsAi Logo" style={{ height: "56px", objectFit: "contain" }} />
        {updateInfo?.update_available && (
          <button 
            className="primary-button" 
            style={{ background: "#0ea5e9", borderColor: "#0284c7" }}
            onClick={triggerUpdate}
            disabled={isUpdating}
          >
            {isUpdating ? "Downloading & Installing..." : `Update Available (v${updateInfo.latest_version})`}
          </button>
        )}
      </div>
      <nav style={{ display: "flex", gap: "12px" }}>
        <button 
          type="button" 
          className={`chip-button ${activeTab === "main" ? "primary-button" : "ghost-button"}`} 
          style={{ width: "auto", margin: 0 }}
          onClick={() => setActiveTab("main")}
        >
          Workspace
        </button>
        <button 
          type="button" 
          className={`chip-button ${activeTab === "rules" ? "primary-button" : "ghost-button"}`} 
          style={{ width: "auto", margin: 0 }}
          onClick={() => setActiveTab("rules")}
        >
          Rules DB
        </button>
        <button 
          type="button" 
          className={`chip-button ${activeTab === "activity" ? "primary-button" : "ghost-button"}`} 
          style={{ width: "auto", margin: 0 }}
          onClick={() => setActiveTab("activity")}
        >
          Activity Log
        </button>
        <button 
          type="button" 
          className={`chip-button ${activeTab === "config" ? "primary-button" : "ghost-button"}`} 
          style={{ width: "auto", margin: 0 }}
          onClick={() => setActiveTab("config")}
        >
          Config
        </button>
        <button 
          type="button" 
          className={`chip-button ${activeTab === "backend" ? "primary-button" : "ghost-button"}`} 
          style={{ width: "auto", margin: 0 }}
          onClick={() => setActiveTab("backend")}
        >
          Backend
        </button>
        <button 
          type="button" 
          className={`chip-button ${activeTab === "trashbin" ? "primary-button" : "ghost-button"}`} 
          style={{ width: "auto", margin: 0 }}
          onClick={() => setActiveTab("trashbin")}
        >
          Trashbin
        </button>
      </nav>
    </header>
  );
}

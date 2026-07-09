import { useEffect, useState, useMemo } from "react";
import { useWorkspaceStore } from "../stores/useWorkspaceStore";
import { useCampaignStore } from "../stores/useCampaignStore";
import { useChatStore } from "../stores/useChatStore";

import { WorkspaceHeader } from "./workspace/WorkspaceHeader";
import { CampaignSidebar } from "./workspace/CampaignSidebar";
import { FileEditorPanel } from "./workspace/FileEditorPanel";
import { ChatPanel } from "./workspace/ChatPanel";
import { ConfigPanel } from "./workspace/ConfigPanel";
import { BackendPanel } from "./workspace/BackendPanel";

import { RulesPanel } from "./RulesPanel";
import { ActivityPanel } from "./ActivityPanel";
import { TrashbinPanel } from "./TrashbinPanel";
import { ConfirmModal } from "./ConfirmModal";
import { WizardModal } from "./WizardModal";
import { type WizardDef } from "../lib/wizards";
import { getFileTree, getFileContent, writeFileContent, runStructuredChat } from '../lib/api';
import { useToast } from '../context/ToastContext';

export function MainWorkspace() {
  const { activeTab, appInitializing, loadWorkspaceData, providerSettings } = useWorkspaceStore();
  const { toast } = useToast();
  const {
    campaignPath, 
    campaignLoading, 
    fileTree, 
    loadCampaignData, 
    isDeleteModalOpen, 
    setIsDeleteModalOpen, 
    executeDeleteFile,
    handleCampaignSubmit, 
    handleBrowse, 
    handleCampaignInit,
    setSelectedPath
  } = useCampaignStore();
  const { loadSessions } = useChatStore();

  const [activeWizard, setActiveWizard] = useState<WizardDef | null>(null);

  // Shared by both onSubmitStructured and onCreateStub below.
  const updateParentChildLinks = async (tPath: string, vars: Record<string, string>) => {
     let parentPath = "";
     if (vars["Parent Chapter"] && tPath.includes("Encounters")) {
         parentPath = `Campaign/03_Story/${vars["Parent Episode"]}/${vars["Parent Chapter"]}/Chapter_Overview.json`;
     } else if (vars["Parent Episode"] && tPath.includes("Chapter_Overview.json")) {
         parentPath = `Campaign/03_Story/${vars["Parent Episode"]}/Episode_Overview.json`;
     }

     if (parentPath && vars["Name"]) {
         const pFile = await getFileContent(parentPath);
         const pData = JSON.parse(pFile.content);
         if (Array.isArray(pData.childLinks)) {
             if (!pData.childLinks.includes(vars["Name"])) {
                 pData.childLinks.push(vars["Name"]);
                 await writeFileContent(parentPath, JSON.stringify(pData, null, 2));
             }
         }
     }
  };

  useEffect(() => {
    let cancelled = false;

    async function init() {
      await Promise.all([
        loadWorkspaceData(),
        loadCampaignData(),
        loadSessions()
      ]);
      if (!cancelled) {
        useWorkspaceStore.setState({ appInitializing: false });
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, []);

  const dynamicWizardOptions = useMemo(() => {
    const episodes: string[] = [];
    const chapters: string[] = [];
    const encounters: string[] = [];
    
    function traverse(node: any) {
      if (node.node_type === "directory") {
        if (node.name.startsWith("Episode_")) episodes.push(node.name);
        if (node.name.startsWith("Chapter_")) chapters.push(node.name);
        if (node.name === "Encounters") {
          node.children.forEach((c: any) => {
             if (c.node_type === "file" && c.name.endsWith(".json")) {
               encounters.push(c.name.replace(".json", ""));
             }
          });
        }
        node.children.forEach(traverse);
      }
    }
    
    const campaignNode = fileTree.find(n => n.node_type === "directory" && n.path === "Campaign");
    if (campaignNode) traverse(campaignNode);
    
    return {
      episodes: Array.from(new Set(episodes)).sort(),
      chapters: Array.from(new Set(chapters)).sort(),
      encounters: Array.from(new Set(encounters)).sort()
    };
  }, [fileTree]);

  const campaignNode = fileTree.find(n => n.node_type === "directory" && n.path === "Campaign");
  const isCampaignUninitialized = campaignPath === "" || !campaignNode || campaignNode.children.length === 0;

  return (
    <div className="app-shell">
      {appInitializing && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(10, 14, 23, 0.75)",
          backdropFilter: "blur(8px)",
          zIndex: 99999,
          display: "flex", flexDirection: "column",
          justifyContent: "center", alignItems: "center",
          color: "#c9dfff", pointerEvents: "all"
        }}>
          <div style={{ display: "flex", gap: "16px", alignItems: "center", border: "1px solid rgba(149, 181, 255, 0.2)", background: "rgba(16, 28, 49, 0.8)", padding: "24px 32px", borderRadius: "16px", boxShadow: "0 12px 48px rgba(0,0,0,0.6)" }}>
            <span className="spinner" style={{ width: "24px", height: "24px", border: "3px solid rgba(149, 181, 255, 0.2)", borderTopColor: "#58a6ff", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
            <span style={{ fontSize: "1.1rem", fontWeight: 500, letterSpacing: "0.5px" }}>Synchronizing Workspace...</span>
          </div>
        </div>
      )}
      
      <WorkspaceHeader />

      {activeTab === "main" && isCampaignUninitialized && (
        <div className="workspace-grid workspace-centered">
          <section className="preview-card" style={{ padding: "40px", textAlign: "center" }}>
            <h2>Welcome to GurpsAi Workspace</h2>
            <p className="lede" style={{ margin: "16px auto" }}>No campaign folder is currently selected. Please select one or initialize a new skeleton.</p>
            <form onSubmit={handleCampaignSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px", alignItems: "center", marginTop: "24px" }}>
              <button type="button" className="ghost-button" onClick={handleBrowse} disabled={campaignLoading} style={{width: "200px", textAlign: "center"}}>📁 Browse Folders</button>
              <button type="button" className="ghost-button" onClick={handleCampaignInit} disabled={campaignLoading} style={{width: "200px", textAlign: "center"}}>Initialize Skeleton</button>
            </form>
          </section>
        </div>
      )}

      {activeTab === "rules" && <RulesPanel />}
      {activeTab === "activity" && <ActivityPanel />}
      {activeTab === "config" && <ConfigPanel />}
      {activeTab === "backend" && <BackendPanel />}
      
      {activeTab === "trashbin" && (
        <TrashbinPanel onRestore={async () => {
          const updatedTree = await getFileTree();
          useCampaignStore.setState({ fileTree: updatedTree });
        }} />
      )}

      {activeTab === "main" && !isCampaignUninitialized && (
        <div className="workspace-grid workspace-main">
          <CampaignSidebar setActiveWizard={setActiveWizard} />
          <FileEditorPanel />
          <ChatPanel />
        </div>
      )}

      <WizardModal 
         wizard={activeWizard}
         dynamicOptions={dynamicWizardOptions}
         onClose={() => setActiveWizard(null)}
         onSubmitStructured={async (compiledPrompt, schema, targetPath, pydanticModel, answers) => {
            const tempWizard = activeWizard;
            // NOTE: do NOT call setActiveWizard(null) here.
            // The modal must stay mounted while generation runs so the spinner overlay is visible.
            // setActiveWizard(null) is called on success inside the try block below.

            const wizProvider = providerSettings?.default_wizard_provider || "gemini";
            const wizModel = providerSettings?.default_wizard_model || null;
            
            const creativityLevel = answers["CreativityLevel"];
            const narrativeIntent = answers["NarrativeIntent"];

            // Auto-derive a scope hint from what we already know about the target
            // location in the campaign tree, so the AI has a relevance anchor even
            // when the wizard has no manual "PlacementContext" field.
            const autoScopeParts: string[] = [`Target: ${targetPath}`];
            if (answers["Parent Episode"]) autoScopeParts.push(`Episode: ${answers["Parent Episode"]}`);
            if (answers["Parent Chapter"]) autoScopeParts.push(`Chapter: ${answers["Parent Chapter"]}`);
            const autoScope = autoScopeParts.join(" | ");
            const manualPlacementContext = answers["PlacementContext"];
            const placementContext = manualPlacementContext
                ? `${autoScope}\n${manualPlacementContext}`
                : autoScope;

            // Build system context: workflow rules ONLY.
            // The JSON template is intentionally excluded — it's a minimal skeleton that was
            // teaching the model to produce stubs. Structure is enforced by the schema= param.
            // The workflow provides the actual GURPS build rules.
            let systemContent = "";
            if (tempWizard?.workflowPath) {
               try {
                  const resolvedWorkflowPath = typeof tempWizard.workflowPath === "function"
                    ? tempWizard.workflowPath({})
                    : tempWizard.workflowPath;
                  const wf = await getFileContent(resolvedWorkflowPath);
                  if (wf.content) {
                     systemContent += `CRITICAL: You MUST strictly adhere to these workflow rules:\n\`\`\`markdown\n${wf.content}\n\`\`\`\n\n`;
                  }
               } catch { /* workflow missing — proceed without */ }
            }

            const messages: import('../lib/api').ChatMessage[] = [];
            if (systemContent) {
               messages.push({ role: "system", content: systemContent });
            }
            messages.push({ role: "user", content: compiledPrompt });

            try {
               const { result: rawResult } = await runStructuredChat(
                 wizProvider,
                 wizModel || null,
                 messages,
                 schema,
                 pydanticModel,
                 creativityLevel,
                 narrativeIntent,
                 placementContext
               );
               // Apply wizard-level post-processing (e.g. expand armorCoverage → hitLocations).
               const result = tempWizard?.postProcess ? tempWizard.postProcess(rawResult) : rawResult;
               const jsonStr = JSON.stringify(result, null, 2);
               const writeResponse = await writeFileContent(targetPath, jsonStr);
               if (writeResponse.success) {
                 try {
                     await updateParentChildLinks(targetPath, answers);
                 } catch (e) {
                     console.error("Failed to update parent childLinks", e);
                 }
                 const updatedTree = await getFileTree();
                 useCampaignStore.setState({ fileTree: updatedTree });
                 setSelectedPath(targetPath);
                 setActiveWizard(null);
                 const fileName = targetPath.split("/").pop() ?? targetPath;
                 toast.success(`${fileName} created successfully ✓`);
               } else {
                 const errMsg = (writeResponse as any).error ?? "File write failed";
                 toast.error(errMsg);
                 throw new Error(errMsg);
               }
            } catch (err: any) {
               const msg = err?.message ?? String(err);
               // Only fire error toast for non-validation errors (validation shows inline in modal)
               if (!msg.includes("validation") && !msg.includes("Pydantic")) {
                 toast.error(`Generation failed: ${msg}`);
               }
               throw err;  // Re-throw so WizardModal can show inline error
            }
         }}
         onCreateStub={async (targetPath, templatePath, variables) => {
            setActiveWizard(null);
            try {
               let templateContent = "";
               try {
                  const tpl = await getFileContent(templatePath);
                  templateContent = tpl.content;
               } catch { /* template missing, start blank */ }
               
               for (const [key, val] of Object.entries(variables)) {
                 templateContent = templateContent.replace(new RegExp(`\\[(${key}|${key} Name)\\]`, "gi"), val as string);
               }

               const writeResponse = await writeFileContent(targetPath, templateContent);
               if (writeResponse.success) {
                  try {
                      await updateParentChildLinks(targetPath, variables);
                  } catch (e) {
                      console.error("Failed to update parent childLinks", e);
                  }

                  const updatedTree = await getFileTree();
                  useCampaignStore.setState({ fileTree: updatedTree });
                  setSelectedPath(targetPath);
               }
            } catch (err) {
               console.error("Stub creation failed", err);
            }
         }}
      />
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="Move to Trashbin?"
        message={`Are you sure you want to delete this file? It will be moved to the Trashbin and can be restored later.`}
        confirmText="Move to Trash"
        cancelText="Cancel"
        onConfirm={executeDeleteFile}
        onCancel={() => setIsDeleteModalOpen(false)}
      />

    </div>
  );
}

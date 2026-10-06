import { create } from 'zustand';
import { inferPlacement } from '../lib/placementContext';
import { resolveEntity } from '../lib/entityResolution';
import { buildIndex } from '../lib/traitAudit';
import { statedTotal } from '../lib/pointBuild';
import type { TraitIndex } from '../lib/traitResolver';
import type { CustomSkillJSON, CustomTalentJSON, CustomTraitJSON, SystemRulesJSON } from '../lib/types';
import {
  FileTreeNode,
  FileContent,
  CampaignValidateResponse,
  RegistryItem,
  getCampaignSettings,
  getFileTree,
  getFileContent,
  getCampaignRegistry,
  getTraitCatalogue,
  createBatchStubs,
  saveCampaignSettings,
  initCampaign,
  validateCampaign,
  browseCampaignFolder,
  deleteCampaignFile,
  renameCampaignEntity,
  writeFileContent
} from '../lib/api';

interface CampaignState {
  campaignPath: string;
  campaignPathDraft: string;
  campaignLoading: boolean;
  campaignMessage: string | null;

  fileTree: FileTreeNode[];
  fileTreeError: string | null;
  entityRegistry: RegistryItem[];
  /** Books plus this campaign's own declared traits, in one lookup. Null until
   *  loaded; a campaign with no rules database keeps it null and the UI says
   *  why rather than reporting everything as unrecognised. */
  traitIndex: TraitIndex | null;
  traitCatalogueReason: string;
  /** The campaign's own point budget, as System Rules states it. The
   *  default target for a character that does not state one itself. */
  campaignPointBudget: number | null;
  selectedPath: string;
  selectedFile: FileContent | null;
  fileContentError: string | null;

  // Pending "create stub for missing entity?" prompt (ConfirmModal in MainWorkspace)
  stubPrompt: { name: string; type: string; parentPath?: string } | null;
  /** Why the last stub attempt was refused, shown in the prompt. */
  stubNotice: string | null;
  /** A request to re-open a wizard against an entity that already exists.
   *  Raised from a passport, answered by MainWorkspace, which owns the modal. */
  deepenRequest: { wizardId: string; path: string; answers: Record<string, string> } | null;
  /** Story node the sidebar is narrowed to, or null for the whole campaign. */
  focusNode: string | null;

  isEditing: boolean;
  editedContent: string;
  isSaving: boolean;
  fileUndoStack: string[];
  isDeleteModalOpen: boolean;

  menderValidation: CampaignValidateResponse | null;
  menderLoading: boolean;
  menderError: string | null;

  // Actions
  loadCampaignData: () => Promise<void>;
  loadFileContent: (path: string) => Promise<void>;
  refreshEntityRegistry: () => Promise<void>;
  refreshCampaignArtifacts: () => Promise<void>;
  loadTraitIndex: () => Promise<void>;
  /** Add a skill to System Rules -> customSkills, from a sheet where the GM
   *  defined it. Writes System_Rules.json and reloads the catalogue. */
  declareCampaignSkill: (skill: CustomSkillJSON) => Promise<{ ok: boolean; message: string }>;
  setCampaignPathDraft: (path: string) => void;
  setSelectedPath: (path: string) => void;
  setIsEditing: (isEditing: boolean) => void;
  setEditedContent: (content: string) => void;
  setIsDeleteModalOpen: (isOpen: boolean) => void;
  setStubPrompt: (prompt: { name: string; type: string; parentPath?: string } | null) => void;
  setDeepenRequest: (req: { wizardId: string; path: string; answers: Record<string, string> } | null) => void;
  setFocusNode: (node: string | null) => void;
  /** `open` navigates to the new file; by default the GM stays where they were. */
  executeCreateStub: (open?: boolean) => Promise<void>;
  handleSaveEdit: () => Promise<void>;
  handleSaveParsedData: (newData: any) => Promise<void>;
  handleUndoFileAction: () => Promise<void>;
  executeDeleteFile: () => Promise<void>;
  handleNavigateTo: (targetName: string, suggestedType?: string) => Promise<void>;
  
  // Campaign Management Actions
  handleCampaignSubmit: (e?: React.FormEvent<HTMLFormElement>) => Promise<void>;
  handleCampaignInit: () => Promise<void>;
  handleBrowse: () => Promise<void>;
  handleValidateCampaign: () => Promise<void>;
}

export const useCampaignStore = create<CampaignState>((set, get) => ({
  campaignPath: "",
  campaignPathDraft: "",
  campaignLoading: false,
  campaignMessage: null,

  fileTree: [],
  fileTreeError: null,
  entityRegistry: [],
  traitIndex: null,
  traitCatalogueReason: "",
  campaignPointBudget: null,
  selectedPath: "",
  selectedFile: null,
  fileContentError: null,
  stubPrompt: null,
  stubNotice: null,
  deepenRequest: null,
  focusNode: null,

  isEditing: false,
  editedContent: "",
  isSaving: false,
  fileUndoStack: [],
  isDeleteModalOpen: false,

  menderValidation: null,
  menderLoading: false,
  menderError: null,

  refreshEntityRegistry: async () => {
    try {
      const registry = await getCampaignRegistry();
      set({ entityRegistry: registry });
    } catch (e) {
      console.error("Failed to refresh entity registry", e);
    }
  },

  // Refetch everything derived from campaign files (tree + registry).
  // Call after any mutation that creates, renames, moves or deletes entities.
  loadTraitIndex: async () => {
    // Two sources, one index: what the books price and what this campaign
    // invented. Kept together so no caller can forget to ask the second.
    const catalogue = await getTraitCatalogue();
    let custom: CustomTraitJSON[] = [];
    let skills: CustomSkillJSON[] = [];
    let talents: CustomTalentJSON[] = [];
    let budget: number | null = null;
    try {
      const file = await getFileContent("Campaign/System_Rules.json");
      const parsed = JSON.parse(file.content) as SystemRulesJSON;
      if (Array.isArray(parsed.customTraits)) custom = parsed.customTraits;
      if (Array.isArray(parsed.customSkills)) skills = parsed.customSkills;
      if (Array.isArray(parsed.customTalents)) talents = parsed.customTalents;
      budget = statedTotal(parsed.pointBudget);
    } catch {
      // No System Rules file, or it is not JSON. Books alone is a fine answer.
    }
    set({
      traitIndex: buildIndex(catalogue.traits as never[], custom as never[], skills, talents),
      traitCatalogueReason: catalogue.available ? "" : catalogue.reason,
      campaignPointBudget: budget,
    });
  },

  declareCampaignSkill: async (skill: CustomSkillJSON) => {
    // Read System Rules fresh rather than from the editor: the GM is editing a
    // character, and this is a separate, explicit write to another file.
    const path = "Campaign/System_Rules.json";
    let rules: SystemRulesJSON;
    try {
      rules = JSON.parse((await getFileContent(path)).content) as SystemRulesJSON;
    } catch {
      return { ok: false, message: "System Rules could not be read, so nothing was declared." };
    }
    const existing = Array.isArray(rules.customSkills) ? rules.customSkills : [];
    const key = (n: string) => n.trim().replace(/\/TL\d*$/i, "").toLowerCase();
    if (existing.some(s => key(s.name) === key(skill.name))) {
      return { ok: false, message: `${skill.name} is already a campaign skill.` };
    }
    const next = { ...rules, customSkills: [...existing, skill] };
    const res = await writeFileContent(path, JSON.stringify(next, null, 2));
    if (!res.success) return { ok: false, message: "System Rules could not be saved." };
    await get().loadTraitIndex();
    return { ok: true, message: `${skill.name} is now a campaign skill.` };
  },

  refreshCampaignArtifacts: async () => {
    try {
      const [tree, registry] = await Promise.all([getFileTree(), getCampaignRegistry()]);
      set({ fileTree: tree, entityRegistry: registry, fileTreeError: null });
    } catch (e) {
      console.error("Failed to refresh campaign artifacts", e);
    }
  },

  setStubPrompt: (prompt) => set({ stubPrompt: prompt, stubNotice: null }),
  setDeepenRequest: (req) => set({ deepenRequest: req }),
  setFocusNode: (node) => set({ focusNode: node }),

  executeCreateStub: async (open = false) => {
    const prompt = get().stubPrompt;
    if (!prompt) return;
    // Placement is read from where the GM was standing, not asked for.
    const context = inferPlacement(get().selectedFile?.content, prompt.type);
    try {
      const res = await createBatchStubs([{
        name: prompt.name,
        type: prompt.type,
        parent_path: prompt.parentPath,
        ...context,
      }]);
      if (res.paths.length === 0 && res.rejected && res.rejected.length > 0) {
        // Keep the prompt open so the reason is read where the name is.
        set({ stubNotice: res.rejected[0].reason });
        return;
      }
      set({ stubPrompt: null, stubNotice: null });
      await get().refreshCampaignArtifacts();
      // Creating from context leaves the GM in context. "Rick exists, moving
      // on" is the common case; being yanked to an empty sheet is the
      // interruption, so opening it is an explicit choice.
      if (open && res.paths.length > 0) {
        get().setSelectedPath(res.paths[0]);
      }
    } catch (err: any) {
      set({ stubNotice: "Could not create it: " + (err?.message ?? err) });
    }
  },

  setCampaignPathDraft: (path) => set({ campaignPathDraft: path }),
  setSelectedPath: (path) => {
    set({ selectedPath: path, isEditing: false, fileUndoStack: [] });
    get().loadFileContent(path);
  },
  setIsEditing: (isEditing) => set({ isEditing }),
  setEditedContent: (content) => set({ editedContent: content }),
  setIsDeleteModalOpen: (isOpen) => set({ isDeleteModalOpen: isOpen }),

  loadCampaignData: async () => {
    try {
      const [campaignResult, treeResult, registryResult] = await Promise.allSettled([
        getCampaignSettings(),
        getFileTree(),
        getCampaignRegistry()
      ]);

      const updates: Partial<CampaignState> = {};

      if (campaignResult.status === "fulfilled") {
        updates.campaignPath = campaignResult.value.active_path;
        updates.campaignPathDraft = campaignResult.value.active_path;
      }

      if (treeResult.status === "fulfilled") {
        updates.fileTree = treeResult.value;
        updates.fileTreeError = null;
      } else {
        updates.fileTreeError = treeResult.reason instanceof Error ? treeResult.reason.message : "Unknown file tree error";
      }

      if (registryResult.status === "fulfilled") {
        updates.entityRegistry = registryResult.value;
      }

      set(updates);
    } catch (e) {
      console.error("Failed to load campaign data", e);
    }
  },

  loadFileContent: async (path: string) => {
    if (!path) {
      set({ selectedFile: null, fileContentError: null });
      return;
    }
    try {
      const result = await getFileContent(path);
      set({ selectedFile: result, editedContent: result.content, fileContentError: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown file preview error";
      set({ fileContentError: message, selectedFile: null });
    }
  },

  handleSaveEdit: async () => {
    const state = get();
    if (!state.selectedFile) return;
    
    set({ isSaving: true, fileContentError: null });
    
    try {
      let oldName = null;
      let newName = null;
      let newData = null;
      if (state.selectedFile.path.endsWith('.json')) {
        try {
          const oldData = JSON.parse(state.selectedFile.content);
          newData = JSON.parse(state.editedContent);
          oldName = oldData.title || oldData.name;
          newName = newData.title || newData.name;
        } catch (e) {}
      }

      if (oldName && newName && oldName !== newName && newData) {
        const res = await renameCampaignEntity({
          old_path: state.selectedFile.path,
          old_title: oldName,
          new_name: newName,
          updated_content: newData
        });
        await get().refreshCampaignArtifacts();
        set({ selectedPath: res.new_path, isEditing: false });
        get().loadFileContent(res.new_path);
      } else {
        await writeFileContent(state.selectedFile.path, state.editedContent);
        set({
          selectedFile: { ...state.selectedFile, content: state.editedContent },
          isEditing: false
        });
        get().refreshEntityRegistry();
      }
    } catch (err: any) {
      set({ fileContentError: err.message || "Failed to save file." });
    } finally {
      set({ isSaving: false });
    }
  },

  handleSaveParsedData: async (newData: any) => {
    const state = get();
    if (!state.selectedFile) return;
    try {
      set({ fileUndoStack: [...state.fileUndoStack, state.selectedFile.content] });
      
      let oldName = null;
      let newName = null;
      if (state.selectedFile.path.endsWith('.json')) {
        try {
          const oldData = JSON.parse(state.selectedFile.content);
          oldName = oldData.title || oldData.name;
          newName = newData.title || newData.name;
        } catch (e) {}
      }

      if (oldName && newName && oldName !== newName) {
        const res = await renameCampaignEntity({
          old_path: state.selectedFile.path,
          old_title: oldName,
          new_name: newName,
          updated_content: newData
        });
        await get().refreshCampaignArtifacts();
        const newContent = JSON.stringify(newData, null, 2);
        set({
          selectedPath: res.new_path,
          editedContent: newContent
        });
        get().loadFileContent(res.new_path);
      } else {
        const newContent = JSON.stringify(newData, null, 2);
        await writeFileContent(state.selectedFile.path, newContent);
        set({
          selectedFile: { ...state.selectedFile, content: newContent },
          editedContent: newContent
        });
        get().refreshEntityRegistry();
      }
    } catch (err: any) {
      set({ fileContentError: err.message || "Failed to save the file." });
    }
  },

  handleUndoFileAction: async () => {
    const state = get();
    if (!state.selectedFile || state.fileUndoStack.length === 0) return;
    const lastContent = state.fileUndoStack[state.fileUndoStack.length - 1];
    try {
      await writeFileContent(state.selectedFile.path, lastContent);
      set({ 
        selectedFile: { ...state.selectedFile, content: lastContent },
        editedContent: lastContent,
        fileUndoStack: state.fileUndoStack.slice(0, -1)
      });
    } catch (err: any) {
      set({ fileContentError: err.message || "Failed to rollback file." });
    }
  },

  executeDeleteFile: async () => {
    const state = get();
    if (!state.selectedFile) return;
    try {
      await deleteCampaignFile(state.selectedFile.path);
      set({
        selectedFile: null,
        editedContent: "",
        fileUndoStack: [],
        isDeleteModalOpen: false,
        selectedPath: ""
      });
      await get().refreshCampaignArtifacts();
    } catch (err: any) {
      alert("Failed to delete file: " + err.message);
    }
  },

  handleNavigateTo: async (targetName: string, suggestedType?: string) => {
    const state = get();
    if (!targetName || !state.fileTree) return;
    const lowerName = targetName.toLowerCase();
    
    const findByPath = (nodes: any[]): any | null => {
      for (const node of nodes) {
        if (node.node_type === "file") {
          const pathLower = node.path.toLowerCase();
          if (pathLower === lowerName || pathLower === `campaign/${lowerName}` || pathLower === `campaign\\${lowerName}`) {
            return node;
          }
        }
        if (node.children) {
          const found = findByPath(node.children);
          if (found) return found;
        }
      }
      return null;
    };

    let targetNode = findByPath(state.fileTree);

    if (!targetNode) {
      // Resolve names through the shared rule rather than comparing filenames.
      // This used to be a third, weaker implementation: it lowercased the
      // filename and compared it literally, so "Missing Hunter (NPC)" never
      // matched Missing_Hunter_NPC.json. The chip rendered blue because the
      // registry resolved it, then clicking offered to create it again.
      const item = resolveEntity(state.entityRegistry, targetName);
      if (item) {
        get().setSelectedPath(item.path);
        return;
      }
    }

    if (targetNode) {
      get().setSelectedPath(targetNode.path);
    } else {
      // No file backs this name — offer to create a stub for it.
      set({ stubPrompt: { name: targetName, type: suggestedType || "Character" } });
    }
  },

  handleCampaignSubmit: async (e) => {
    if (e) e.preventDefault();
    set({ campaignLoading: true, campaignMessage: null });
    const state = get();
    try {
      const updated = await saveCampaignSettings(state.campaignPathDraft);
      set({
        campaignPath: updated.active_path,
        campaignPathDraft: updated.active_path,
        campaignMessage: "Campaign path updated."
      });
      await get().refreshCampaignArtifacts();
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Failed to update campaign path";
      set({ campaignMessage: `Error: ${detail}` });
    } finally {
      set({ campaignLoading: false });
    }
  },

  handleCampaignInit: async () => {
    set({ campaignLoading: true, campaignMessage: null });
    try {
      const res = await initCampaign();
      set({ campaignMessage: res.message });
      await get().refreshCampaignArtifacts();
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Failed to initialize campaign";
      set({ campaignMessage: `Error: ${detail}` });
    } finally {
      set({ campaignLoading: false });
    }
  },

  handleBrowse: async () => {
    set({ campaignLoading: true, campaignMessage: null });
    try {
      const res = await browseCampaignFolder();
      if (res.path) {
        set({ campaignPathDraft: res.path });
        const updated = await saveCampaignSettings(res.path);
        set({
          campaignPath: updated.active_path,
          campaignMessage: "Campaign loaded from picker."
        });
        await get().refreshCampaignArtifacts();
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Failed to browse folder";
      set({ campaignMessage: `Error: ${detail}` });
    } finally {
      set({ campaignLoading: false });
    }
  },

  handleValidateCampaign: async () => {
    set({ menderLoading: true, menderError: null, menderValidation: null });
    try {
      const res = await validateCampaign();
      set({ menderValidation: res });
    } catch (err: any) {
      set({ menderError: err.message || "Failed to validate campaign." });
    } finally {
      set({ menderLoading: false });
    }
  }
}));

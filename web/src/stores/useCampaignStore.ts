import { create } from 'zustand';
import {
  FileTreeNode,
  FileContent,
  CampaignValidateResponse,
  getCampaignSettings,
  getFileTree,
  getFileContent,
  saveCampaignSettings,
  initCampaign,
  validateCampaign,
  browseCampaignFolder,
  deleteCampaignFile,
  renameCampaignEntity,
  writeFileContent,
  mendFileString
} from '../lib/api';

interface CampaignState {
  campaignPath: string;
  campaignPathDraft: string;
  campaignLoading: boolean;
  campaignMessage: string | null;

  fileTree: FileTreeNode[];
  fileTreeError: string | null;
  selectedPath: string;
  selectedFile: FileContent | null;
  fileContentError: string | null;

  isEditing: boolean;
  editedContent: string;
  isSaving: boolean;
  isMendingFile: boolean;
  fileUndoStack: string[];
  isDeleteModalOpen: boolean;

  menderValidation: CampaignValidateResponse | null;
  menderLoading: boolean;
  menderError: string | null;

  // Actions
  loadCampaignData: () => Promise<void>;
  loadFileContent: (path: string) => Promise<void>;
  setCampaignPathDraft: (path: string) => void;
  setSelectedPath: (path: string) => void;
  setIsEditing: (isEditing: boolean) => void;
  setEditedContent: (content: string) => void;
  setIsDeleteModalOpen: (isOpen: boolean) => void;
  handleSaveEdit: () => Promise<void>;
  handleSaveParsedData: (newData: any) => Promise<void>;
  handleMendFile: (targetType: string, provider: string, model: string) => Promise<void>;
  handleUndoFileAction: () => Promise<void>;
  executeDeleteFile: () => Promise<void>;
  handleNavigateTo: (targetName: string) => Promise<void>;
  
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
  selectedPath: "",
  selectedFile: null,
  fileContentError: null,

  isEditing: false,
  editedContent: "",
  isSaving: false,
  isMendingFile: false,
  fileUndoStack: [],
  isDeleteModalOpen: false,

  menderValidation: null,
  menderLoading: false,
  menderError: null,

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
      const [campaignResult, treeResult] = await Promise.allSettled([
        getCampaignSettings(),
        getFileTree()
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
        const updatedTree = await getFileTree();
        set({ fileTree: updatedTree, selectedPath: res.new_path, isEditing: false });
        // loadFileContent will be called implicitly via components reacting to selectedPath change,
        // or we can explicitly call it here.
        get().loadFileContent(res.new_path);
      } else {
        await writeFileContent(state.selectedFile.path, state.editedContent);
        set({ 
          selectedFile: { ...state.selectedFile, content: state.editedContent },
          isEditing: false 
        });
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
        const updatedTree = await getFileTree();
        const newContent = JSON.stringify(newData, null, 2);
        set({ 
          fileTree: updatedTree, 
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
      }
    } catch (err: any) {
      set({ fileContentError: err.message || "Failed to save mended file." });
    }
  },

  handleMendFile: async (targetType: string, provider: string, model: string) => {
    const state = get();
    if (!state.selectedFile) return;
    set({ isMendingFile: true });
    try {
      set({ fileUndoStack: [...state.fileUndoStack, state.selectedFile.content] });
      const res = await mendFileString({
        provider: provider,
        model: model,
        target_type: targetType,
        raw_content: state.selectedFile.content
      });
      const writeResponse = await writeFileContent(state.selectedFile.path, res.mended_content);
      if (writeResponse.success) {
        set({ 
          selectedFile: { ...state.selectedFile, content: res.mended_content },
          editedContent: res.mended_content
        });
      } else {
        alert("Mend completed, but failed to write to file system.");
      }
    } catch (err: any) {
      alert("File mending failed: " + err);
    } finally {
      set({ isMendingFile: false });
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
      const updatedTree = await getFileTree();
      set({ fileTree: updatedTree });
    } catch (err: any) {
      alert("Failed to delete file: " + err.message);
    }
  },

  handleNavigateTo: async (targetName: string) => {
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

    const findByName = (nodes: any[]): any | null => {
      for (const node of nodes) {
        if (node.node_type === "file") {
          const nameWithoutExt = node.name.replace(/\.[^/.]+$/, "").toLowerCase();
          if (nameWithoutExt === lowerName || node.name.toLowerCase() === lowerName) {
            return node;
          }
        }
        if (node.children) {
          const found = findByName(node.children);
          if (found) return found;
        }
      }
      return null;
    };
    
    let targetNode = findByPath(state.fileTree);
    if (!targetNode) {
      targetNode = findByName(state.fileTree);
    }
    
    if (targetNode) {
      get().setSelectedPath(targetNode.path);
    } else {
      // alert("File not found in workspace.");
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
      const updatedTree = await getFileTree();
      set({ fileTree: updatedTree, fileTreeError: null });
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
      const updatedTree = await getFileTree();
      set({ fileTree: updatedTree, fileTreeError: null });
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
        const updatedTree = await getFileTree();
        set({ fileTree: updatedTree, fileTreeError: null });
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

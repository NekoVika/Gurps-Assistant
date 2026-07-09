import { create } from 'zustand';
import {
  HealthStatus,
  UpdateCheckResponse,
  ProviderStatus,
  ProviderSettings,
  getHealthStatus,
  getProviderStatuses,
  getProviderSettings,
  checkUpdate,
  saveProviderSettings,
  applyUpdate
} from '../lib/api';

interface WorkspaceState {
  activeTab: "main" | "rules" | "activity" | "config" | "backend" | "trashbin";
  setActiveTab: (tab: "main" | "rules" | "activity" | "config" | "backend" | "trashbin") => void;

  appInitializing: boolean;
  setAppInitializing: (init: boolean) => void;

  health: HealthStatus | null;
  healthError: string | null;
  updateInfo: UpdateCheckResponse | null;
  isUpdating: boolean;

  providers: ProviderStatus[];
  providerError: string | null;
  
  providerSettings: ProviderSettings | null;
  settingsError: string | null;
  settingsSaveMessage: string | null;
  settingsLoading: boolean;

  // Form drafts for settings
  geminiApiKeyDraft: string;
  geminiBaseUrlDraft: string;
  geminiTimeoutDraft: string;
  ollamaBaseUrlDraft: string;
  ollamaTimeoutDraft: string;
  chatProviderDraft: string;
  chatModelDraft: string;
  wizardProviderDraft: string;
  wizardModelDraft: string;
  mendingProviderDraft: string;
  mendingModelDraft: string;
  
  selectedProvider: string;
  selectedModel: string;

  setDraftSetting: (key: string, value: string) => void;
  setSelectedProvider: (provider: string) => void;
  setSelectedModel: (model: string) => void;

  // Actions
  loadWorkspaceData: () => Promise<void>;
  saveSettings: (e?: React.FormEvent<HTMLFormElement>) => Promise<void>;
  triggerUpdate: () => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  activeTab: "main",
  setActiveTab: (tab) => set({ activeTab: tab }),

  appInitializing: true,
  setAppInitializing: (init) => set({ appInitializing: init }),

  health: null,
  healthError: null,
  updateInfo: null,
  isUpdating: false,

  providers: [],
  providerError: null,

  providerSettings: null,
  settingsError: null,
  settingsSaveMessage: null,
  settingsLoading: false,

  geminiApiKeyDraft: "",
  geminiBaseUrlDraft: "https://generativelanguage.googleapis.com/v1beta",
  geminiTimeoutDraft: "15",
  ollamaBaseUrlDraft: "http://127.0.0.1:11434",
  ollamaTimeoutDraft: "120",
  chatProviderDraft: "",
  chatModelDraft: "",
  wizardProviderDraft: "",
  wizardModelDraft: "",
  mendingProviderDraft: "",
  mendingModelDraft: "",

  selectedProvider: localStorage.getItem("gurpsai.defaults.provider") || "ollama",
  selectedModel: localStorage.getItem("gurpsai.defaults.model") || "",

  setDraftSetting: (key, value) => set({ [key]: value }),
  setSelectedProvider: (provider) => {
    localStorage.setItem("gurpsai.defaults.provider", provider);
    set({ selectedProvider: provider });
  },
  setSelectedModel: (model) => {
    localStorage.setItem("gurpsai.defaults.model", model);
    set({ selectedModel: model });
  },

  loadWorkspaceData: async () => {
    try {
      const [healthResult, providerResult, settingsResult, updateResult] = await Promise.allSettled([
        getHealthStatus(),
        getProviderStatuses(),
        getProviderSettings(),
        checkUpdate()
      ]);

      const updates: Partial<WorkspaceState> = {};

      if (updateResult.status === "fulfilled") {
        updates.updateInfo = updateResult.value;
      }

      if (healthResult.status === "fulfilled") {
        updates.health = healthResult.value;
        updates.healthError = null;
      } else {
        updates.healthError = healthResult.reason instanceof Error ? healthResult.reason.message : "Unknown backend error";
      }

      if (providerResult.status === "fulfilled") {
        updates.providers = providerResult.value;
        updates.providerError = null;
        const currentProvider = get().selectedProvider;
        if (providerResult.value.length > 0) {
          const hasCurrent = providerResult.value.some((p) => p.name === currentProvider);
          if (!hasCurrent) {
            const first = providerResult.value[0].name;
            updates.selectedProvider = first;
            localStorage.setItem("gurpsai.defaults.provider", first);
          }
        }
      } else {
        updates.providerError = providerResult.reason instanceof Error ? providerResult.reason.message : "Unknown provider error";
      }

      if (settingsResult.status === "fulfilled") {
        const settings = settingsResult.value;
        updates.providerSettings = settings;
        updates.settingsError = null;
        updates.geminiBaseUrlDraft = settings.gemini_base_url;
        updates.geminiTimeoutDraft = String(settings.gemini_timeout_seconds);
        updates.ollamaBaseUrlDraft = settings.ollama_base_url;
        updates.ollamaTimeoutDraft = String(settings.ollama_timeout_seconds);
        updates.chatProviderDraft = settings.default_chat_provider || "gemini";
        updates.chatModelDraft = settings.default_chat_model || "";
        updates.wizardProviderDraft = settings.default_wizard_provider || "gemini";
        updates.wizardModelDraft = settings.default_wizard_model || "";
        updates.mendingProviderDraft = settings.default_mending_provider || "gemini";
        updates.mendingModelDraft = settings.default_mending_model || "";

        if (settings.default_chat_model && !localStorage.getItem("gurpsai.defaults.model_override")) {
          updates.selectedModel = settings.default_chat_model;
          localStorage.setItem("gurpsai.defaults.model", settings.default_chat_model);
          if (settings.default_chat_provider) {
             updates.selectedProvider = settings.default_chat_provider;
             localStorage.setItem("gurpsai.defaults.provider", settings.default_chat_provider);
          }
        }
      } else {
        updates.settingsError = settingsResult.reason instanceof Error ? settingsResult.reason.message : "Unknown settings error";
      }

      set(updates);
    } catch (e) {
      console.error("Failed to load workspace data", e);
    }
  },

  saveSettings: async (e) => {
    if (e) e.preventDefault();
    set({ settingsLoading: true, settingsError: null, settingsSaveMessage: null });
    const state = get();
    try {
      const updated = await saveProviderSettings({
        gemini_api_key: state.geminiApiKeyDraft.trim() || null,
        set_gemini_api_key: state.geminiApiKeyDraft.trim().length > 0,
        gemini_base_url: state.geminiBaseUrlDraft.trim(),
        gemini_timeout_seconds: Number(state.geminiTimeoutDraft),
        ollama_base_url: state.ollamaBaseUrlDraft.trim(),
        ollama_timeout_seconds: Number(state.ollamaTimeoutDraft),
        default_chat_provider: state.chatProviderDraft,
        default_chat_model: state.chatModelDraft,
        default_wizard_provider: state.wizardProviderDraft,
        default_wizard_model: state.wizardModelDraft,
        default_mending_provider: state.mendingProviderDraft,
        default_mending_model: state.mendingModelDraft
      });

      set({
        providerSettings: updated,
        geminiApiKeyDraft: "",
        geminiBaseUrlDraft: updated.gemini_base_url,
        geminiTimeoutDraft: String(updated.gemini_timeout_seconds),
        ollamaBaseUrlDraft: updated.ollama_base_url,
        ollamaTimeoutDraft: String(updated.ollama_timeout_seconds),
        settingsSaveMessage: "Provider settings saved. Refreshing provider status..."
      });

      const statuses = await getProviderStatuses();
      set({ providers: statuses, providerError: null });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown settings save error";
      set({ settingsError: detail });
    } finally {
      set({ settingsLoading: false });
    }
  },

  triggerUpdate: async () => {
    const updateInfo = get().updateInfo;
    if (!updateInfo || !updateInfo.latest_version) return;
    
    if (confirm(`Update v${updateInfo.latest_version} is available. The app will download and restart automatically. Proceed?`)) {
      set({ isUpdating: true });
      try {
        await applyUpdate(updateInfo.download_url!);
      } catch (e: any) {
        alert("Update failed: " + e.message);
        set({ isUpdating: false });
      }
    }
  }
}));

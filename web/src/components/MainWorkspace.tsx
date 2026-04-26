import { useEffect, useState, useMemo } from "react";

import ReactMarkdown from "react-markdown";
import { DraftReviewCard } from "./DraftReviewCard";
import { DiffEditorPanel, type Draft } from "./DiffEditorPanel";
import { CampaignRegistry } from "./CampaignRegistry";
import MDEditor from "@uiw/react-md-editor";
import { CharacterPassport } from "./CharacterPassport";
import { parseCharacter } from "../lib/CharacterParser";
import { LocationPassport } from "./LocationPassport";
import { parseLocation } from "../lib/LocationParser";
import { StoryPassport } from "./StoryPassport";
import { parseStory } from "../lib/StoryParser";
import { FactionPassport } from "./FactionPassport";
import { parseFaction } from "../lib/FactionParser";
import { WIZARDS, type WizardDef } from "../lib/wizards";
import { WizardModal } from "./WizardModal";
import { CharacterEditor } from "./editors/CharacterEditor";
import { LocationEditor } from "./editors/LocationEditor";
import { StoryEditor } from "./editors/StoryEditor";
import { FactionEditor } from "./editors/FactionEditor";
import { WorldDossierEditor } from "./editors/WorldDossierEditor";
import { CampaignOverviewEditor } from "./editors/CampaignOverviewEditor";
import { SystemRulesEditor } from "./editors/SystemRulesEditor";
import { StateEditor } from "./editors/StateEditor";
import { StatePassport } from "./StatePassport";
import { CampaignOverviewPassport } from "./CampaignOverviewPassport";
import { WorldDossierPassport } from "./WorldDossierPassport";
import { SystemRulesPassport } from "./SystemRulesPassport";
import { RulesPanel } from "./RulesPanel";
import { ActivityPanel } from "./ActivityPanel";
import { TrashbinPanel } from "./TrashbinPanel";
import { ConfirmModal } from "./ConfirmModal";

import {
  getFileContent,
  writeFileContent,
  validateFileContent,
  mendFileString,
  getFileTree,
  getHealthStatus,
  getProviderSettings,
  getProviderStatuses,
  saveProviderSettings,
  getCampaignSettings,
  saveCampaignSettings,
  initCampaign, validateCampaign, type CampaignValidateResponse,
  browseCampaignFolder,
  deleteCampaignFile,

  getSessions,
  getSession,
  createSession,
  updateSession,
  deleteSession,
  type ChatSession,

  streamChat,
  runRulesQa,
  type ChatMessage,
  type FileContent,
  type FileTreeNode,
  type HealthStatus,
  type ProviderSettings,
  type ProviderStatus,
  type RulesQaResult,
  checkUpdate,
  applyUpdate,
  type UpdateCheckResponse
} from "../lib/api";

type ReadBlock = {
  type: "read";
  path: string;
};

type DraftBlock = {
  type: "draft";
  path: string;
  content: string;
  complete: boolean;
};

type QueryRulesBlock = {
  type: "query_rules";
  query: string;
};

type TextBlock = {
  type: "text";
  content: string;
};

type MessagePart = TextBlock | DraftBlock | ReadBlock | QueryRulesBlock;

function parseMessageContent(text: string, isStreamFinished: boolean = true): MessagePart[] {
  const parts: MessagePart[] = [];
  let remaining = text;
  
  while (true) {
    const draftIdx = remaining.indexOf('<draft path="');
    const readIdx = remaining.indexOf('<read path="');
    const queryIdx = remaining.indexOf('<query_rules query="');
    
    const matches = [
      { type: "draft", idx: draftIdx },
      { type: "read", idx: readIdx },
      { type: "query_rules", idx: queryIdx }
    ].filter(m => m.idx !== -1).sort((a, b) => a.idx - b.idx);
    
    if (matches.length === 0) {
      if (remaining) parts.push({ type: "text", content: remaining });
      break;
    }
    
    const firstMatch = matches[0];
    const startIdx = firstMatch.idx;
    
    if (startIdx > 0) {
      parts.push({ type: "text", content: remaining.substring(0, startIdx) });
    }
    
    if (firstMatch.type === "read") {
      const pathStart = startIdx + 12;
      const pathEnd = remaining.indexOf('"', pathStart);
      if (pathEnd === -1) {
        parts.push({ type: "text", content: remaining.substring(startIdx) });
        break;
      }
      
      const readPathRaw = remaining.substring(pathStart, pathEnd);
      const readPath = readPathRaw.startsWith("Campaign/") ? readPathRaw : `Campaign/${readPathRaw}`;
      
      const tagEnd = remaining.indexOf('>', pathEnd);
      if (tagEnd === -1) {
        parts.push({ type: "text", content: remaining.substring(startIdx) });
        break;
      }
      
      parts.push({ type: "read", path: readPath });
      remaining = remaining.substring(tagEnd + 1);
    } else if (firstMatch.type === "query_rules") {
      const queryStart = startIdx + 20;
      const queryEnd = remaining.indexOf('"', queryStart);
      if (queryEnd === -1) {
        parts.push({ type: "text", content: remaining.substring(startIdx) });
        break;
      }
      
      const queryRaw = remaining.substring(queryStart, queryEnd);
      
      const tagEnd = remaining.indexOf('>', queryEnd);
      if (tagEnd === -1) {
        parts.push({ type: "text", content: remaining.substring(startIdx) });
        break;
      }
      
      parts.push({ type: "query_rules", query: queryRaw });
      remaining = remaining.substring(tagEnd + 1);
    } else {
      const pathStart = startIdx + 13;
      const pathEnd = remaining.indexOf('">', pathStart);
      if (pathEnd === -1) {
        parts.push({ type: "text", content: remaining.substring(startIdx) });
        break;
      }
      
      const draftPathRaw = remaining.substring(pathStart, pathEnd);
      const draftPath = draftPathRaw.startsWith("Campaign/") ? draftPathRaw : `Campaign/${draftPathRaw}`;
      
      const contentStart = pathEnd + 2;
      const endTagIdx = remaining.indexOf("</draft>", contentStart);
      
      if (endTagIdx === -1) {
        parts.push({ type: "draft", path: draftPath, content: remaining.substring(contentStart), complete: isStreamFinished });
        break;
      } else {
        let draftContent = remaining.substring(contentStart, endTagIdx);
        if (draftContent.startsWith("\n")) draftContent = draftContent.substring(1);
        if (draftContent.endsWith("\n")) draftContent = draftContent.slice(0, -1);
        parts.push({ type: "draft", path: draftPath, content: draftContent, complete: true });
        remaining = remaining.substring(endTagIdx + 8);
      }
    }
  }
  return parts;
}

export interface ContextFile {
  name: string;
  path: string;
  type: string;
}

export function MainWorkspace() {
  const [activeTab, setActiveTab] = useState<"main" | "rules" | "activity" | "config" | "backend" | "trashbin">("main");
  const [appInitializing, setAppInitializing] = useState(true);
  const [campaignPath, setCampaignPath] = useState("");
  const [campaignPathDraft, setCampaignPathDraft] = useState("");
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [campaignMessage, setCampaignMessage] = useState<string | null>(null);

  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResponse | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [providerSettings, setProviderSettings] = useState<ProviderSettings | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSaveMessage, setSettingsSaveMessage] = useState<string | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [menderValidation, setMenderValidation] = useState<CampaignValidateResponse | null>(null);
  const [menderLoading, setMenderLoading] = useState(false);
  const [menderError, setMenderError] = useState<string | null>(null);
  const [geminiApiKeyDraft, setGeminiApiKeyDraft] = useState("");
  const [geminiBaseUrlDraft, setGeminiBaseUrlDraft] = useState(
    "https://generativelanguage.googleapis.com/v1beta"
  );
  const [geminiTimeoutDraft, setGeminiTimeoutDraft] = useState("15");
  const [ollamaBaseUrlDraft, setOllamaBaseUrlDraft] = useState("http://127.0.0.1:11434");
  const [ollamaTimeoutDraft, setOllamaTimeoutDraft] = useState("120");
  const [chatProviderDraft, setChatProviderDraft] = useState("");
  const [chatModelDraft, setChatModelDraft] = useState("");
  const [wizardProviderDraft, setWizardProviderDraft] = useState("");
  const [wizardModelDraft, setWizardModelDraft] = useState("");
  const [mendingProviderDraft, setMendingProviderDraft] = useState("");
  const [mendingModelDraft, setMendingModelDraft] = useState("");
  const [selectedProvider, setSelectedProvider] = useState(() => localStorage.getItem("gurpsai.defaults.provider") || "ollama");
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem("gurpsai.defaults.model") || "");
  
  useEffect(() => {
    localStorage.setItem("gurpsai.defaults.provider", selectedProvider);
  }, [selectedProvider]);

  useEffect(() => {
    localStorage.setItem("gurpsai.defaults.model", selectedModel);
  }, [selectedModel]);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isMendingFile, setIsMendingFile] = useState(false);
  const [fileUndoStack, setFileUndoStack] = useState<string[]>([]);

  const handleUndoFileAction = async () => {
    if (!selectedFile || fileUndoStack.length === 0) return;
    const lastContent = fileUndoStack[fileUndoStack.length - 1];
    try {
      await writeFileContent(selectedFile.path, lastContent);
      setSelectedFile({ ...selectedFile, content: lastContent });
      setEditedContent(lastContent);
      setFileUndoStack(prev => prev.slice(0, -1));
    } catch (err: any) {
      setFileContentError(err.message || "Failed to rollback file.");
    }
  };

  const handleMendFile = async (targetType: string) => {
    if (!selectedFile) return;
    setIsMendingFile(true);
    try {
      setFileUndoStack(prev => [...prev, selectedFile.content]);
      const res = await mendFileString({
        provider: mendingProviderDraft || "gemini",
        model: mendingModelDraft || "",
        target_type: targetType,
        raw_content: selectedFile.content
      });
      const writeResponse = await writeFileContent(selectedFile.path, res.mended_content);
      if (writeResponse.success) {
        setSelectedFile({ ...selectedFile, content: res.mended_content });
        setEditedContent(res.mended_content);
      } else {
        alert("Mend completed, but failed to write to file system.");
      }
    } catch (err: any) {
      alert("File mending failed: " + err);
    } finally {
      setIsMendingFile(false);
    }
  };

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const handleNavigateTo = async (targetName: string) => {
    if (!targetName || !fileTree) return;
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
    
    let targetNode = findByPath(fileTree);
    if (!targetNode) {
      targetNode = findByName(fileTree);
    }
    if (targetNode) {
      try {
        const content = await getFileContent(targetNode.path);
        setSelectedFile(content);
        setEditedContent(content.content);
        setFileContentError(null);
        setActiveTab("main");
      } catch (err: any) {
        alert("Failed to open linked file: " + err.message);
      }
    } else {
      // alert(\File for "" not found in workspace.\);
    }
  };


  const handleDeleteFile = () => {
    if (!selectedFile) return;
    setIsDeleteModalOpen(true);
  };

  const executeDeleteFile = async () => {
    if (!selectedFile) return;
    try {
      await deleteCampaignFile(selectedFile.path);
      setSelectedFile(null);
      setEditedContent("");
      setFileUndoStack([]);
      setIsDeleteModalOpen(false);
      // Refresh the tree
      const updatedTree = await getFileTree();
      setFileTree(updatedTree);
    } catch (err: any) {
      alert("Failed to delete file: " + err.message);
    }
  };

  const [chatLoading, setChatLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
  const [fileTreeError, setFileTreeError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState("");
  const [selectedFile, setSelectedFile] = useState<FileContent | null>(null);
  const [fileContentError, setFileContentError] = useState<string | null>(null);
  const [rulesQuery, setRulesQuery] = useState("How does a Deceptive Attack work?");
  const [rulesResult, setRulesResult] = useState<RulesQaResult | null>(null);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<Draft | null>(null);
  const [consumedDrafts, setConsumedDrafts] = useState<string[]>([]);
  
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const [activeWizard, setActiveWizard] = useState<WizardDef | null>(null);

  const [activeContextFiles, setActiveContextFiles] = useState<ContextFile[]>([]);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);

  const availableContextFiles = useMemo(() => {
    const results: ContextFile[] = [];
    function traverse(node: FileTreeNode) {
      if (node.node_type === "directory") {
        if (node.name === ".planning" || node.name === ".agents" || node.name === "_reports" || node.name === "_templates") return;
        node.children.forEach(traverse);
      } else {
        if (!(node.path.endsWith(".md") || node.path.endsWith(".json")) || ["SYSTEM.md", "state.md", "state.json", "AGENTS.md", "00_System_Rules.md", "00_System_Rules.json", "README.md", "TODO.md", ".gurpsai_state.json"].includes(node.name)) return;
        
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

  // Reset index when query changes
  useEffect(() => setMentionIndex(0), [mentionQuery]);


  async function handleSaveEdit() {
    if (!selectedFile) return;
    setIsSaving(true);
    setFileContentError(null);
    try {
      await writeFileContent(selectedFile.path, editedContent);
      setSelectedFile({ ...selectedFile, content: editedContent });
      setIsEditing(false);
    } catch (err: any) {
      setFileContentError(err.message || "Failed to save file.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveParsedData(newData: any) {
    if (!selectedFile) return;
    try {
      setFileUndoStack(prev => [...prev, selectedFile.content]);
      const newContent = JSON.stringify(newData, null, 2);
      await writeFileContent(selectedFile.path, newContent);
      setSelectedFile({ ...selectedFile, content: newContent });
      // Update editedContent so if user switches to Edit mode it's correct
      setEditedContent(newContent);
    } catch (err: any) {
      setFileContentError(err.message || "Failed to save mended file.");
    }
  }


  // Reset editing mode when a new file is clicked
  useEffect(() => {
     setFileUndoStack([]);
     if (selectedFile) {
        setIsEditing(false);
        setEditedContent(selectedFile.content);
     }
  }, [selectedFile?.path]);

  useEffect(() => {
    let cancelled = false;

    async function loadBackendState() {
      const [healthResult, providerResult, settingsResult, treeResult, campaignResult, sessionsResult, updateResult] = await Promise.allSettled([
        getHealthStatus(),
        getProviderStatuses(),
        getProviderSettings(),
        getFileTree(),
        getCampaignSettings(),
        getSessions(),
        checkUpdate()
      ]);

      if (cancelled) {
        return;
      }
      
      if (sessionsResult.status === "fulfilled") {
        setSessions(sessionsResult.value);
        if (sessionsResult.value.length > 0) {
           setActiveSessionId(sessionsResult.value[0].id);
           setChatMessages(sessionsResult.value[0].messages);
        } else {
           // Create a default session
           try {
              const newSess = await createSession("New Chat");
              setSessions([newSess]);
              setActiveSessionId(newSess.id);
              setChatMessages([]);
           } catch { /* ignore */ }
        }
      }

      if (updateResult.status === "fulfilled") {
         setUpdateInfo(updateResult.value);
      }

      if (healthResult.status === "fulfilled") {
        setHealth(healthResult.value);
        setHealthError(null);
      } else {
        const message =
          healthResult.reason instanceof Error
            ? healthResult.reason.message
            : "Unknown backend error";
        setHealthError(message);
      }

      if (providerResult.status === "fulfilled") {
        setProviders(providerResult.value);
        setProviderError(null);
        if (providerResult.value.length > 0) {
          setSelectedProvider((current) =>
            providerResult.value.some((provider) => provider.name === current)
              ? current
              : providerResult.value[0].name
          );
        }
      } else {
        const message =
          providerResult.reason instanceof Error
            ? providerResult.reason.message
            : "Unknown provider error";
        setProviderError(message);
      }

      if (settingsResult.status === "fulfilled") {
        const settings = settingsResult.value;
        setProviderSettings(settings);
        setSettingsError(null);
        setGeminiBaseUrlDraft(settings.gemini_base_url);
        setGeminiTimeoutDraft(String(settings.gemini_timeout_seconds));
        setOllamaBaseUrlDraft(settings.ollama_base_url);
        setOllamaTimeoutDraft(String(settings.ollama_timeout_seconds));
        setChatProviderDraft(settings.default_chat_provider || "gemini");
        setChatModelDraft(settings.default_chat_model || "");
        setWizardProviderDraft(settings.default_wizard_provider || "gemini");
        setWizardModelDraft(settings.default_wizard_model || "");
        setMendingProviderDraft(settings.default_mending_provider || "gemini");
        setMendingModelDraft(settings.default_mending_model || "");
        
        // Initialize chat dropdown from config if not manually overriden
        if (settings.default_chat_model && !localStorage.getItem("gurpsai.defaults.model_override")) {
            setSelectedModel(settings.default_chat_model);
            if (settings.default_chat_provider) setSelectedProvider(settings.default_chat_provider);
        }
      } else {
        const message =
          settingsResult.reason instanceof Error
            ? settingsResult.reason.message
            : "Unknown settings error";
        setSettingsError(message);
      }

      if (treeResult.status === "fulfilled") {
        setFileTree(treeResult.value);
        setFileTreeError(null);
      } else {
        const message =
          treeResult.reason instanceof Error ? treeResult.reason.message : "Unknown file tree error";
        setFileTreeError(message);
      }

      if (campaignResult.status === "fulfilled") {
        setCampaignPath(campaignResult.value.active_path);
        setCampaignPathDraft(campaignResult.value.active_path);
      }
      
      setAppInitializing(false);
    }

    loadBackendState();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadFileContent() {
      if (!selectedPath) {
        if (!cancelled) {
          setSelectedFile(null);
          setFileContentError(null);
        }
        return;
      }
      try {
        const result = await getFileContent(selectedPath);
        if (!cancelled) {
          setSelectedFile(result);
          setFileContentError(null);
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Unknown file preview error";
          setFileContentError(message);
          setSelectedFile(null);
        }
      }
    }

    loadFileContent();

    return () => {
      cancelled = true;
    };
  }, [selectedPath]);

  useEffect(() => {
    if (providers.length === 0) return;

    const provider = providers.find((item) => item.name === selectedProvider);
    if (!provider) {
      setSelectedModel("");
      return;
    }
    if (provider.models.length === 1) {
      setSelectedModel(provider.models[0].id);
      return;
    }
    if (provider.models.length === 0) {
      setSelectedModel("");
      return;
    }
    if (!provider.models.some((model) => model.id === selectedModel)) {
      setSelectedModel(provider.models[0].id);
    }
  }, [providers, selectedProvider, selectedModel]);

  async function handleRulesSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRulesLoading(true);
    setRulesError(null);

    try {
      const result = await runRulesQa(rulesQuery);
      setRulesResult(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown rules query error";
      setRulesError(message);
      setRulesResult(null);
    } finally {
      setRulesLoading(false);
    }
  }

  async function executeChatLoop(currentMessages: ChatMessage[], isSubsequent: boolean = false, explicitSessionId?: string | null, retryCount: number = 0, overrideModel?: string | null, overrideProvider?: string | null) {
    const effectiveSessionId = explicitSessionId !== undefined ? explicitSessionId : activeSessionId;
    if (!isSubsequent) {
      setChatLoading(true);
    }
    setStreamingMessage("");
    let accumulatedResponse = "";
    
    // Purge any accidental empty messages to prevent Pydantic 422 validation errors
    const sanitizedMessages = currentMessages.filter(m => m.content.trim().length > 0);
    
    try {
      const model = overrideModel || selectedModel || null;
      let provider = overrideProvider || selectedProvider;
      
      await streamChat(provider, model, sanitizedMessages, (chunk) => {
        accumulatedResponse += chunk;
        setStreamingMessage(accumulatedResponse);
      });
      
      // If the LLM failed to stream any text at all, don't poison state with an empty block
      const newMessages: ChatMessage[] = accumulatedResponse.trim()
        ? [...sanitizedMessages, { role: "assistant", content: accumulatedResponse }]
        : sanitizedMessages;
        
      setChatMessages(newMessages);
      setStreamingMessage(null);

      const parts = parseMessageContent(accumulatedResponse, true);
      const readParts = parts.filter((p): p is ReadBlock => p.type === "read");
      const queryParts = parts.filter((p): p is QueryRulesBlock => p.type === "query_rules");
      const draftParts = parts.filter((p): p is DraftBlock => p.type === "draft");

      let draftValidationError = "";
      if (draftParts.length > 0) {
         for (const draft of draftParts) {
            if (draft.complete) {
               try {
                  const res = await validateFileContent(draft.path, draft.content);
                  if (!res.valid) {
                     draftValidationError += `[SYSTEM: Validation Failed for ${draft.path}]\n${res.error}\n\n`;
                  }
               } catch (e) {
                  const errStr = e instanceof Error ? e.message : String(e);
                  draftValidationError += `[SYSTEM: Validation API Error for ${draft.path}]\n${errStr}\n\n`;
               }
            }
         }
      }

      let systemMessageContent = "";

      if (draftValidationError && retryCount < 3) {
         systemMessageContent += `${draftValidationError}Please fix the JSON errors and try again. Output the corrected <draft> block completely.\n\n`;
      }

      if (readParts.length > 0) {
        for (const rp of readParts) {
           try {
              const fileContent = await getFileContent(rp.path);
              systemMessageContent += `[SYSTEM: FILE CONTENT OF ${rp.path}]\n${fileContent.content}\n\n`;
           } catch (e) {
              const errStr = e instanceof Error ? e.message : String(e);
              systemMessageContent += `[SYSTEM: FILE SYSTEM ERROR on ${rp.path}]\n${errStr}\n\nCould not fetch file. Address the issue or ask the user.\n\n`;
           }
        }
      }

      if (queryParts.length > 0) {
        for (const qp of queryParts) {
           try {
              const res = await runRulesQa(qp.query);
              systemMessageContent += `[SYSTEM: RULES DB RESULTS FOR "${qp.query}"]\n${res.output}\n\n`;
           } catch (e) {
              const errStr = e instanceof Error ? e.message : String(e);
              systemMessageContent += `[SYSTEM: RULES DB ERROR FOR "${qp.query}"]\n${errStr}\n\nCould not fetch rules. Address the issue or ask the user.\n\n`;
           }
        }
      }

      if (systemMessageContent) {
         systemMessageContent += `Do not acknowledge this message. You must IMMEDIATELY continue generating your response using the provided context.`;
         
         const sysMsg: ChatMessage = { role: "user", content: systemMessageContent };
         const recursiveMsgs = [...newMessages, sysMsg];
         setChatMessages(recursiveMsgs);
         if (effectiveSessionId) await updateSession(effectiveSessionId, undefined, recursiveMsgs).catch(() => {});
         
         const nextRetryCount = draftValidationError ? retryCount + 1 : retryCount;
         await executeChatLoop(recursiveMsgs, true, effectiveSessionId, nextRetryCount);
      } else {
         setChatLoading(false);
         // Final save of loop
         if (effectiveSessionId) {
            // Rename if it's "New Chat"
            let overrideTitle = undefined;
            const currentSession = sessions.find(s => s.id === effectiveSessionId);
            if (currentSession && currentSession.title === "New Chat" && newMessages.length > 0) {
               const firstUserMsg = newMessages.find(m => m.role === "user");
               if (firstUserMsg) {
                  overrideTitle = firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? "..." : "");
               }
            }
            const updatedSess = await updateSession(effectiveSessionId, overrideTitle, newMessages).catch(() => null);
            if (updatedSess) {
               setSessions(prev => prev.map(s => s.id === updatedSess.id ? updatedSess : s));
            }
         }
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown chat error";
      setChatError(detail);
      if (accumulatedResponse.trim()) {
         setChatMessages([...currentMessages, { role: "assistant", content: accumulatedResponse }]);
      }
      setStreamingMessage(null);
      setChatLoading(false);
    }
  }

  async function handleChatSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = chatInput.trim();
    if (!message && activeContextFiles.length === 0) {
      setChatError("Chat message must not be empty.");
      return;
    }

    setChatLoading(true);

    const nextMessages: ChatMessage[] = [...chatMessages];
    
    if (activeContextFiles.length > 0) {
      const payloads = await Promise.all(
         activeContextFiles.map(async (file) => {
           try {
              const res = await getFileContent(file.path);
              return `<file_context path="${file.path}">\n${res.content}\n</file_context>`;
           } catch {
              return `<file_context path="${file.path}">\n[Error: Unable to load file content]\n</file_context>`;
           }
         })
      );
      
      const combinedContext = `ADDITIONAL CONTEXT REQUESTED BY USER:\n\n---\n${payloads.join("\n\n")}`;
      nextMessages.push({ role: "system", content: combinedContext });
      setActiveContextFiles([]);
    }

    if (message) {
      nextMessages.push({ role: "user", content: message });
    }

    setChatMessages(nextMessages);
    setChatInput("");
    setChatError(null);
    
    // Save User message immediately before stream
    if (activeSessionId) {
       await updateSession(activeSessionId, undefined, nextMessages).catch(() => {});
    }

    await executeChatLoop(nextMessages, false);
  }

  async function handleValidateCampaign() {
    setMenderLoading(true);
    setMenderError(null);
    setMenderValidation(null);
    try {
      const res = await validateCampaign();
      setMenderValidation(res);
    } catch (err: any) {
      setMenderError(err.message || "Failed to validate campaign.");
    } finally {
      setMenderLoading(false);
    }
  }

  async function handleSettingsSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSettingsLoading(true);
    setSettingsError(null);
    setSettingsSaveMessage(null);

    try {
      const updated = await saveProviderSettings({
        gemini_api_key: geminiApiKeyDraft.trim() || null,
        set_gemini_api_key: geminiApiKeyDraft.trim().length > 0,
        gemini_base_url: geminiBaseUrlDraft.trim(),
        gemini_timeout_seconds: Number(geminiTimeoutDraft),
        ollama_base_url: ollamaBaseUrlDraft.trim(),
        ollama_timeout_seconds: Number(ollamaTimeoutDraft),
        default_chat_provider: chatProviderDraft,
        default_chat_model: chatModelDraft,
        default_wizard_provider: wizardProviderDraft,
        default_wizard_model: wizardModelDraft,
        default_mending_provider: mendingProviderDraft,
        default_mending_model: mendingModelDraft
      });

      setProviderSettings(updated);
      setGeminiApiKeyDraft("");
      setGeminiBaseUrlDraft(updated.gemini_base_url);
      setGeminiTimeoutDraft(String(updated.gemini_timeout_seconds));
      setOllamaBaseUrlDraft(updated.ollama_base_url);
      setOllamaTimeoutDraft(String(updated.ollama_timeout_seconds));
      setSettingsSaveMessage("Provider settings saved. Refreshing provider status...");

      const statuses = await getProviderStatuses();
      setProviders(statuses);
      setProviderError(null);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown settings save error";
      setSettingsError(detail);
    } finally {
      setSettingsLoading(false);
    }
  }

  async function handleCampaignSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCampaignLoading(true);
    setCampaignMessage(null);
    try {
      const updated = await saveCampaignSettings(campaignPathDraft);
      setCampaignPath(updated.active_path);
      setCampaignPathDraft(updated.active_path);
      setCampaignMessage("Campaign path updated.");
      const updatedTree = await getFileTree();
      setFileTree(updatedTree);
      setFileTreeError(null);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Failed to update campaign path";
      setCampaignMessage(`Error: ${detail}`);
    } finally {
      setCampaignLoading(false);
    }
  }

  async function handleCampaignInit() {
    setCampaignLoading(true);
    setCampaignMessage(null);
    try {
      const res = await initCampaign();
      setCampaignMessage(res.message);
      const updatedTree = await getFileTree();
      setFileTree(updatedTree);
      setFileTreeError(null);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Failed to initialize campaign";
      setCampaignMessage(`Error: ${detail}`);
    } finally {
      setCampaignLoading(false);
    }
  }

  async function handleBrowse() {
    setCampaignLoading(true);
    setCampaignMessage(null);
    try {
      const res = await browseCampaignFolder();
      if (res.path) {
        setCampaignPathDraft(res.path);
        // Automatically save when a folder is selected from the picker
        const updated = await saveCampaignSettings(res.path);
        setCampaignPath(updated.active_path);
        setCampaignMessage("Campaign loaded from picker.");
        const updatedTree = await getFileTree();
        setFileTree(updatedTree);
        setFileTreeError(null);
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Failed to browse folder";
      setCampaignMessage(`Error: ${detail}`);
    } finally {
      setCampaignLoading(false);
    }
  }

  const activeProvider = providers.find((provider) => provider.name === selectedProvider) ?? null;

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
      <header className="panel top-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 24px", flexShrink: 0, borderRadius: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <img src="/logo.png" alt="GurpsAi Logo" style={{ height: "56px", objectFit: "contain" }} />
          {updateInfo?.update_available && (
            <button 
               className="primary-button" 
               style={{ background: "#0ea5e9", borderColor: "#0284c7" }}
               onClick={async () => {
                 if (confirm(`Update v${updateInfo.latest_version} is available. The app will download and restart automatically. Proceed?`)) {
                   setIsUpdating(true);
                   try {
                     await applyUpdate(updateInfo.download_url!);
                   } catch (e: any) {
                     alert("Update failed: " + e.message);
                     setIsUpdating(false);
                   }
                 }
               }}
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

      {/* FALLBACK FOR INIT */}
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

      {/* RULES TAB */}
      {activeTab === "rules" && (
        <RulesPanel />
      )}

      {/* MAIN TAB */}
      {activeTab === "main" && !isCampaignUninitialized && (
        <div className="workspace-grid workspace-main">
          {/* Left Sidebar */}
          <aside className="panel sidebar" style={{ overflowY: "auto" }}>
            <div className="panel-header">
              <p className="eyebrow">Campaign</p>
              <h1>{campaignPath ? "Loaded" : "Not Selected"}</h1>
            </div>

            <div style={{ flex: 1, overflowY: "auto", marginTop: "12px" }}>
              {fileTreeError ? <p className="error-copy compact-error">{fileTreeError}</p> : null}
              {fileTree.length > 0 ? (
                <CampaignRegistry 
                    tree={fileTree} 
                    selectedPath={selectedPath} 
                    onSelect={setSelectedPath} 
                    onActivateWizard={(wizardId) => {
                        const w = WIZARDS.find(w => w.id === wizardId);
                        if (w) setActiveWizard(w);
                    }}
                />
              ) : (
                <p className="status-copy">Loading file tree...</p>
              )}
            </div>
          </aside>

          {/* Center Main Panel (File Preview) */}
          <main className="panel main-panel" style={{ overflowY: "auto" }}>
            <div className="panel-header">
              <p className="eyebrow">Workspace</p>
              <h2>File Viewer</h2>
            </div>
            
            <section style={{ marginTop: "24px", display: "flex", flexDirection: "column" }}>
              {fileContentError ? <div className="error-copy" style={{ whiteSpace: "pre-wrap", padding: "12px", background: "rgba(255, 60, 60, 0.1)", border: "1px solid rgba(255, 60, 60, 0.4)", borderRadius: "6px" }}>{fileContentError}</div> : null}
              {pendingDraft ? (
                 <DiffEditorPanel 
                   draft={pendingDraft} 
                   onClose={(consumed) => {
                     if (consumed) {
                        setConsumedDrafts(prev => [...prev, pendingDraft.content]);
                     }
                     setPendingDraft(null);
                   }} 
                   onRefreshTree={async () => {
                     const tree = await getFileTree();
                     setFileTree(tree);
                     // If the file we modified is currently selected, refresh it
                     if (selectedFile && selectedFile.path === pendingDraft.path) {
                        const updated = await getFileContent(pendingDraft.path);
                        setSelectedFile(updated);
                     }
                   }}
                 />
              ) : selectedFile ? (
                <div className="file-preview-wrapper" style={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
                  {!isEditing && (
                    <div className="file-preview-meta" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                      <div>
                        <span className="section-label">{selectedFile.path}</span>
                        {selectedFile.truncated ? (
                          <span className="status-pill pending" style={{ marginLeft: "12px" }}>Preview truncated</span>
                        ) : null}
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        {(() => {
                          const showDeepMend = selectedFile.path.includes("02_Characters") || selectedFile.path.includes("Locations") || selectedFile.path.includes("03_Story") || selectedFile.path.includes("Episode") || selectedFile.path.includes("sessions");
                          const mendTargetType = selectedFile.path.includes("02_Characters") ? "Character" : (selectedFile.path.includes("Locations") ? "Location" : "Story");
                          if (showDeepMend && (selectedFile.path.endsWith('.json') || selectedFile.path.endsWith('.md'))) {
                              return (
                                <button type="button" className="chip-button" style={{ borderColor: "rgba(255, 183, 0, 0.4)", color: "#ffb700" }} onClick={() => handleMendFile(mendTargetType)} disabled={isMendingFile}>
                                  {isMendingFile ? "Mending..." : "🪄 Deep Mend File"}
                                </button>
                              );
                          }
                          return null;
                        })()}
                        {fileUndoStack.length > 0 && (
                          <button type="button" className="chip-button" style={{ borderColor: "rgba(255, 183, 0, 0.4)", color: "#ffb700" }} onClick={handleUndoFileAction}>
                            ⎌ Undo Last Action
                          </button>
                        )}
                        <button type="button" className="chip-button" onClick={() => setIsEditing(true)}>
                          📝 Edit
                        </button>
                        <button type="button" className="chip-button" style={{ borderColor: "rgba(255, 60, 60, 0.4)", color: "#ff7b72" }} onClick={handleDeleteFile}>
                          🗑️ Delete
                        </button>
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
                             if (selectedFile.path.includes("00_System_Rules")) {
                                return <SystemRulesEditor value={editedContent} onChange={setEditedContent} documentPath={selectedFile.path} />;
                             }
                             if (selectedFile.path.includes("state.md") || selectedFile.path.includes("state.json")) {
                                return <StateEditor value={editedContent} onChange={setEditedContent} documentPath={selectedFile.path} />;
                             }
                             if (selectedFile.path.includes("Campaign_Overview")) {
                                return <CampaignOverviewEditor value={editedContent} onChange={setEditedContent} documentPath={selectedFile.path} />;
                             }
                             if (selectedFile.path.includes("World_Dossier")) {
                                return <WorldDossierEditor value={editedContent} onChange={setEditedContent} documentPath={selectedFile.path} />;
                             }
                             if (selectedFile.path.includes("Factions")) {
                                return <FactionEditor value={editedContent} onChange={setEditedContent} documentPath={selectedFile.path} />;
                             }
                             if (selectedFile.path.includes("02_Characters")) {
                                return <CharacterEditor value={editedContent} onChange={setEditedContent} documentPath={selectedFile.path} />;
                             }
                             if (selectedFile.path.includes("Locations")) {
                                return <LocationEditor value={editedContent} onChange={setEditedContent} documentPath={selectedFile.path} />;
                             }
                             if (selectedFile.path.includes("Episode") || selectedFile.path.includes("03_Story") || selectedFile.path.includes("sessions")) {
                                return <StoryEditor value={editedContent} onChange={setEditedContent} documentPath={selectedFile.path} />;
                             }
                             // Fallback raw text editor
                             return (
                                <MDEditor
                                  value={editedContent}
                                  onChange={(val) => setEditedContent(val || "")}
                                  height="100%"
                                  previewOptions={{ components: {} }}
                                />
                             );
                          })()}
                       </div>
                    ) : (
                       <div className="file-preview-content" style={{ flexGrow: 1 }}>
                          {(() => {
                             if (selectedFile.path.includes("state.json")) {
                                try {
                                   const parsed = JSON.parse(selectedFile.content);
                                   return <StatePassport data={parsed} />;
                                } catch (e) {}
                             }
                             
                             if (selectedFile.path.includes("00_System_Rules.json")) {
                                try {
                                   const parsed = JSON.parse(selectedFile.content);
                                   return <SystemRulesPassport data={parsed} />;
                                } catch (e) {}
                             }
                             
                             if (selectedFile.path.includes("Campaign_Overview.json")) {
                                try {
                                   const parsed = JSON.parse(selectedFile.content);
                                   return <CampaignOverviewPassport data={parsed} />;
                                } catch (e) {}
                             }
                             
                             if (selectedFile.path.includes("World_Dossier.json")) {
                                try {
                                   const parsed = JSON.parse(selectedFile.content);
                                   return <WorldDossierPassport data={parsed} />;
                                } catch (e) {}
                             }
                             
                             if (selectedFile.path.includes("02_Characters")) {
                               const parsed = parseCharacter(selectedFile.content);
                               if (parsed && parsed.name && parsed.name !== "Unknown Character") {
                                  return <CharacterPassport data={parsed} documentPath={selectedFile.path} onUpdate={handleSaveParsedData} onNavigate={handleNavigateTo} />;
                               }
                             }
                             if (selectedFile.path.includes("Factions")) {
                               const parsed = parseFaction(selectedFile.content);
                               if (parsed && parsed.name && parsed.name !== "Unknown Faction") {
                                  return <FactionPassport data={parsed} documentPath={selectedFile.path} onNavigate={handleNavigateTo} />;
                               }
                             }
                             if (selectedFile.path.includes("Locations")) {
                               const parsed = parseLocation(selectedFile.content);
                               if (parsed && parsed.name && parsed.name !== "Unknown Location") {
                                  return <LocationPassport data={parsed} documentPath={selectedFile.path} onNavigate={handleNavigateTo} />;
                               }
                             }
                             
                             if (selectedFile.path.includes("Episode") || selectedFile.path.includes("03_Story") || selectedFile.path.includes("sessions")) {
                               const parsed = parseStory(selectedFile.content);
                               if (parsed && parsed.title && parsed.title !== "Unknown Story Part") {
                                  return <StoryPassport data={parsed} documentPath={selectedFile.path} onNavigate={handleNavigateTo} />;
                               }
                             }
                             
                             // Fallback to RAW representation depending on type
                             const showMendBanner = selectedFile.path.includes("02_Characters") || selectedFile.path.includes("Locations") || selectedFile.path.includes("03_Story") || selectedFile.path.includes("Episode") || selectedFile.path.includes("sessions");
                             const mendTargetType = selectedFile.path.includes("02_Characters") ? "Character" : (selectedFile.path.includes("Locations") ? "Location" : "Story");
                             
                             if (selectedFile.path.endsWith('.json')) {
                                return (
                                  <div className="json-content" style={{ whiteSpace: "pre-wrap", fontFamily: "monospace", padding: "20px" }}>
                                    {showMendBanner && (
                                      <div style={{ padding: "16px", background: "rgba(255, 100, 100, 0.1)", border: "1px solid #ff4444", borderRadius: "8px", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <div>
                                          <strong style={{ color: "#ff4444" }}>Malformed JSON Detected</strong>
                                          <p style={{ margin: "4px 0 0 0", fontSize: "0.9em", opacity: 0.8 }}>This {mendTargetType} file failed to parse into the rich passport view.</p>
                                        </div>
                                        <button 
                                          className="primary-button" 
                                          onClick={() => handleMendFile(mendTargetType)}
                                          disabled={isMendingFile}
                                        >
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
              ) : (
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: "400px", opacity: 0.4 }}>
                  <span style={{ fontSize: "48px", marginBottom: "16px" }}>📄</span>
                  <p className="status-copy" style={{ fontSize: "1.1rem" }}>Select a file from the browser to view it.</p>
                </div>
              )}
            </section>
          </main>

          {/* Right Sidebar (Chat) */}
          <aside className="panel inspector chat-sidebar" style={{ display: "flex", flexDirection: "column", overflow: "hidden", padding: "12px 14px" }}>
            <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: "8px", borderBottom: "1px solid rgba(149, 181, 255, 0.12)", paddingBottom: "12px", marginBottom: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="eyebrow" style={{ color: "#c9dfff", fontWeight: 600 }}>Assistant</span>
                <span className={`status-pill ${activeProvider?.available ? "online" : "offline"}`} style={{ fontSize: "0.65rem", padding: "2px 6px" }}>
                  {activeProvider?.available ? "Ready" : "Offline"}
                </span>
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <select 
                  style={{ flexGrow: 1, padding: "4px 8px", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(149, 181, 255, 0.2)", borderRadius: "4px", color: "white", fontSize: "0.8rem", overflow: "hidden", textOverflow: "ellipsis" }}
                  value={activeSessionId || ""}
                  onChange={async (e) => {
                     const sid = e.target.value;
                     setActiveSessionId(sid);
                     setSessionsLoading(true);
                     try {
                        const sess = await getSession(sid);
                        setChatMessages(sess.messages);
                     } catch {  }
                     finally { setSessionsLoading(false); }
                  }}
                  disabled={sessionsLoading}
                >
                  {sessions.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                </select>
                <button 
                  onClick={async () => {
                     if (!activeSessionId) return;
                     const currentSession = sessions.find(s => s.id === activeSessionId);
                     const newTitle = window.prompt("Rename chat session:", currentSession?.title || "");
                     if (newTitle !== null && newTitle.trim() !== "") {
                        setSessionsLoading(true);
                        try {
                           const updatedSess = await updateSession(activeSessionId, newTitle.trim(), undefined);
                           setSessions(prev => prev.map(s => s.id === updatedSess.id ? updatedSess : s));
                        } catch {} finally { setSessionsLoading(false); }
                     }
                  }}
                  style={{ background: "rgba(255, 255, 255, 0.1)", border: "1px solid rgba(255, 255, 255, 0.2)", borderRadius: "4px", padding: "0 8px", color: "#c9dfff", cursor: "pointer" }}
                  title="Rename Chat Session"
                  disabled={sessionsLoading}
                >
                  ✎
                </button>
                <button 
                  onClick={async () => {
                     const newSess = await createSession("New Chat");
                     setSessions([newSess, ...sessions]);
                     setActiveSessionId(newSess.id);
                     setChatMessages([]);
                  }}
                  style={{ background: "rgba(56, 139, 253, 0.15)", border: "1px solid rgba(56, 139, 253, 0.4)", borderRadius: "4px", padding: "0 8px", color: "#79c0ff", cursor: "pointer" }}
                  title="New Chat Session"
                  disabled={sessionsLoading}
                >
                  +
                </button>
                <button 
                  onClick={async () => {
                     if (!activeSessionId) return;
                     await deleteSession(activeSessionId);
                     const updated = sessions.filter(s => s.id !== activeSessionId);
                     setSessions(updated);
                     if (updated.length > 0) {
                        setActiveSessionId(updated[0].id);
                        const sess = await getSession(updated[0].id);
                        setChatMessages(sess.messages);
                     } else {
                        const newSess = await createSession("New Chat");
                        setSessions([newSess]);
                        setActiveSessionId(newSess.id);
                        setChatMessages([]);
                     }
                  }}
                  style={{ background: "rgba(248, 81, 73, 0.15)", border: "1px solid rgba(248, 81, 73, 0.4)", borderRadius: "4px", padding: "0 8px", color: "#ff7b72", cursor: "pointer" }}
                  title="Delete Chat Session"
                  disabled={sessionsLoading}
                >
                  🗑
                </button>
              </div>
            </div>

            <div className="chat-transcript" style={{ flexGrow: 1, overflowY: "auto", margin: "16px 0", paddingRight: "8px" }}>
              {chatMessages.length > 0 ? (
                chatMessages.map((message, index) => {
                  if (message.role === "system" || message.content.startsWith("[SYSTEM:")) return null;
                  return (
                    <div key={`${message.role}-${index}`} className={`chat-bubble ${message.role}`}>
                      <span className="section-label">{message.role}</span>
                      {parseMessageContent(message.content, true).map((part, pIdx) => {
                        if (part.type === "text") {
                          return (
                            <div key={pIdx} className="markdown-content">
                              <ReactMarkdown>{part.content}</ReactMarkdown>
                            </div>
                          );
                        } else if (part.type === "read") {
                          return (
                            <div key={pIdx} style={{ margin: "12px 0", padding: "8px 12px", background: "rgba(46, 160, 67, 0.15)", border: "1px solid rgba(46, 160, 67, 0.4)", borderRadius: "6px", display: "inline-block", fontSize: "0.85rem", color: "#3fb950" }}>
                              📖 Reading file: <span style={{fontFamily: "monospace"}}>{part.path}</span>
                            </div>
                          );
                        } else if (part.type === "query_rules") {
                          return (
                            <div key={pIdx} style={{ margin: "12px 0", padding: "8px 12px", background: "rgba(163, 113, 247, 0.15)", border: "1px solid rgba(163, 113, 247, 0.4)", borderRadius: "6px", display: "inline-block", fontSize: "0.85rem", color: "#d2a8ff" }}>
                              ⚖️ Querying rules: <span style={{fontFamily: "monospace"}}>{part.query}</span>
                            </div>
                          );
                        } else {
                          return (
                            <DraftReviewCard
                              key={pIdx}
                              path={part.path}
                              proposedContent={part.content}
                              isComplete={part.complete}
                              isConsumed={consumedDrafts.includes(part.content)}
                              onReviewDraft={(path, content, isComplete) => setPendingDraft({ path, content, isComplete })}
                            />
                          );
                        }
                      })}
                    </div>
                  );
                })
              ) : (
                <p className="status-copy">Start with a prompt.</p>
              )}
              
              {streamingMessage !== null && (
                <div className="chat-bubble assistant">
                  <span className="section-label">assistant (streaming)</span>
                  {parseMessageContent(streamingMessage, false).map((part, pIdx) => {
                    if (part.type === "text") {
                      return (
                        <div key={pIdx} className="markdown-content">
                          <ReactMarkdown>{part.content}</ReactMarkdown>
                        </div>
                      );
                    } else if (part.type === "read") {
                      return (
                        <div key={pIdx} style={{ margin: "12px 0", padding: "8px 12px", background: "rgba(46, 160, 67, 0.15)", border: "1px solid rgba(46, 160, 67, 0.4)", borderRadius: "6px", display: "inline-block", fontSize: "0.85rem", color: "#3fb950" }}>
                          📖 Reading file: <span style={{fontFamily: "monospace"}}>{part.path}</span>
                        </div>
                      );
                    } else if (part.type === "query_rules") {
                      return (
                        <div key={pIdx} style={{ margin: "12px 0", padding: "8px 12px", background: "rgba(163, 113, 247, 0.15)", border: "1px solid rgba(163, 113, 247, 0.4)", borderRadius: "6px", display: "inline-block", fontSize: "0.85rem", color: "#d2a8ff" }}>
                          ⚖️ Querying rules: <span style={{fontFamily: "monospace"}}>{part.query}</span>
                        </div>
                      );
                    } else {
                      return (
                        <DraftReviewCard
                          key={pIdx}
                          path={part.path}
                          proposedContent={part.content}
                          isComplete={part.complete}
                          isConsumed={consumedDrafts.includes(part.content)}
                          onReviewDraft={(path, content, isComplete) => setPendingDraft({ path, content, isComplete })}
                        />
                      );
                    }
                  })}
                </div>
              )}
            </div>

            <form className="chat-form" onSubmit={handleChatSubmit} style={{ flexShrink: 0, marginTop: 0, gap: 0 }}>
              {chatError ? <p className="error-copy compact-error" style={{ margin: "0 0 8px 0" }}>{chatError}</p> : null}
              {/* Composite Input Box */}
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
                
                {/* Bottom Tools Row */}
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
                    disabled={chatLoading || !chatInput.trim()} 
                    style={{ padding: "6px 14px", fontSize: "0.8rem", borderRadius: "8px", flexShrink: 0 }}
                  >
                    {chatLoading ? "..." : "Send"}
                  </button>
                </div>
              </div>
            </form>
          </aside>
        </div>
      )}

      {/* CONFIG TAB */}
      {activeTab === "config" && (
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
            <form className="settings-form settings-grid" onSubmit={handleSettingsSubmit} style={{ marginTop: "24px" }}>
              <label className="chat-control settings-span-two">
                <span className="section-label">Gemini API key</span>
                <input
                  className="chat-select"
                  type="password"
                  value={geminiApiKeyDraft}
                  onChange={(event) => setGeminiApiKeyDraft(event.target.value)}
                  placeholder={
                    providerSettings?.gemini_api_key_configured
                      ? "Key already saved. Type a new one to replace it."
                      : "Paste your Gemini API key"
                  }
                />
              </label>
              <label className="chat-control settings-span-two">
                <span className="section-label">Gemini Base URL</span>
                <input className="chat-select" type="text" value={geminiBaseUrlDraft} onChange={(e) => setGeminiBaseUrlDraft(e.target.value)} />
              </label>
              <label className="chat-control settings-span-two">
                <span className="section-label">Gemini Timeout (Seconds)</span>
                <input className="chat-select" type="number" min="1" value={geminiTimeoutDraft} onChange={(e) => setGeminiTimeoutDraft(e.target.value)} />
              </label>
              <label className="chat-control settings-span-two">
                <span className="section-label">Ollama Address Endpoint</span>
                <input className="chat-select" type="text" value={ollamaBaseUrlDraft} onChange={(e) => setOllamaBaseUrlDraft(e.target.value)} />
              </label>
              <label className="chat-control settings-span-two">
                <span className="section-label">Ollama Timeout (Seconds)</span>
                <input className="chat-select" type="number" min="1" value={ollamaTimeoutDraft} onChange={(e) => setOllamaTimeoutDraft(e.target.value)} />
              </label>

              <div className="settings-span-two" style={{ marginTop: "16px", borderTop: "1px solid rgba(149, 181, 255, 0.1)", paddingTop: "16px" }}>
                 <p className="section-label" style={{ marginBottom: "12px" }}>Default Models</p>
                 <div style={{ display: "grid", gap: "24px", gridTemplateColumns: "1fr" }}>
                    
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "12px", alignItems: "end" }}>
                      <label className="chat-control">
                        <span className="section-label">Default Chat Provider</span>
                        <select className="chat-select" value={chatProviderDraft} onChange={(e) => setChatProviderDraft(e.target.value)}>
                          <option value="">-- Select --</option>
                          {providers.map(p => <option key={p.name} value={p.name}>{p.display_name}</option>)}
                        </select>
                      </label>
                      <label className="chat-control">
                        <span className="section-label">Model</span>
                        <select className="chat-select" value={chatModelDraft} onChange={(e) => setChatModelDraft(e.target.value)}>
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
                        <select className="chat-select" value={wizardProviderDraft} onChange={(e) => setWizardProviderDraft(e.target.value)}>
                          <option value="">-- Select --</option>
                          {providers.map(p => <option key={p.name} value={p.name}>{p.display_name}</option>)}
                        </select>
                      </label>
                      <label className="chat-control">
                        <span className="section-label">Model</span>
                        <select className="chat-select" value={wizardModelDraft} onChange={(e) => setWizardModelDraft(e.target.value)}>
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
                        <select className="chat-select" value={mendingProviderDraft} onChange={(e) => setMendingProviderDraft(e.target.value)}>
                          <option value="">-- Select --</option>
                          {providers.map(p => <option key={p.name} value={p.name}>{p.display_name}</option>)}
                        </select>
                      </label>
                      <label className="chat-control">
                        <span className="section-label">Model</span>
                        <select className="chat-select" value={mendingModelDraft} onChange={(e) => setMendingModelDraft(e.target.value)}>
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
                  
                  {menderValidation.errors.length === 0 ? (
                    <p style={{ color: "#3fb950", margin: 0 }}>✓ All systems structurally sound. No faults detected.</p>
                  ) : (
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
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* BACKEND TAB */}
      {activeTab === "backend" && (
        <div className="workspace-grid workspace-centered">
          <section className="preview-card" style={{ padding: "32px", width: "100%" }}>
            <div className="preview-header">
              <p className="section-label">SysInfo</p>
              <h2>Backend Health</h2>
            </div>
            <div className="status-card" style={{ marginTop: "24px", background: "transparent", border: "none" }}>
              {health ? (
                <>
                  <span className="status-pill online">Connected</span>
                  <dl className="status-list" style={{ marginTop: "16px" }}>
                    <div><dt>App</dt><dd>{health.app_name}</dd></div>
                    <div><dt>Version</dt><dd>{health.version}</dd></div>
                    <div><dt>Status</dt><dd>{health.status}</dd></div>
                  </dl>
                </>
              ) : (
                <>
                  <span className={`status-pill ${healthError ? "offline" : "pending"}`}>
                    {healthError ? "Unavailable" : "Checking"}
                  </span>
                  <p className="status-copy" style={{ marginTop: "16px" }}>
                    {healthError ? `Check failed: ${healthError}` : "Waiting for backend..."}
                  </p>
                </>
              )}
            </div>
          </section>

          <section className="preview-card" style={{ padding: "32px", width: "100%" }}>
            <div className="preview-header">
              <p className="section-label">Services</p>
              <h2>Provider Status</h2>
            </div>
            {providerError ? <p className="error-copy compact-error" style={{marginTop: "16px"}}>{providerError}</p> : null}
            {providers.length > 0 ? (
              <div className="provider-list" style={{ marginTop: "24px" }}>
                {providers.map((provider) => (
                  <article key={provider.name} className="provider-card">
                    <div className="provider-card-header">
                      <div>
                        <h3>{provider.display_name}</h3>
                        <p className="provider-meta">{provider.base_url ?? provider.name}</p>
                      </div>
                      <span className={`status-pill ${provider.available ? "online" : "offline"}`}>
                        {provider.available ? "Available" : "Unavailable"}
                      </span>
                    </div>

                    <div className="provider-body">
                      <div className="provider-row"><span>Models</span><strong>{provider.models.length}</strong></div>
                    </div>

                    {provider.error_message ? <p className="provider-error">{provider.error_message}</p> : null}
                  </article>
                ))}
              </div>
            ) : (
              <p className="status-copy" style={{ marginTop: "16px" }}>Waiting for providers...</p>
            )}
          </section>

          <section className="preview-card" style={{ padding: "32px", width: "100%" }}>
            <div className="preview-header">
              <p className="section-label">Database</p>
              <h2>Rules QA Tooling</h2>
            </div>
            <form className="rules-form" onSubmit={handleRulesSubmit} style={{ marginTop: "24px" }}>
              <div className="rules-input-row">
                <input
                  id="rules-query"
                  className="rules-input"
                  type="text"
                  value={rulesQuery}
                  onChange={(event) => setRulesQuery(event.target.value)}
                  placeholder="Test the Rules DB directly..."
                />
                <button type="submit" className="primary-button" disabled={rulesLoading}>
                  {rulesLoading ? "Querying..." : "Run QA"}
                </button>
              </div>
            </form>

            {rulesError ? <p className="error-copy" style={{ marginTop: "16px" }}>{rulesError}</p> : null}
            {rulesResult ? (
              <div className="rules-output-card" style={{ marginTop: "24px" }}>
                <div className="preview-header">
                  <p className="section-label">Evidence Bundle</p>
                  <h3>{rulesResult.query}</h3>
                </div>
                <div className="rules-output markdown-content">
                  <ReactMarkdown>{rulesResult.output}</ReactMarkdown>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      )}

      {activeTab === "activity" && (
        <ActivityPanel />
      )}

      {activeTab === "trashbin" && (
        <TrashbinPanel onRestore={async () => {
          const updatedTree = await getFileTree();
          setFileTree(updatedTree);
        }} />
      )}

      <WizardModal 
         wizard={activeWizard}
         onClose={() => setActiveWizard(null)}
         onSubmitPrompt={async (compiledPrompt, modalSystemAugment) => {
            const tempWizard = activeWizard;
            setActiveWizard(null);
            setChatInput("");
            
            let finalSystemAugment = modalSystemAugment ? `${modalSystemAugment}\n\n` : "";
            if (tempWizard) {
               let templateStr = "";
               try {
                  const tpl = await getFileContent(tempWizard.stubTemplatePath);
                  templateStr = tpl.content;
               } catch { /* */ }
               
               let workflowStr = "";
               if (tempWizard.workflowPath) {
                  try {
                     const wf = await getFileContent(tempWizard.workflowPath);
                     workflowStr = wf.content;
                  } catch { /* */ }
               }
               
               if (workflowStr) {
                  finalSystemAugment += `CRITICAL: You MUST strictly adhere to these workflow rules:\n\`\`\`markdown\n${workflowStr}\n\`\`\`\n\n`;
               }
               if (templateStr) {
                  finalSystemAugment += `CRITICAL: You MUST strictly use this template structure for the output file:\n\`\`\`markdown\n${templateStr}\n\`\`\`\n\n`;
               }
            }

            let targetSessionId = activeSessionId;
            try {
               const newSess = await createSession(tempWizard?.title || "Wizard Setup");
               setSessions(prev => [newSess, ...prev]);
               setActiveSessionId(newSess.id);
               targetSessionId = newSess.id;
            } catch (err) {
               console.error("Failed to create wizard session", err);
            }

            const nextMessages: ChatMessage[] = [];
            if (finalSystemAugment) {
               nextMessages.push({ role: "system", content: finalSystemAugment });
            }
            nextMessages.push({ role: "user", content: compiledPrompt });
            
            setChatMessages(nextMessages);
            if (targetSessionId) {
               await updateSession(targetSessionId, undefined, nextMessages).catch(() => {});
            }
            const wizProvider = providerSettings?.default_wizard_provider || undefined;
            const wizModel = providerSettings?.default_wizard_model || undefined;
            await executeChatLoop(nextMessages, false, targetSessionId, 0, wizModel, wizProvider);
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
                 templateContent = templateContent.replace(new RegExp(`\\[(${key}|${key} Name)\\]`, "gi"), val);
               }

               const writeResponse = await writeFileContent(targetPath, templateContent);
               if (writeResponse.success) {
                  const updatedTree = await getFileTree();
                  setFileTree(updatedTree);
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
        message={`Are you sure you want to delete "${selectedFile?.name}"? It will be moved to the Trashbin and can be restored later.`}
        confirmText="Move to Trash"
        cancelText="Cancel"
        onConfirm={executeDeleteFile}
        onCancel={() => setIsDeleteModalOpen(false)}
      />

    </div>
  );
}






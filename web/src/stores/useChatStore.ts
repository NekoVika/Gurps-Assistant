import { create } from 'zustand';
import {
  ChatSession,
  ChatMessage,
  getSessions,
  getSession,
  createSession,
  updateSession,
  deleteSession,
  streamChat,
  validateFileContent,
  getFileContent,
  runRulesQa
} from '../lib/api';
import { Draft } from '../components/DiffEditorPanel';
import { useCampaignStore } from './useCampaignStore';


interface ChatState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  sessionsLoading: boolean;

  chatInput: string;
  chatMessages: ChatMessage[];
  chatError: string | null;
  chatLoading: boolean;
  streamingMessage: string | null;

  pendingDraft: Draft | null;
  consumedDrafts: string[];
  
  rulesQuery: string;
  rulesResult: any | null;
  rulesError: string | null;
  rulesLoading: boolean;

  // Actions
  loadSessions: () => Promise<void>;
  setActiveSessionId: (id: string | null) => Promise<void>;
  createNewSession: () => Promise<void>;
  deleteActiveSession: () => Promise<void>;
  renameActiveSession: (newTitle: string) => Promise<void>;
  
  setChatInput: (input: string) => void;
  setPendingDraft: (draft: Draft | null) => void;
  addConsumedDraft: (content: string) => void;
  
  setRulesQuery: (query: string) => void;
  handleRulesSubmit: (e?: React.FormEvent<HTMLFormElement>) => Promise<void>;

  executeChatLoop: (
    currentMessages: ChatMessage[],
    isSubsequent: boolean,
    explicitSessionId: string | null | undefined,
    retryCount: number,
    provider: string,
    model: string,
    contextFiles?: any[]
  ) => Promise<void>;
  
  handleChatSubmit: (e: React.FormEvent<HTMLFormElement>, provider: string, model: string, contextFiles?: any[]) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  sessionsLoading: false,

  chatInput: "",
  chatMessages: [],
  chatError: null,
  chatLoading: false,
  streamingMessage: null,

  pendingDraft: null,
  consumedDrafts: [],
  
  rulesQuery: "How does a Deceptive Attack work?",
  rulesResult: null,
  rulesError: null,
  rulesLoading: false,

  setChatInput: (input) => set({ chatInput: input }),
  setPendingDraft: (draft) => set({ pendingDraft: draft }),
  addConsumedDraft: (content) => set({ consumedDrafts: [...get().consumedDrafts, content] }),
  setRulesQuery: (query) => set({ rulesQuery: query }),

  loadSessions: async () => {
    try {
      const sessResult = await getSessions();
      set({ sessions: sessResult });
      if (sessResult.length > 0) {
        set({ activeSessionId: sessResult[0].id, chatMessages: sessResult[0].messages });
      } else {
        const newSess = await createSession("New Chat");
        set({ sessions: [newSess], activeSessionId: newSess.id, chatMessages: [] });
      }
    } catch (e) {
      console.error("Failed to load sessions", e);
    }
  },

  setActiveSessionId: async (id) => {
    if (!id) return;
    set({ activeSessionId: id, sessionsLoading: true });
    try {
      const sess = await getSession(id);
      set({ chatMessages: sess.messages });
    } catch (e) {
      console.error("Failed to fetch session", e);
    } finally {
      set({ sessionsLoading: false });
    }
  },

  createNewSession: async () => {
    set({ sessionsLoading: true });
    try {
      const newSess = await createSession("New Chat");
      set({ 
        sessions: [newSess, ...get().sessions], 
        activeSessionId: newSess.id, 
        chatMessages: [] 
      });
    } catch (e) {
      console.error("Failed to create session", e);
    } finally {
      set({ sessionsLoading: false });
    }
  },

  deleteActiveSession: async () => {
    const { activeSessionId, sessions } = get();
    if (!activeSessionId) return;
    set({ sessionsLoading: true });
    try {
      await deleteSession(activeSessionId);
      const updated = sessions.filter(s => s.id !== activeSessionId);
      if (updated.length > 0) {
        set({ sessions: updated, activeSessionId: updated[0].id });
        const sess = await getSession(updated[0].id);
        set({ chatMessages: sess.messages });
      } else {
        const newSess = await createSession("New Chat");
        set({ sessions: [newSess], activeSessionId: newSess.id, chatMessages: [] });
      }
    } catch (e) {
      console.error("Failed to delete session", e);
    } finally {
      set({ sessionsLoading: false });
    }
  },

  renameActiveSession: async (newTitle: string) => {
    const { activeSessionId, sessions } = get();
    if (!activeSessionId || newTitle.trim() === "") return;
    set({ sessionsLoading: true });
    try {
      const updatedSess = await updateSession(activeSessionId, newTitle.trim(), undefined);
      set({ sessions: sessions.map(s => s.id === updatedSess.id ? updatedSess : s) });
    } catch (e) {
      console.error("Failed to rename session", e);
    } finally {
      set({ sessionsLoading: false });
    }
  },

  handleRulesSubmit: async (e) => {
    if (e) e.preventDefault();
    set({ rulesLoading: true, rulesError: null });
    try {
      const result = await runRulesQa(get().rulesQuery);
      set({ rulesResult: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown rules query error";
      set({ rulesError: message, rulesResult: null });
    } finally {
      set({ rulesLoading: false });
    }
  },

  executeChatLoop: async (
    currentMessages: ChatMessage[], 
    isSubsequent: boolean = false, 
    explicitSessionId?: string | null, 
    retryCount: number = 0,
    provider: string = "gemini",
    model: string = "",
  ) => {
    const state = get();
    const effectiveSessionId = explicitSessionId !== undefined ? explicitSessionId : state.activeSessionId;
    if (!isSubsequent) {
      set({ chatLoading: true });
    }
    set({ streamingMessage: "" });
    
    const sanitizedMessages = currentMessages.filter(m => m.content.trim().length > 0 || (m.tool_calls && m.tool_calls.length > 0) || m.role === "tool");
    let liveMessages = [...sanitizedMessages];
    let currentAssistantText = "";
    
    const selectedPath = useCampaignStore.getState().selectedPath;
    // scopePath lets the backend compute a semantic scope descriptor (entity type,
    // parent/children, global-arc linkage). scopeHint stays as a legacy fallback for
    // the case where the backend can't resolve the path.
    const scopePath = selectedPath || undefined;
    const scopeHint = selectedPath ? `Currently viewing: ${selectedPath}` : undefined;

    try {
      await streamChat(provider, model, sanitizedMessages, (chunk) => {
        const msgs = [...liveMessages];
        let lastMsg = msgs[msgs.length - 1];
        
        if (chunk.type === "text") {
            if (!lastMsg || lastMsg.role !== "assistant" || lastMsg.tool_calls) {
                lastMsg = { role: "assistant", content: "" };
                msgs.push(lastMsg);
            }
            lastMsg.content += chunk.content;
            currentAssistantText += chunk.content;
            set({ streamingMessage: currentAssistantText });
        } else if (chunk.type === "tool_calls") {
            if (!lastMsg || lastMsg.role !== "assistant") {
                lastMsg = { role: "assistant", content: currentAssistantText };
                msgs.push(lastMsg);
            }
            lastMsg.tool_calls = chunk.tool_calls;
            currentAssistantText = "";
            set({ streamingMessage: "" });
        } else if (chunk.type === "tool_response") {
            msgs.push({ role: "tool", content: chunk.content, tool_call_id: chunk.tool_call_id });
        } else if (chunk.type === "draft") {
            set({ pendingDraft: { path: chunk.path, content: chunk.content, isComplete: true } });
        }
        liveMessages = msgs;
        set({ chatMessages: liveMessages });
      }, scopeHint, scopePath);

      let draftValidationError = "";
      const draftsToValidate = liveMessages
          .filter(m => m.role === "assistant" && m.tool_calls)
          .flatMap(m => m.tool_calls!)
          .filter(tc => tc.name === "draft_file");

      if (draftsToValidate.length > 0) {
         for (const tc of draftsToValidate) {
            try {
                const draft = tc.arguments as any;
                const res = await validateFileContent(draft.path, draft.content);
                if (!res.valid) {
                    draftValidationError += `[SYSTEM: Validation Failed for ${draft.path}]\n${res.error}\n\n`;
                }
            } catch (e) {
                const errStr = e instanceof Error ? e.message : String(e);
                draftValidationError += `[SYSTEM: Validation API Error for ${(tc.arguments as any)?.path || 'unknown'}]\n${errStr}\n\n`;
            }
         }
      }

      if (draftValidationError && retryCount < 3) {
         const sysMsg: ChatMessage = { 
             role: "user", 
             content: `${draftValidationError}Please fix the JSON errors and try again. Use the draft_file tool completely.` 
         };
         liveMessages.push(sysMsg);
         set({ chatMessages: liveMessages });
         
         if (effectiveSessionId) {
             await updateSession(effectiveSessionId, undefined, liveMessages).catch(() => {});
         }
         
         await get().executeChatLoop(liveMessages, true, effectiveSessionId, retryCount + 1, provider, model);
      } else {
         set({ chatLoading: false, streamingMessage: null });
         if (effectiveSessionId) {
            let overrideTitle = undefined;
            const currentSession = get().sessions.find(s => s.id === effectiveSessionId);
            if (currentSession && currentSession.title === "New Chat" && liveMessages.length > 0) {
               const firstUserMsg = liveMessages.find(m => m.role === "user");
               if (firstUserMsg) {
                  overrideTitle = firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? "..." : "");
               }
            }
            const updatedSess = await updateSession(effectiveSessionId, overrideTitle, liveMessages).catch(() => null);
            if (updatedSess) {
               set({ sessions: get().sessions.map(s => s.id === updatedSess.id ? updatedSess : s) });
            }
         }
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown chat error";
      set({ 
        chatError: detail,
        streamingMessage: null,
        chatLoading: false
      });
    }
  },

  handleChatSubmit: async (e, provider, model, contextFiles = []) => {
    e.preventDefault();
    const state = get();
    const message = state.chatInput.trim();
    
    if (!message && contextFiles.length === 0) {
      set({ chatError: "Chat message must not be empty." });
      return;
    }

    set({ chatLoading: true });

    const nextMessages: ChatMessage[] = [...state.chatMessages];
    
    if (contextFiles.length > 0) {
      const payloads = await Promise.all(
         contextFiles.map(async (file: any) => {
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
    }

    if (message) {
      nextMessages.push({ role: "user", content: message });
    }

    set({ 
      chatMessages: nextMessages,
      chatInput: "",
      chatError: null
    });
    
    if (state.activeSessionId) {
       await updateSession(state.activeSessionId, undefined, nextMessages).catch(() => {});
    }

    await get().executeChatLoop(nextMessages, false, undefined, 0, provider, model);
  }
}));

export type HealthStatus = {
  status: string;
  app_name: string;
  version: string;
};

export type ProviderCapabilities = {
  supports_streaming: boolean;
  supports_json_mode: boolean;
  supports_tools: boolean;
  max_context_tokens: number | null;
};

export type ProviderModel = {
  id: string;
  display_name: string;
  provider: string;
  capabilities: ProviderCapabilities;
};

export type ProviderStatus = {
  name: string;
  display_name: string;
  available: boolean;
  configured: boolean;
  error_message: string | null;
  base_url: string | null;
  capabilities: ProviderCapabilities;
  models: ProviderModel[];
};

export type ProviderSettings = {
  gemini_api_key_configured: boolean;
  gemini_base_url: string;
  gemini_timeout_seconds: number;
  ollama_base_url: string;
  ollama_timeout_seconds: number;
  default_chat_provider: string;
  default_chat_model: string;
  default_wizard_provider: string;
  default_wizard_model: string;
  default_mending_provider: string;
  default_mending_model: string;
};

export type ProviderSettingsUpdate = {
  gemini_api_key: string | null;
  set_gemini_api_key: boolean;
  gemini_base_url: string;
  gemini_timeout_seconds: number;
  ollama_base_url: string;
  ollama_timeout_seconds: number;
  default_chat_provider: string;
  default_chat_model: string;
  default_wizard_provider: string;
  default_wizard_model: string;
  default_mending_provider: string;
  default_mending_model: string;
};

export type CampaignSettings = {
  active_path: string;
};

export type InitCampaignResponse = {
  success: boolean;
  message: string;
};

export type CampaignValidateResponse = {
  scanned_files: number;
  errors: string[];
};

export type FileTreeNode = {
  path: string;
  name: string;
  node_type: "file" | "directory";
  children: FileTreeNode[];
};

export type FileContent = {
  path: string;
  name: string;
  content: string;
  truncated: boolean;
};

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatResult = {
  provider: string;
  model: string;
  text: string;
};

export type RulesQaResult = {
  query: string;
  output: string;
};

const DEFAULT_API_BASE = "http://127.0.0.1:8000";

function apiBaseUrl() {
  const envBase = import.meta.env.VITE_API_BASE_URL;
  if (typeof envBase === "string" && envBase.trim()) {
    return envBase;
  }
  if (import.meta.env.PROD) {
    return window.location.origin;
  }
  return DEFAULT_API_BASE;
}

export async function getHealthStatus(): Promise<HealthStatus> {
  const response = await fetch(`${apiBaseUrl()}/health`);
  if (!response.ok) {
    throw new Error(`Health request failed with ${response.status}`);
  }
  return (await response.json()) as HealthStatus;
}

export async function getProviderStatuses(): Promise<ProviderStatus[]> {
  const response = await fetch(`${apiBaseUrl()}/providers`);
  if (!response.ok) {
    throw new Error(`Provider request failed with ${response.status}`);
  }
  return (await response.json()) as ProviderStatus[];
}

export async function getProviderSettings(): Promise<ProviderSettings> {
  const response = await fetch(`${apiBaseUrl()}/settings/providers`);
  if (!response.ok) {
    throw new Error(`Settings request failed with ${response.status}`);
  }
  return (await response.json()) as ProviderSettings;
}

export async function saveProviderSettings(
  update: ProviderSettingsUpdate
): Promise<ProviderSettings> {
  const response = await fetch(`${apiBaseUrl()}/settings/providers`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(update)
  });
  if (!response.ok) {
    let detail = `Settings save failed with ${response.status}`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (typeof body.detail === "string" && body.detail.trim()) {
        detail = body.detail;
      }
    } catch {
      // Ignore JSON parsing errors.
    }
    throw new Error(detail);
  }
  return (await response.json()) as ProviderSettings;
}

export async function getCampaignSettings(): Promise<CampaignSettings> {
  const response = await fetch(`${apiBaseUrl()}/campaign/settings`);
  if (!response.ok) {
    throw new Error(`Campaign settings request failed with ${response.status}`);
  }
  return (await response.json()) as CampaignSettings;
}

export async function saveCampaignSettings(active_path: string): Promise<CampaignSettings> {
  const response = await fetch(`${apiBaseUrl()}/campaign/settings`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ active_path })
  });
  if (!response.ok) {
    let detail = `Campaign settings save failed with ${response.status}`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (typeof body.detail === "string" && body.detail.trim()) {
        detail = body.detail;
      }
    } catch {
      // Ignore JSON parsing errors.
    }
    throw new Error(detail);
  }
  return (await response.json()) as CampaignSettings;
}

export type CampaignBrowseResponse = {
  path: string;
};

export async function browseCampaignFolder(): Promise<CampaignBrowseResponse> {
  const response = await fetch(`${apiBaseUrl()}/campaign/browse`);
  if (!response.ok) {
    throw new Error(`Campaign browse request failed with ${response.status}`);
  }
  return (await response.json()) as CampaignBrowseResponse;
}

export async function initCampaign(): Promise<InitCampaignResponse> {
  const response = await fetch(`${apiBaseUrl()}/campaign/init`, {
    method: "POST"
  });
  if (!response.ok) {
    let detail = `Campaign initialization failed with ${response.status}`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (typeof body.detail === "string" && body.detail.trim()) {
        detail = body.detail;
      }
    } catch {
      // Ignore JSON parsing errors.
    }
    throw new Error(detail);
  }
  return (await response.json()) as InitCampaignResponse;
}

export async function getFileTree(): Promise<FileTreeNode[]> {
  const response = await fetch(`${apiBaseUrl()}/files/tree`);
  if (!response.ok) {
    throw new Error(`File tree request failed with ${response.status}`);
  }
  return (await response.json()) as FileTreeNode[];
}

export async function getFileContent(path: string): Promise<FileContent> {
  const response = await fetch(
    `${apiBaseUrl()}/files/content?path=${encodeURIComponent(path)}`
  );
  if (!response.ok) {
    let detail = `File content request failed with ${response.status}`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (typeof body.detail === "string" && body.detail.trim()) {
        detail = body.detail;
      }
    } catch {
      // Ignore JSON parsing errors.
    }
    throw new Error(detail);
  }
  return (await response.json()) as FileContent;
}

export type FileWriteResponse = {
  success: boolean;
  path: string;
  message: string;
};

export function getMediaUrl(imagePath: string, documentPath: string): string {
    if (!imagePath) return "";
    let resolvedPath = imagePath;
    if (!imagePath.startsWith("/") && !imagePath.startsWith("Campaign/")) {
       // It's relative. Combine with document path.
       // e.g. document = Campaign/02_Characters/PCs/Abella.md
       // image = portrait.png -> Campaign/02_Characters/PCs/portrait.png
       const parts = documentPath.split("/");
       parts.pop(); // remove filename
       resolvedPath = parts.join("/") + "/" + imagePath;
    }
    // Clean up any potential double slashes
    resolvedPath = resolvedPath.replace(/\/\//g, "/");
    return `${apiBaseUrl()}/files/media?path=${encodeURIComponent(resolvedPath)}`;
}

export async function listMediaInDir(dirPath: string): Promise<string[]> {
  const response = await fetch(`${apiBaseUrl()}/files/media_list?dir_path=${encodeURIComponent(dirPath)}`);
  if (!response.ok) {
    throw new Error(`Media list request failed with ${response.status}`);
  }
  return (await response.json()) as string[];
}

export async function uploadMedia(dirPath: string, file: File): Promise<string> {
  const formData = new FormData();
  formData.append("dir_path", dirPath);
  formData.append("file", file);

  const response = await fetch(`${apiBaseUrl()}/files/upload_media`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let detail = `Media upload failed with ${response.status}`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (typeof body.detail === "string" && body.detail.trim()) {
        detail = body.detail;
      }
    } catch {
      // Ignore JSON errors
    }
    throw new Error(detail);
  }

  const result = await response.json() as { success: boolean, filename: string };
  return result.filename;
}

export async function validateFileContent(path: string, content: string): Promise<{valid: boolean, error: string | null}> {
  const response = await fetch(`${apiBaseUrl()}/files/validate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ path, content })
  });
  if (!response.ok) {
    throw new Error(`File validation request failed with ${response.status}`);
  }
  return await response.json() as {valid: boolean, error: string | null};
}

export async function writeFileContent(path: string, content: string): Promise<FileWriteResponse> {
  const response = await fetch(`${apiBaseUrl()}/files/write`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ path, content })
  });

  if (!response.ok) {
    let detail = `File write request failed with ${response.status}`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (typeof body.detail === "string" && body.detail.trim()) {
        detail = body.detail;
      }
    } catch {
      // Ignore JSON parsing errors.
    }
    throw new Error(detail);
  }
  return (await response.json()) as FileWriteResponse;
}

export async function runRulesQa(query: string, limit = 3): Promise<RulesQaResult> {
  const response = await fetch(`${apiBaseUrl()}/rules/qa`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query, limit })
  });

  if (!response.ok) {
    let detail = `Rules QA request failed with ${response.status}`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (typeof body.detail === "string" && body.detail.trim()) {
        detail = body.detail;
      }
    } catch {
      // Ignore JSON parsing errors and keep the generic message.
    }
    throw new Error(detail);
  }

  return (await response.json()) as RulesQaResult;
}

export async function runChat(
  provider: string,
  model: string | null,
  messages: ChatMessage[]
): Promise<ChatResult> {
  const response = await fetch(`${apiBaseUrl()}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      provider,
      model,
      messages
    })
  });

  if (!response.ok) {
    let detail = `Chat request failed with ${response.status}`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (typeof body.detail === "string" && body.detail.trim()) {
        detail = body.detail;
      }
    } catch {
      // Ignore JSON parsing errors and keep generic message.
    }
    throw new Error(detail);
  }

  return (await response.json()) as ChatResult;
}

export async function streamChat(
  provider: string,
  model: string | null,
  messages: ChatMessage[],
  onChunk: (text: string) => void
): Promise<void> {
  const response = await fetch(`${apiBaseUrl()}/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      provider,
      model,
      messages
    })
  });

  if (!response.ok) {
    let detail = `Chat request failed with ${response.status}`;
    try {
      const body = await response.json();
      if (body && Array.isArray(body.detail)) {
        // Pydantic 422 Error array
        detail = "Validation Error: " + body.detail.map((e: any) => `${e.loc.join('.')}: ${e.msg}`).join(", ");
      } else if (body && typeof body.detail === "string" && body.detail.trim()) {
        detail = body.detail;
      }
    } catch {
      // Ignore JSON parsing errors.
    }
    throw new Error(detail);
  }

  if (!response.body) {
    throw new Error("Response body is empty.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith("data: ")) {
        const dataStr = trimmed.slice(6).trim();
        if (dataStr === "[DONE]") {
          return;
        }
        try {
          const payload = JSON.parse(dataStr);
          if (payload.error) {
            throw new Error(payload.error);
          }
          if (payload.text) {
            onChunk(payload.text);
          }
        } catch (e) {
          if (e instanceof Error && e.name !== "SyntaxError") {
            throw e;
          }
        }
      }
    }
  }
}

export type ChatSession = {
  id: string;
  title: string;
  updated_at: number;
  messages: ChatMessage[];
};

export async function getSessions(): Promise<ChatSession[]> {
  const response = await fetch(`${apiBaseUrl()}/sessions`);
  if (!response.ok) throw new Error(`Fetch sessions failed: ${response.status}`);
  return (await response.json()) as ChatSession[];
}

export async function getSession(id: string): Promise<ChatSession> {
  const response = await fetch(`${apiBaseUrl()}/sessions/${id}`);
  if (!response.ok) throw new Error(`Fetch session failed: ${response.status}`);
  return (await response.json()) as ChatSession;
}

export async function createSession(title: string = "New Chat"): Promise<ChatSession> {
  const response = await fetch(`${apiBaseUrl()}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title })
  });
  if (!response.ok) throw new Error(`Create session failed: ${response.status}`);
  return (await response.json()) as ChatSession;
}

export async function updateSession(id: string, title?: string, messages?: ChatMessage[]): Promise<ChatSession> {
  const response = await fetch(`${apiBaseUrl()}/sessions/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, messages })
  });
  if (!response.ok) throw new Error(`Update session failed: ${response.status}`);
  return (await response.json()) as ChatSession;
}

export async function deleteSession(id: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl()}/sessions/${id}`, {
    method: "DELETE"
  });
  if (!response.ok) throw new Error(`Delete session failed: ${response.status}`);
}


export async function validateCampaign(): Promise<CampaignValidateResponse> {
  const res = await fetch(`${apiBaseUrl()}/campaign/validate`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.detail || `Failed to validate campaign. Status: ${res.status}`);
  }
  return res.json();
}

export type ActivityEventSchema = {
  id: string;
  timestamp: string;
  event_type: string;
  description: string;
  metadata: Record<string, any>;
};

export type ActivityLogResponse = {
  events: ActivityEventSchema[];
};

export async function getActivityEvents(): Promise<ActivityEventSchema[]> {
  const url = `${apiBaseUrl()}/activity?t=${Date.now()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Fetch activity events failed: ${response.status}`);
  }
  const text = await response.text();
  try {
    const data = JSON.parse(text) as ActivityLogResponse;
    return data.events;
  } catch (e) {
    throw new Error(`Failed to parse JSON from ${url}. Received snippet: ${text.slice(0, 100)}`);
  }
}

export type MendRequest = {
  provider: string;
  model: string | null;
  target_type: string;
  raw_string: string;
};

export type MendResponse = {
  mended_string: string;
};

export async function mendString(request: MendRequest): Promise<MendResponse> {
  const response = await fetch(`${apiBaseUrl()}/campaign/mend`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    let detail = `Mend request failed with ${response.status}`;
    try {
      const body = await response.json();
      if (typeof body.detail === "string" && body.detail.trim()) {
        detail = body.detail;
      }
    } catch {
      // Ignore JSON parsing errors.
    }
    throw new Error(detail);
  }

  return await response.json() as MendResponse;
}

export type MendFileRequest = {
  provider?: string | null;
  model?: string | null;
  target_type: string;
  raw_content: string;
};

export type MendFileResponse = {
  mended_content: string;
};

export async function mendFileString(request: MendFileRequest): Promise<MendFileResponse> {
  const response = await fetch(`${apiBaseUrl()}/campaign/mend-file`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    let detail = `File mend request failed with ${response.status}`;
    try {
      const body = await response.json();
      if (typeof body.detail === "string" && body.detail.trim()) {
        detail = body.detail;
      }
    } catch { }
    throw new Error(detail);
  }

  return await response.json() as MendFileResponse;
}


export type TrashItem = {
  trash_id: string;
  original_path: string;
  deleted_at: string;
  name: string;
};

export type RenameEntityRequest = {
  old_path: string;
  new_name: string;
  updated_content: any;
};

export type RenameEntityResponse = {
  success: boolean;
  new_path: string;
  refactored_files: number;
};

export async function renameCampaignEntity(request: RenameEntityRequest): Promise<RenameEntityResponse> {
  const response = await fetch(`${apiBaseUrl()}/campaign/rename-entity`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request)
  });
  if (!response.ok) {
    let detail = `Rename entity failed (HTTP ${response.status})`;
    try {
      const body = await response.json();
      if (body && body.detail) {
        detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
      }
    } catch { }
    throw new Error(detail);
  }
  return await response.json();
}

export async function deleteCampaignFile(path: string): Promise<{ success: boolean; trash_id: string }> {
  const response = await fetch(`${apiBaseUrl()}/campaign/file`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path })
  });
  if (!response.ok) {
    let detail = `Failed to delete file (HTTP ${response.status})`;
    try {
      const body = await response.json();
      if (body && body.detail) {
        detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
      }
    } catch { }
    throw new Error(detail);
  }
  return await response.json();
}

export async function getTrashItems(): Promise<TrashItem[]> {
  const response = await fetch(`${apiBaseUrl()}/campaign/trash`);
  if (!response.ok) {
    return [];
  }
  return await response.json();
}

export async function restoreTrashItem(trash_id: string): Promise<{ success: boolean }> {
  const response = await fetch(`${apiBaseUrl()}/campaign/trash/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trash_id })
  });
  if (!response.ok) {
    throw new Error(`Failed to restore trash item`);
  }
  return await response.json();
}

export async function permanentDeleteTrashItem(trash_id: string): Promise<{ success: boolean }> {
  const response = await fetch(`${apiBaseUrl()}/campaign/trash/${trash_id}`, {
    method: "DELETE"
  });
  if (!response.ok) {
    throw new Error(`Failed to permanently delete trash item`);
  }
  return await response.json();
}

export type UpdateCheckResponse = {
  update_available: boolean;
  latest_version: string;
  download_url: string | null;
};

export async function checkUpdate(): Promise<UpdateCheckResponse> {
  const response = await fetch(`${apiBaseUrl()}/update/check`);
  if (!response.ok) {
    throw new Error(`Update check failed with ${response.status}`);
  }
  return (await response.json()) as UpdateCheckResponse;
}

export async function applyUpdate(download_url: string): Promise<{status: string}> {
  const response = await fetch(`${apiBaseUrl()}/update/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ download_url })
  });
  if (!response.ok) {
    throw new Error(`Apply update failed with ${response.status}`);
  }
  return (await response.json()) as {status: string};
}

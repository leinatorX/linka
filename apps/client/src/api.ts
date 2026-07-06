import type { AiProviderConfig, AiSettings, AiSettingsPayload, AssistantAttachment, AssistantConversation, AssistantMessage, AssistantResponse, AuthUser, Bookmark, Category } from "./types";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  if (options?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "请求失败" }));
    throw new Error(error.message ?? "请求失败");
  }

  return response.json() as Promise<T>;
}

export function listBookmarks(params: URLSearchParams): Promise<{ bookmarks: Bookmark[] }> {
  return request(`/api/bookmarks?${params.toString()}`);
}

export function getAuthStatus(): Promise<{ authenticated: boolean; user: AuthUser | null }> {
  return request("/api/auth/me");
}

export function loginUser(payload: { username: string; password: string; rememberSession: boolean }): Promise<{ user: AuthUser }> {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function logoutUser(): Promise<{ status: string }> {
  return request("/api/auth/logout", {
    method: "POST"
  });
}

export function updateAuthProfile(payload: { username: string; currentPassword: string; newPassword?: string }): Promise<{ user: AuthUser }> {
  return request("/api/auth/profile", {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function updateAuthAvatar(avatarUrl: string): Promise<{ user: AuthUser }> {
  return request("/api/auth/avatar", {
    method: "PUT",
    body: JSON.stringify({ avatarUrl })
  });
}

export function createBookmark(payload: { url: string; title?: string; category?: string; faviconUrl?: string; showOnHome?: boolean; source?: string }): Promise<{ status: string; bookmark: Bookmark }> {
  return request("/api/bookmarks", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateBookmark(id: string, payload: Partial<Pick<Bookmark, "pinned" | "showOnHome" | "archived" | "title" | "summary" | "category" | "url" | "faviconUrl">>): Promise<{ bookmark: Bookmark }> {
  return request(`/api/bookmarks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deleteBookmark(id: string): Promise<{ status: string }> {
  return request(`/api/bookmarks/${id}`, {
    method: "DELETE"
  });
}

export function listCategories(): Promise<{ categories: Category[] }> {
  return request("/api/categories");
}

export function createCategory(name: string): Promise<{ category: Category }> {
  return request("/api/categories", {
    method: "POST",
    body: JSON.stringify({ name })
  });
}

export function updateCategory(id: string, name: string): Promise<{ category: Category }> {
  return request(`/api/categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name })
  });
}

export function deleteCategory(id: string): Promise<{ status: string }> {
  return request(`/api/categories/${id}`, {
    method: "DELETE"
  });
}

export function reorderCategories(orderedIds: string[]): Promise<{ categories: Category[] }> {
  return request("/api/categories/reorder", {
    method: "POST",
    body: JSON.stringify({ orderedIds })
  });
}

export function sendAssistantMessage(message: string, activeCategory?: string, attachments?: AssistantAttachment[]): Promise<AssistantResponse> {
  return request("/api/assistant/chat", {
    method: "POST",
    body: JSON.stringify({ message, activeCategory, attachments })
  });
}

export function listAssistantConversations(): Promise<{ conversations: AssistantConversation[] }> {
  return request("/api/assistant/conversations");
}

export function createAssistantConversation(title?: string): Promise<{ conversation: AssistantConversation }> {
  return request("/api/assistant/conversations", {
    method: "POST",
    body: JSON.stringify({ title })
  });
}

export function getAssistantConversation(id: string): Promise<{ conversation: AssistantConversation; messages: AssistantMessage[] }> {
  return request(`/api/assistant/conversations/${id}`);
}

export function deleteAssistantConversations(ids: string[]): Promise<{ deleted: number }> {
  return request("/api/assistant/conversations/delete", {
    method: "POST",
    body: JSON.stringify({ ids })
  });
}

export async function streamAssistantMessage(
  payload: { conversationId?: string; message: string; activeCategory?: string; attachments?: AssistantAttachment[]; model?: string; effort?: string },
  handlers: {
    onMeta?: (data: { conversation: AssistantConversation }) => void;
    onReasoning?: (data: { text: string }) => void;
    onDelta?: (data: { text: string }) => void;
    onDone?: (data: AssistantResponse & { conversation?: AssistantConversation }) => void;
    onError?: (message: string) => void;
  }
) {
  const response = await fetch("/api/assistant/chat/stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok || !response.body) {
    const error = await response.json().catch(() => ({ message: "助手暂时不可用" }));
    throw new Error(error.message ?? "助手暂时不可用");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  function consumeEvent(rawEvent: string) {
    const eventName = rawEvent.split("\n").find((line) => line.startsWith("event:"))?.slice(6).trim();
    const dataText = rawEvent.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");

    if (!eventName || !dataText) {
      return;
    }

    const data = JSON.parse(dataText);

    if (eventName === "meta") {
      handlers.onMeta?.(data);
    } else if (eventName === "reasoning") {
      handlers.onReasoning?.(data);
    } else if (eventName === "delta") {
      handlers.onDelta?.(data);
    } else if (eventName === "done") {
      handlers.onDone?.(data);
    } else if (eventName === "error") {
      handlers.onError?.(data.message ?? "助手暂时不可用");
    }
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const event of events) {
      consumeEvent(event);
    }
  }

  if (buffer.trim()) {
    consumeEvent(buffer);
  }
}

export function getAiSettings(): Promise<{ settings: AiSettings }> {
  return request("/api/settings/ai");
}

export function saveAiSettings(payload: AiSettingsPayload): Promise<{ settings: AiSettings }> {
  return request("/api/settings/ai", {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function testAiConnection(payload: {
  provider: {
    id: string;
    name: string;
    apiFormat: "openai" | "anthropic";
    baseUrl: string;
    apiKey?: string;
    temperature: number;
  };
  model: {
    id: string;
    name: string;
    maxTokens: number;
  };
}): Promise<{ success: boolean; response: string }> {
  return request("/api/settings/ai/test", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function revealApiKey(providerId: string): Promise<{ providerId: string; apiKey: string }> {
  return request("/api/settings/ai/reveal", {
    method: "POST",
    body: JSON.stringify({ providerId })
  });
}

export function getWeatherSettings(): Promise<{ settings: any }> {
  return request("/api/settings/weather");
}

export function saveWeatherSettings(payload: any): Promise<{ settings: any }> {
  return request("/api/settings/weather", {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function getCurrentWeather(): Promise<any> {
  return request("/api/weather");
}

export function reorderAiProviders(orderedIds: string[]): Promise<{ settings: { activeProviderId: string; providers: AiProviderConfig[] } }> {
  return request("/api/settings/ai/reorder", {
    method: "POST",
    body: JSON.stringify({ orderedIds })
  });
}

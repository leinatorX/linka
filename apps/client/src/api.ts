import type { AssistantResponse, Bookmark } from "./types";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers
    },
    ...options
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

export function createBookmark(payload: { url: string; title?: string; source?: string }): Promise<{ status: string; bookmark: Bookmark }> {
  return request("/api/bookmarks", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateBookmark(id: string, payload: Partial<Pick<Bookmark, "pinned" | "archived" | "title" | "summary" | "category" | "tags">>): Promise<{ bookmark: Bookmark }> {
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

export function sendAssistantMessage(message: string): Promise<AssistantResponse> {
  return request("/api/assistant/chat", {
    method: "POST",
    body: JSON.stringify({ message })
  });
}

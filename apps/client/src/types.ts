export interface Bookmark {
  id: string;
  url: string;
  normalizedUrl: string;
  title: string;
  description: string;
  summary: string;
  domain: string;
  faviconUrl: string;
  coverImageUrl: string;
  category: string;
  pinned: boolean;
  showOnHome: boolean;
  archived: boolean;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface AssistantResponse {
  type: "bookmark_saved" | "search_results" | "message" | "tool_result";
  message: string;
  bookmark?: Bookmark;
  results?: Bookmark[];
  changed?: boolean;
  categoriesChanged?: boolean;
}

export interface AssistantConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssistantMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export type AiApiFormat = "openai" | "anthropic";

export interface AiModelConfig {
  id: string;
  name: string;
  maxTokens: number;
  enabled: boolean;
}

export interface AiProviderConfig {
  id: string;
  name: string;
  apiFormat: AiApiFormat;
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
  temperature: number;
  activeModelId: string;
  models: AiModelConfig[];
  apiKeySet: boolean;
  apiKeyPreview: string;
}

export interface AiSettings {
  activeProviderId: string;
  providers: AiProviderConfig[];
}

export type AiSettingsPayload = AiSettings;

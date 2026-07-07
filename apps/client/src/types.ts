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

export interface AuthUser {
  id: string;
  username: string;
  avatarUrl: string;
}

export interface AssistantResponse {
  type: "bookmark_saved" | "search_results" | "message" | "tool_result" | "web_context" | "confirmation_request";
  message: string;
  action?: string;
  bookmark?: Bookmark;
  results?: Bookmark[];
  changed?: boolean;
  categoriesChanged?: boolean;
}

export type AssistantAttachmentKind = "image" | "video" | "file";

export interface AssistantAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
  kind: AssistantAttachmentKind;
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
  attachments?: AssistantAttachment[];
  createdAt: string;
}

export type AiApiFormat = "openai" | "anthropic";

export interface AiModelConfig {
  id: string;
  name: string;
  maxTokens: number;
  enabled: boolean;
  supportsVision: boolean;
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
  aiLanguage: string;
  activeProviderId: string;
  providers: AiProviderConfig[];
}

export type AiSettingsPayload = AiSettings;

export interface WeatherSettings {
  enabled: boolean;
  apiKeySet?: boolean;
  apiKey?: string;
  location: string;
  showDate: boolean;
  dateFormat: string;
}

export type SearchEngine = "tavily" | "brave" | "searxng";

export interface WebSearchSettings {
  enabled: boolean;
  engine: SearchEngine;
  apiKeySet?: boolean;
  apiKey?: string;
  baseUrl: string;
  maxResults: number;
}

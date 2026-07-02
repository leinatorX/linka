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
  type: "bookmark_saved" | "search_results" | "message";
  message: string;
  bookmark?: Bookmark;
  results?: Bookmark[];
}

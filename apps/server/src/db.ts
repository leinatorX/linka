import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { config } from "./config.js";

export interface BookmarkRecord {
  id: string;
  url: string;
  normalized_url: string;
  title: string;
  description: string;
  summary: string;
  domain: string;
  favicon_url: string;
  cover_image_url: string;
  category: string;
  pinned: 0 | 1;
  show_on_home: 0 | 1;
  archived: 0 | 1;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface CategoryRecord {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface AssistantConversationRecord {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface AssistantMessageRecord {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

export const db = new Database(config.dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS bookmarks (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    normalized_url TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    domain TEXT NOT NULL DEFAULT '',
    favicon_url TEXT NOT NULL DEFAULT '',
    cover_image_url TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '未分类',
    pinned INTEGER NOT NULL DEFAULT 0,
    show_on_home INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'web',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON bookmarks(created_at);
  CREATE INDEX IF NOT EXISTS idx_bookmarks_category ON bookmarks(category);
  CREATE INDEX IF NOT EXISTS idx_bookmarks_archived ON bookmarks(archived);

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories(sort_order);

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS assistant_conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_assistant_conversations_updated_at ON assistant_conversations(updated_at);

  CREATE TABLE IF NOT EXISTS assistant_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(conversation_id) REFERENCES assistant_conversations(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_assistant_messages_conversation_id ON assistant_messages(conversation_id, created_at);
`);

const bookmarkColumns = db.prepare("PRAGMA table_info(bookmarks)").all() as Array<{ name: string }>;
const bookmarkColumnNames = new Set(bookmarkColumns.map((column) => column.name));
if (!bookmarkColumnNames.has("show_on_home")) {
  db.exec(`
    ALTER TABLE bookmarks ADD COLUMN show_on_home INTEGER NOT NULL DEFAULT 0;
  `);
}
db.exec("CREATE INDEX IF NOT EXISTS idx_bookmarks_show_on_home ON bookmarks(show_on_home)");

export function toBookmark(record: BookmarkRecord) {
  return {
    id: record.id,
    url: record.url,
    normalizedUrl: record.normalized_url,
    title: record.title,
    description: record.description,
    summary: record.summary,
    domain: record.domain,
    faviconUrl: record.favicon_url,
    coverImageUrl: record.cover_image_url,
    category: record.category,
    pinned: Boolean(record.pinned),
    showOnHome: Boolean(record.show_on_home),
    archived: Boolean(record.archived),
    source: record.source,
    createdAt: record.created_at,
    updatedAt: record.updated_at
  };
}

export function toAssistantConversation(record: AssistantConversationRecord) {
  return {
    id: record.id,
    title: record.title,
    createdAt: record.created_at,
    updatedAt: record.updated_at
  };
}

export function toAssistantMessage(record: AssistantMessageRecord) {
  return {
    id: record.id,
    conversationId: record.conversation_id,
    role: record.role,
    content: record.content,
    createdAt: record.created_at
  };
}

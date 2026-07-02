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
`);

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
    archived: Boolean(record.archived),
    source: record.source,
    createdAt: record.created_at,
    updatedAt: record.updated_at
  };
}

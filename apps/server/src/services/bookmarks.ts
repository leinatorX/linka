import crypto from "node:crypto";
import { db, type BookmarkRecord, toBookmark } from "../db.js";
import { classifyBookmark } from "./ai.js";
import { fetchPageMetadata } from "./metadata.js";
import { getDomain, normalizeUrl } from "../utils/url.js";

export interface BookmarkInput {
  url: string;
  title?: string;
  source?: string;
}

export interface BookmarkQuery {
  q?: string;
  category?: string;
  tag?: string;
  archived?: boolean;
}

const selectAll = db.prepare("SELECT * FROM bookmarks ORDER BY pinned DESC, created_at DESC");
const selectById = db.prepare("SELECT * FROM bookmarks WHERE id = ?");
const selectByNormalizedUrl = db.prepare("SELECT * FROM bookmarks WHERE normalized_url = ?");
const insertBookmark = db.prepare(`
  INSERT INTO bookmarks (
    id, url, normalized_url, title, description, summary, domain, favicon_url,
    cover_image_url, category, tags_json, pinned, archived, source, created_at, updated_at
  ) VALUES (
    @id, @url, @normalized_url, @title, @description, @summary, @domain, @favicon_url,
    @cover_image_url, @category, @tags_json, @pinned, @archived, @source, @created_at, @updated_at
  )
`);
const updateBookmarkRecord = db.prepare(`
  UPDATE bookmarks
  SET title = @title,
      summary = @summary,
      category = @category,
      tags_json = @tags_json,
      pinned = @pinned,
      archived = @archived,
      updated_at = @updated_at
  WHERE id = @id
`);
const deleteBookmarkRecord = db.prepare("DELETE FROM bookmarks WHERE id = ?");

export function listBookmarks(query: BookmarkQuery = {}) {
  let bookmarks = (selectAll.all() as BookmarkRecord[]).map(toBookmark);

  if (query.archived !== undefined) {
    bookmarks = bookmarks.filter((bookmark) => bookmark.archived === query.archived);
  } else {
    bookmarks = bookmarks.filter((bookmark) => !bookmark.archived);
  }

  if (query.category) {
    bookmarks = bookmarks.filter((bookmark) => bookmark.category === query.category);
  }

  if (query.tag) {
    bookmarks = bookmarks.filter((bookmark) => bookmark.tags.includes(query.tag as string));
  }

  if (query.q) {
    const keyword = query.q.toLowerCase();
    bookmarks = bookmarks.filter((bookmark) => {
      return [
        bookmark.title,
        bookmark.description,
        bookmark.summary,
        bookmark.domain,
        bookmark.category,
        bookmark.tags.join(" ")
      ].join(" ").toLowerCase().includes(keyword);
    });
  }

  return bookmarks;
}

export function getBookmarkById(id: string) {
  const record = selectById.get(id) as BookmarkRecord | undefined;
  return record ? toBookmark(record) : null;
}

export async function createBookmark(input: BookmarkInput) {
  const normalizedUrl = normalizeUrl(input.url);
  const existing = selectByNormalizedUrl.get(normalizedUrl) as BookmarkRecord | undefined;

  if (existing) {
    return { status: "exists", bookmark: toBookmark(existing) };
  }

  let metadata;
  try {
    metadata = await fetchPageMetadata(normalizedUrl);
  } catch {
    const domain = getDomain(normalizedUrl);
    metadata = {
      title: input.title || domain,
      description: "",
      faviconUrl: `https://www.google.com/s2/favicons?sz=64&domain=${domain}`,
      coverImageUrl: "",
      domain,
      textSample: ""
    };
  }

  const ai = await classifyBookmark({ ...metadata, title: input.title || metadata.title });
  const now = new Date().toISOString();
  const record: BookmarkRecord = {
    id: crypto.randomUUID(),
    url: input.url,
    normalized_url: normalizedUrl,
    title: ai.title || input.title || metadata.title,
    description: metadata.description,
    summary: ai.summary,
    domain: metadata.domain,
    favicon_url: metadata.faviconUrl,
    cover_image_url: metadata.coverImageUrl,
    category: ai.category,
    tags_json: JSON.stringify(ai.tags),
    pinned: 0,
    archived: 0,
    source: input.source || "web",
    created_at: now,
    updated_at: now
  };

  insertBookmark.run(record);
  return { status: "saved", bookmark: toBookmark(record) };
}

export function updateBookmark(id: string, patch: Record<string, unknown>) {
  const current = getBookmarkById(id);
  if (!current) {
    return null;
  }

  const next = {
    id,
    title: String(patch.title ?? current.title),
    summary: String(patch.summary ?? current.summary),
    category: String(patch.category ?? current.category),
    tags_json: JSON.stringify(Array.isArray(patch.tags) ? patch.tags.map(String) : current.tags),
    pinned: typeof patch.pinned === "boolean" ? Number(patch.pinned) : Number(current.pinned),
    archived: typeof patch.archived === "boolean" ? Number(patch.archived) : Number(current.archived),
    updated_at: new Date().toISOString()
  };

  updateBookmarkRecord.run(next);
  return getBookmarkById(id);
}

export function deleteBookmark(id: string) {
  return deleteBookmarkRecord.run(id).changes > 0;
}

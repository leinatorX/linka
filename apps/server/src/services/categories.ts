import crypto from "node:crypto";
import { db, type CategoryRecord } from "../db.js";

const DEFAULT_CATEGORY = "未分类";
const DEFAULT_CATEGORIES = ["AI 工具", "开发工具", "设计资源", DEFAULT_CATEGORY];

const selectCategories = db.prepare("SELECT * FROM categories ORDER BY sort_order ASC, created_at ASC");
const selectCategoryByName = db.prepare("SELECT * FROM categories WHERE name = ?");
const selectMaxSortOrder = db.prepare("SELECT COALESCE(MAX(sort_order), -1) AS value FROM categories");
const insertCategoryRecord = db.prepare(`
  INSERT INTO categories (id, name, slug, sort_order, created_at, updated_at)
  VALUES (@id, @name, @slug, @sort_order, @created_at, @updated_at)
`);
const updateCategoryRecord = db.prepare(`
  UPDATE categories
  SET name = @name,
      slug = @slug,
      updated_at = @updated_at
  WHERE id = @id
`);
const deleteCategoryRecord = db.prepare("DELETE FROM categories WHERE id = ?");
const reassignBookmarkCategory = db.prepare("UPDATE bookmarks SET category = ? WHERE category = ?");
const selectBookmarkCategories = db.prepare("SELECT DISTINCT category FROM bookmarks WHERE category IS NOT NULL AND category != ''");

function slugify(name: string): string {
  const normalized = name.trim().toLowerCase();
  const asciiSlug = normalized
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9\u4e00-\u9fa5-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return asciiSlug || `category-${crypto.randomUUID().slice(0, 8)}`;
}

function nextSortOrder(): number {
  const row = selectMaxSortOrder.get() as { value: number };
  return row.value + 1;
}

export function toCategory(record: CategoryRecord) {
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    sortOrder: record.sort_order,
    createdAt: record.created_at,
    updatedAt: record.updated_at
  };
}

export function listCategories() {
  return (selectCategories.all() as CategoryRecord[]).map(toCategory);
}

export function ensureCategory(name: string) {
  const normalizedName = name.trim() || DEFAULT_CATEGORY;
  const existing = selectCategoryByName.get(normalizedName) as CategoryRecord | undefined;
  if (existing) {
    return toCategory(existing);
  }

  const now = new Date().toISOString();
  const record: CategoryRecord = {
    id: crypto.randomUUID(),
    name: normalizedName,
    slug: slugify(normalizedName),
    sort_order: nextSortOrder(),
    created_at: now,
    updated_at: now
  };

  insertCategoryRecord.run(record);
  return toCategory(record);
}

export function createCategory(name: string) {
  return ensureCategory(name);
}

export function updateCategory(id: string, name: string) {
  const normalizedName = name.trim();
  if (!normalizedName) {
    return null;
  }

  const current = (selectCategories.all() as CategoryRecord[]).find((category) => category.id === id);
  if (!current || current.name === DEFAULT_CATEGORY) {
    return null;
  }

  const now = new Date().toISOString();
  updateCategoryRecord.run({
    id,
    name: normalizedName,
    slug: slugify(normalizedName),
    updated_at: now
  });
  reassignBookmarkCategory.run(normalizedName, current.name);

  const updated = selectCategoryByName.get(normalizedName) as CategoryRecord | undefined;
  return updated ? toCategory(updated) : null;
}

export function deleteCategory(id: string) {
  const current = (selectCategories.all() as CategoryRecord[]).find((category) => category.id === id);
  if (!current || current.name === DEFAULT_CATEGORY) {
    return false;
  }

  ensureCategory(DEFAULT_CATEGORY);
  reassignBookmarkCategory.run(DEFAULT_CATEGORY, current.name);
  return deleteCategoryRecord.run(id).changes > 0;
}

export function getCategoryNames() {
  return listCategories().map((category) => category.name);
}

export function normalizeCategoryName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    return DEFAULT_CATEGORY;
  }

  const names = new Set(getCategoryNames());
  return names.has(trimmed) ? trimmed : DEFAULT_CATEGORY;
}

export function initializeCategories() {
  for (const name of DEFAULT_CATEGORIES) {
    ensureCategory(name);
  }

  const rows = selectBookmarkCategories.all() as Array<{ category: string }>;
  for (const row of rows) {
    ensureCategory(row.category);
  }
}

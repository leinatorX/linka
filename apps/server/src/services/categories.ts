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
const updateCategorySortOrder = db.prepare("UPDATE categories SET sort_order = ?, updated_at = ? WHERE id = ?");

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

// 批量重排分类：按 orderedIds 数组顺序依次分配 sort_order = 0, 1, 2...
// 一次事务保证原子性；orderedIds 中找不到的 id 静默跳过（已被删除/不属于当前集合）。
// 不在 orderedIds 中的分类按"末尾补齐"处理：保留其相对位置。
export function reorderCategories(orderedIds: string[]) {
  const all = selectCategories.all() as CategoryRecord[];
  const allById = new Map(all.map((category) => [category.id, category]));
  const known = new Set(all.map((category) => category.id));

  // 过滤掉无效 id，保留首次出现的相对顺序
  const ids = orderedIds.filter((id, index) => known.has(id) && orderedIds.indexOf(id) === index);
  const headIds = new Set(ids);
  const tailIds = all.map((category) => category.id).filter((id) => !headIds.has(id));

  const now = new Date().toISOString();
  const finalOrder = [...ids, ...tailIds];

  const transaction = db.transaction((order: string[]) => {
    order.forEach((id, index) => {
      const record = allById.get(id);
      if (!record) {
        return;
      }
      updateCategorySortOrder.run(index, now, id);
    });
  });

  transaction(finalOrder);
  return listCategories();
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

import type { Ref } from "vue";
import { ref } from "vue";
import { createCategory, deleteCategory, listCategories, reorderCategories as apiReorderCategories, updateCategory } from "../api";
import type { Category } from "../types";

interface UseCategoriesOptions {
  selectedCategory: Ref<string>;
  loadBookmarks: () => Promise<void>;
}

export function useCategories(options: UseCategoriesOptions) {
  const categories = ref<Category[]>([]);
  const editingCategoryNames = ref<Record<string, string>>({});
  const newCategoryName = ref("");

  async function loadCategories() {
    const result = await listCategories();
    categories.value = result.categories;
    editingCategoryNames.value = Object.fromEntries(result.categories.map((category) => [category.id, category.name]));
  }

  async function addCategory() {
    const name = newCategoryName.value.trim();
    if (!name) {
      return;
    }

    await createCategory(name);
    newCategoryName.value = "";
    await loadCategories();
  }

  async function saveCategory(category: Category) {
    const name = editingCategoryNames.value[category.id]?.trim();
    if (!name || name === category.name) {
      return;
    }

    await updateCategory(category.id, name);
    if (options.selectedCategory.value === category.name) {
      options.selectedCategory.value = name;
    }
    await loadCategories();
    await options.loadBookmarks();
  }

  async function removeCategory(category: Category) {
    await deleteCategory(category.id);
    if (options.selectedCategory.value === category.name) {
      options.selectedCategory.value = "首页";
    }
    await loadCategories();
    await options.loadBookmarks();
  }

  // 拖拽重排：乐观更新本地状态，失败时回滚并重新拉取。
  async function reorderCategories(orderedIds: string[]) {
    const previous = categories.value.slice();
    const byId = new Map(previous.map((category) => [category.id, category]));
    const next = orderedIds
      .map((id) => byId.get(id))
      .filter((category): category is Category => Boolean(category));
    if (next.length !== orderedIds.length) {
      // 客户端与服务端集合不一致时拒绝发送，避免脏数据。
      return false;
    }
    categories.value = next;
    try {
      const result = await apiReorderCategories(orderedIds);
      categories.value = result.categories;
      // 保留未在编辑中的名称输入
      editingCategoryNames.value = Object.fromEntries(result.categories.map((category) => [category.id, category.name]));
      return true;
    } catch (error) {
      // 回滚本地状态
      categories.value = previous;
      throw error;
    }
  }

  return {
    categories,
    editingCategoryNames,
    newCategoryName,
    loadCategories,
    addCategory,
    saveCategory,
    removeCategory,
    reorderCategories
  };
}

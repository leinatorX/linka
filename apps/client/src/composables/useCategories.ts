import type { Ref } from "vue";
import { ref } from "vue";
import { createCategory, deleteCategory, listCategories, updateCategory } from "../api";
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
      options.selectedCategory.value = "全部";
    }
    await loadCategories();
    await options.loadBookmarks();
  }

  return {
    categories,
    editingCategoryNames,
    newCategoryName,
    loadCategories,
    addCategory,
    saveCategory,
    removeCategory
  };
}

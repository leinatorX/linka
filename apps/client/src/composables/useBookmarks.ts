import { computed, ref } from "vue";
import { createBookmark, deleteBookmark, listBookmarks, updateBookmark } from "../api";
import type { Bookmark, Category } from "../types";

interface UseBookmarksOptions {
  onAssistantNotice?: (message: string) => void;
  loadAllBookmarks?: () => boolean;
}

interface LoadBookmarksOptions {
  all?: boolean;
}

export function useBookmarks(options: UseBookmarksOptions = {}) {
  const bookmarks = ref<Bookmark[]>([]);
  const urlInput = ref("");
  const searchInput = ref("");
  const selectedCategory = ref("首页");
  const showArchived = ref(false);
  const showAddBookmarkModal = ref(false);
  const settingsBookmarkUrl = ref("");
  const settingsBookmarkTitle = ref("");
  const settingsBookmarkCategory = ref("");
  const settingsBookmarkFaviconUrl = ref("");
  const settingsBookmarkShowOnHome = ref(false);
  const settingsMessage = ref("");
  const isLoading = ref(false);
  const isSettingsSaving = ref(false);
  const errorMessage = ref("");
  const editingBookmarkId = ref<string | null>(null);
  const editBookmarkData = ref({
    title: "",
    url: "",
    faviconUrl: "",
    category: "",
    showOnHome: false
  });
  const failedIconIds = ref<Set<string>>(new Set());
  const visibleBookmarks = computed(() => bookmarks.value);

  function getFallbackIconText(bookmark: Bookmark) {
    return (bookmark.domain || bookmark.title || "?").slice(0, 1).toUpperCase();
  }

  function markIconFailed(bookmarkId: string) {
    failedIconIds.value = new Set([...failedIconIds.value, bookmarkId]);
  }

  async function loadBookmarks(loadOptions: LoadBookmarksOptions = {}) {
    const params = new URLSearchParams();
    if (searchInput.value.trim()) {
      params.set("q", searchInput.value.trim());
    }
    if (!(loadOptions.all ?? options.loadAllBookmarks?.() ?? false)) {
      if (selectedCategory.value === "首页") {
        params.set("home", "true");
      } else {
        params.set("category", selectedCategory.value);
      }
    }
    if (showArchived.value) {
      params.set("archived", "true");
    }

    const result = await listBookmarks(params);
    bookmarks.value = result.bookmarks;
  }

  async function addBookmark() {
    const url = urlInput.value.trim();
    if (!url) {
      return;
    }

    isLoading.value = true;
    errorMessage.value = "";

    try {
      const result = await createBookmark({ url, source: "web" });
      urlInput.value = "";
      await loadBookmarks();
      options.onAssistantNotice?.(
        result.status === "exists" ? "这个链接已经收藏过了。" : `已收藏「${result.bookmark.title}」，归类到「${result.bookmark.category}」。`
      );
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : "添加失败";
    } finally {
      isLoading.value = false;
    }
  }

  async function addBookmarkFromSettings() {
    const url = settingsBookmarkUrl.value.trim();
    if (!url) {
      settingsMessage.value = "请输入要收藏的网页链接。";
      return;
    }

    isSettingsSaving.value = true;
    settingsMessage.value = "";

    try {
      const result = await createBookmark({
        url,
        title: settingsBookmarkTitle.value.trim() || undefined,
        category: settingsBookmarkCategory.value || undefined,
        faviconUrl: settingsBookmarkFaviconUrl.value.trim() || undefined,
        showOnHome: settingsBookmarkShowOnHome.value,
        source: "settings"
      });
      settingsBookmarkUrl.value = "";
      settingsBookmarkTitle.value = "";
      settingsBookmarkCategory.value = "";
      settingsBookmarkFaviconUrl.value = "";
      settingsBookmarkShowOnHome.value = false;
      settingsMessage.value = result.status === "exists" ? "这个链接已经收藏过了。" : `已添加，并归类到「${result.bookmark.category}」。`;
      await loadBookmarks();
      if (result.status !== "exists") {
        showAddBookmarkModal.value = false;
      }
    } catch (error) {
      settingsMessage.value = error instanceof Error ? error.message : "添加失败";
    } finally {
      isSettingsSaving.value = false;
    }
  }

  async function togglePinned(bookmark: Bookmark) {
    await updateBookmark(bookmark.id, { pinned: !bookmark.pinned });
    await loadBookmarks();
  }

  async function toggleArchived(bookmark: Bookmark) {
    await updateBookmark(bookmark.id, { archived: !showArchived.value });
    await loadBookmarks();
  }

  async function removeBookmark(bookmark: Bookmark) {
    await deleteBookmark(bookmark.id);
    await loadBookmarks();
  }

  function startEditingBookmark(bookmark: Bookmark) {
    editingBookmarkId.value = bookmark.id;
    editBookmarkData.value = {
      title: bookmark.title,
      url: bookmark.url,
      faviconUrl: bookmark.faviconUrl || "",
      category: bookmark.category || "",
      showOnHome: bookmark.showOnHome
    };
  }

  async function saveEditedBookmark() {
    if (!editingBookmarkId.value) return;
    await updateBookmark(editingBookmarkId.value, {
      title: editBookmarkData.value.title.trim() || undefined,
      url: editBookmarkData.value.url.trim() || undefined,
      faviconUrl: editBookmarkData.value.faviconUrl.trim() || undefined,
      category: editBookmarkData.value.category || undefined,
      showOnHome: editBookmarkData.value.showOnHome
    });
    editingBookmarkId.value = null;
    await loadBookmarks();
  }

  function setCategory(category: string) {
    selectedCategory.value = category;
    loadBookmarks();
  }

  function search() {
    loadBookmarks();
  }

  function toggleArchivedView() {
    showArchived.value = !showArchived.value;
    loadBookmarks();
  }

  function categoryOptions(categories: Category[]) {
    return categories.map((category) => category.name);
  }

  return {
    bookmarks,
    urlInput,
    searchInput,
    selectedCategory,
    showArchived,
    showAddBookmarkModal,
    settingsBookmarkUrl,
    settingsBookmarkTitle,
    settingsBookmarkCategory,
    settingsBookmarkFaviconUrl,
    settingsBookmarkShowOnHome,
    settingsMessage,
    isLoading,
    isSettingsSaving,
    errorMessage,
    editingBookmarkId,
    editBookmarkData,
    failedIconIds,
    visibleBookmarks,
    getFallbackIconText,
    markIconFailed,
    loadBookmarks,
    addBookmark,
    addBookmarkFromSettings,
    togglePinned,
    toggleArchived,
    removeBookmark,
    startEditingBookmark,
    saveEditedBookmark,
    setCategory,
    search,
    toggleArchivedView,
    categoryOptions
  };
}

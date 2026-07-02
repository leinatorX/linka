<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { 
  Archive, ChevronDown, ExternalLink, Link2, Loader2, 
  Pin, Plus, Search, Send, Settings, Trash2, X, Bot, Edit2, List
} from "@lucide/vue";
import { createBookmark, createCategory, deleteBookmark, deleteCategory, listBookmarks, listCategories, sendAssistantMessage, updateBookmark, updateCategory } from "./api";
import type { AssistantResponse, Bookmark, Category } from "./types";

const bookmarks = ref<Bookmark[]>([]);
const urlInput = ref("");
const searchInput = ref("");
const selectedCategory = ref("全部");
const showArchived = ref(false);
const assistantInput = ref("");
const assistantOpen = ref(false);
const settingsTab = ref<"categories" | "manage_bookmarks">("manage_bookmarks");
const showAddBookmarkModal = ref(false);
const newCategoryName = ref("");
const settingsBookmarkUrl = ref("");
const settingsBookmarkTitle = ref("");
const settingsBookmarkCategory = ref("");
const settingsMessage = ref("");
const isSettingsSaving = ref(false);
const editingCategoryNames = ref<Record<string, string>>({});
const editingBookmarkId = ref<string | null>(null);
const editBookmarkData = ref({
  title: "",
  url: "",
  faviconUrl: "",
  category: ""
});

function startEditingBookmark(bookmark: Bookmark) {
  editingBookmarkId.value = bookmark.id;
  editBookmarkData.value = {
    title: bookmark.title,
    url: bookmark.url,
    faviconUrl: bookmark.faviconUrl || "",
    category: bookmark.category || ""
  };
}

async function saveEditedBookmark() {
  if (!editingBookmarkId.value) return;
  await updateBookmark(editingBookmarkId.value, {
    title: editBookmarkData.value.title.trim() || undefined,
    url: editBookmarkData.value.url.trim() || undefined,
    faviconUrl: editBookmarkData.value.faviconUrl.trim() || undefined,
    category: editBookmarkData.value.category || undefined
  });
  editingBookmarkId.value = null;
  await loadBookmarks();
}

const failedIconIds = ref<Set<string>>(new Set());
const assistantMessages = ref<Array<{ role: "user" | "assistant"; text: string; results?: Bookmark[] }>>([
  {
    role: "assistant",
    text: "把链接发给我，我会帮你收藏、摘要和归档。也可以直接问我之前收藏过什么。"
  }
]);
const isLoading = ref(false);
const isAssistantLoading = ref(false);
const errorMessage = ref("");
const route = useRoute();
const router = useRouter();

const categories = ref<Category[]>([]);
const visibleBookmarks = computed(() => bookmarks.value);
const isSettingsPage = computed(() => route.path === "/settings");

function getFallbackIconText(bookmark: Bookmark) {
  return (bookmark.domain || bookmark.title || "?").slice(0, 1).toUpperCase();
}

function markIconFailed(bookmarkId: string) {
  failedIconIds.value = new Set([...failedIconIds.value, bookmarkId]);
}

async function loadCategories() {
  const result = await listCategories();
  categories.value = result.categories;
  editingCategoryNames.value = Object.fromEntries(result.categories.map((category) => [category.id, category.name]));
}

async function loadBookmarks() {
  const params = new URLSearchParams();
  if (searchInput.value.trim()) {
    params.set("q", searchInput.value.trim());
  }
  if (selectedCategory.value !== "全部") {
    params.set("category", selectedCategory.value);
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
    assistantMessages.value.unshift({
      role: "assistant",
      text: result.status === "exists" ? "这个链接已经收藏过了。" : `已收藏「${result.bookmark.title}」，归类到「${result.bookmark.category}」。`
    });
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
      source: "settings"
    });
    settingsBookmarkUrl.value = "";
    settingsBookmarkTitle.value = "";
    settingsBookmarkCategory.value = "";
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

async function askAssistant() {
  const message = assistantInput.value.trim();
  if (!message) {
    return;
  }

  assistantMessages.value.unshift({ role: "user", text: message });
  assistantInput.value = "";
  assistantOpen.value = true;
  isAssistantLoading.value = true;

  try {
    const response: AssistantResponse = await sendAssistantMessage(message);
    assistantMessages.value.unshift({
      role: "assistant",
      text: response.message,
      results: response.results ?? (response.bookmark ? [response.bookmark] : undefined)
    });
    if (response.type === "bookmark_saved") {
      await loadBookmarks();
    }
  } catch (error) {
    assistantMessages.value.unshift({
      role: "assistant",
      text: error instanceof Error ? error.message : "助手暂时不可用"
    });
  } finally {
    isAssistantLoading.value = false;
  }
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

function openSettings() {
  router.push("/settings");
}

function closeSettings() {
  router.push("/");
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
  if (selectedCategory.value === category.name) {
    selectedCategory.value = name;
  }
  await loadCategories();
  await loadBookmarks();
}

async function removeCategory(category: Category) {
  await deleteCategory(category.id);
  if (selectedCategory.value === category.name) {
    selectedCategory.value = "全部";
  }
  await loadCategories();
  await loadBookmarks();
}

onMounted(() => {
  loadCategories();
  loadBookmarks();
});
</script>

<template>
  <main class="app-shell" :class="{ 'settings-route': isSettingsPage }">
    <header class="topbar">
      <a class="brand" href="/" aria-label="Linka 首页">
        <div class="brand-icon">
          <Link2 :size="24" :stroke-width="2.5" />
        </div>
        <div class="brand-text">
          <strong>Linka</strong>
          <span>AI Bookmarks</span>
        </div>
      </a>

      <div class="global-search">
        <Search :size="18" />
        <input v-model="searchInput" placeholder="搜索书签或向 AI 提问..." @keyup.enter="search" />
      </div>

      <div class="top-actions">
        <button class="top-icon" :class="{ active: showArchived }" :title="showArchived ? '查看当前书签' : '查看归档'" @click="toggleArchivedView">
          <Archive :size="20" />
        </button>
        <button class="top-icon" :class="{ active: isSettingsPage }" title="设置" @click="openSettings">
          <Settings :size="20" />
        </button>
        <button class="user-pill" title="当前用户">
          <span>Hongli</span>
          <ChevronDown :size="16" />
        </button>
      </div>
    </header>



    <template v-if="!isSettingsPage">
    <nav class="filter-rail" aria-label="收藏筛选">
      <div class="filter-group">
        <span class="filter-label">分类</span>
        <button
          class="filter-btn"
          :class="{ active: selectedCategory === '全部' }"
          @click="setCategory('全部')"
        >
          全部
        </button>
        <button
          v-for="category in categories"
          :key="category.id"
          class="filter-btn"
          :class="{ active: selectedCategory === category.name }"
          @click="setCategory(category.name)"
        >
          {{ category.name }}
        </button>
      </div>


    </nav>

    <section class="library">
      <transition-group name="fade" tag="div" class="card-grid" v-if="visibleBookmarks.length">
        <article v-for="bookmark in visibleBookmarks" :key="bookmark.id" class="bookmark-card">
          <div class="card-header">
            <div class="site-icon" :style="{ backgroundImage: bookmark.coverImageUrl ? `url(${bookmark.coverImageUrl})` : '' }">
              <img v-if="bookmark.faviconUrl && !failedIconIds.has(bookmark.id)" :src="bookmark.faviconUrl" alt="" @error="markIconFailed(bookmark.id)" />
              <span v-else>{{ getFallbackIconText(bookmark) }}</span>
            </div>
            <div class="card-title-wrap">
              <h2>{{ bookmark.title }}</h2>
              <div class="domain-line">
                <span>{{ bookmark.domain }}</span>
                <span v-if="bookmark.category" class="category-badge">{{ bookmark.category }}</span>
              </div>
            </div>
          </div>

          <p class="card-summary">{{ bookmark.summary || bookmark.description || "暂无摘要" }}</p>



          <div class="card-actions-overlay">
            <a class="icon-action" :href="bookmark.url" target="_blank" rel="noreferrer" title="打开链接">
              <ExternalLink :size="16" />
            </a>
            <button class="icon-action secondary-action" :class="{ selected: bookmark.pinned }" title="置顶" @click="togglePinned(bookmark)">
              <Pin :size="16" />
            </button>
            <button class="icon-action secondary-action" :title="showArchived ? '恢复' : '归档'" @click="toggleArchived(bookmark)">
              <Archive :size="16" />
            </button>
            <button class="icon-action secondary-action danger" title="删除" @click="removeBookmark(bookmark)">
              <Trash2 :size="16" />
            </button>
          </div>
        </article>
      </transition-group>

      <div v-else class="empty-state">
        <Bot :size="48" color="var(--text-tertiary)" style="margin-bottom: 16px" />
        <h2>你的数字大脑空空如也</h2>
        <p>在上方粘贴链接开始收集，AI 会为你搞定剩下的一切。</p>
      </div>
    </section>
    </template>

    <section v-else class="settings-page" aria-label="Linka 设置">
        <div class="settings-card">
          <header class="settings-header">
            <div>
              <h2>设置</h2>
              <p>管理收藏入口和分类目录</p>
            </div>
            <button class="btn-close" title="返回首页" @click="closeSettings">
              <X :size="20" />
            </button>
          </header>

          <div class="settings-body">
            <nav class="settings-nav" aria-label="设置选项">
              <button :class="{ active: settingsTab === 'categories' }" @click="settingsTab = 'categories'">
                <Settings :size="18" />
                <span>分类管理</span>
              </button>
              <button :class="{ active: settingsTab === 'manage_bookmarks' }" @click="settingsTab = 'manage_bookmarks'">
                <List :size="18" />
                <span>书签管理</span>
              </button>
            </nav>

            <section v-if="settingsTab === 'categories'" class="settings-section">
              <div class="section-title">
                <h3>分类管理</h3>
                <p>AI 会优先从这些分类中选择。删除分类后，相关书签会归入“未分类”。</p>
              </div>

              <div class="category-create">
                <input v-model="newCategoryName" placeholder="新分类名称" @keyup.enter="addCategory" />
                <button class="btn-primary compact" @click="addCategory">添加</button>
              </div>

              <div class="category-list">
                <div v-for="category in categories" :key="category.id" class="category-item">
                  <input v-model="editingCategoryNames[category.id]" :disabled="category.name === '未分类'" @keyup.enter="saveCategory(category)" />
                  <button class="mini-button" :disabled="category.name === '未分类'" @click="saveCategory(category)">保存</button>
                  <button class="mini-button danger" :disabled="category.name === '未分类'" @click="removeCategory(category)">删除</button>
                </div>
              </div>
            </section>

            <section v-else-if="settingsTab === 'manage_bookmarks'" class="settings-section">
              <div class="section-title" style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                  <h3>书签管理</h3>
                  <p>在此修改已收藏书签的名称、地址、图标和分类。</p>
                </div>
                <button class="btn-primary" @click="showAddBookmarkModal = true">
                  <Plus :size="16" style="margin-right: 6px;" /> 添加书签
                </button>
              </div>

              <div class="bookmark-manage-list">
                <div v-for="bookmark in bookmarks" :key="bookmark.id" class="bookmark-manage-item">
                  <template v-if="editingBookmarkId === bookmark.id">
                    <div class="bookmark-manage-edit-form">
                      <label><span>标题</span><input v-model="editBookmarkData.title" /></label>
                      <label><span>链接</span><input v-model="editBookmarkData.url" /></label>
                      <label><span>图标链接</span><input v-model="editBookmarkData.faviconUrl" placeholder="https://..." /></label>
                      <label>
                        <span>分类</span>
                        <select v-model="editBookmarkData.category">
                          <option value="全部">全部 / 未分类</option>
                          <option v-for="category in categories" :key="category.id" :value="category.name">
                            {{ category.name }}
                          </option>
                        </select>
                      </label>
                      <div class="bookmark-manage-actions">
                        <button class="mini-button" @click="editingBookmarkId = null">取消</button>
                        <button class="mini-button highlight" @click="saveEditedBookmark">保存</button>
                      </div>
                    </div>
                  </template>
                  <template v-else>
                    <div class="bookmark-manage-info">
                      <img v-if="bookmark.faviconUrl" :src="bookmark.faviconUrl" alt="" class="bookmark-manage-icon" />
                      <div v-else class="bookmark-manage-icon-placeholder"><Link2 :size="16" /></div>
                      <div class="bookmark-manage-texts">
                        <h4>{{ bookmark.title || bookmark.domain }}</h4>
                        <p>{{ bookmark.url }}</p>
                      </div>
                      <span class="bookmark-manage-category" v-if="bookmark.category">{{ bookmark.category }}</span>
                    </div>
                    <button class="mini-button" @click="startEditingBookmark(bookmark)">
                      <Edit2 :size="14" style="margin-right:4px;" /> 编辑
                    </button>
                  </template>
                </div>
              </div>
            </section>
          </div>
        </div>

        <!-- Add Bookmark Modal -->
        <transition name="fade">
          <div class="modal-overlay" v-if="showAddBookmarkModal" @click.self="showAddBookmarkModal = false">
            <div class="modal-card">
              <header class="modal-header">
                <h3>添加书签</h3>
                <button class="btn-close" @click="showAddBookmarkModal = false"><X :size="20" /></button>
              </header>
              <div class="modal-body settings-form">
                <label>
                  <span>网页链接</span>
                  <input v-model="settingsBookmarkUrl" placeholder="https://example.com" @keyup.enter="addBookmarkFromSettings" />
                </label>
                <label>
                  <span>标题</span>
                  <input v-model="settingsBookmarkTitle" placeholder="可选，不填则自动抓取" @keyup.enter="addBookmarkFromSettings" />
                </label>
                <label>
                  <span>分类</span>
                  <select v-model="settingsBookmarkCategory">
                    <option value="">AI 自动选择</option>
                    <option v-for="category in categories" :key="category.id" :value="category.name">
                      {{ category.name }}
                    </option>
                  </select>
                </label>
                <button class="btn-primary settings-submit" style="margin-top: 16px;" :disabled="isSettingsSaving" @click="addBookmarkFromSettings">
                  <Loader2 v-if="isSettingsSaving" class="spin" :size="18" />
                  <Plus v-else :size="18" />
                  <span>添加到 Linka</span>
                </button>
                <p v-if="settingsMessage" class="settings-message">{{ settingsMessage }}</p>
              </div>
            </div>
          </div>
        </transition>
    </section>

    <!-- AI Assistant -->
    <button class="assistant-fab" title="唤起 AI 助手" @click="assistantOpen = true" v-show="!assistantOpen && !isSettingsPage">
      <Bot />
    </button>

    <transition name="fade">
      <aside v-if="assistantOpen && !isSettingsPage" class="assistant-panel">
        <div class="assistant-header">
          <div class="brand-icon" style="width: 36px; height: 36px; border-radius: 10px;">
            <Bot :size="20" />
          </div>
          <div class="assistant-header-text">
            <h2>AI 助手</h2>
            <p>随时为你整理和检索</p>
          </div>
          <button class="btn-close" title="关闭" @click="assistantOpen = false">
            <X :size="20" />
          </button>
        </div>

        <div class="message-list">
          <div v-for="(message, index) in assistantMessages" :key="index" class="message" :class="message.role">
            <p>{{ message.text }}</p>
            <div v-if="message.results?.length" class="result-list">
              <a v-for="result in message.results" :key="result.id" :href="result.url" target="_blank" rel="noreferrer">
                {{ result.title }}
                <span>{{ result.category }}</span>
              </a>
            </div>
          </div>
        </div>

        <div class="assistant-input-area">
          <textarea v-model="assistantInput" placeholder="输入你想收藏的链接，或问我任何问题..." @keydown.ctrl.enter.prevent="askAssistant"></textarea>
          <button class="btn-send" title="发送 (Ctrl+Enter)" :disabled="isAssistantLoading" @click="askAssistant">
            <Loader2 v-if="isAssistantLoading" class="spin" :size="20" />
            <Send v-else :size="20" />
          </button>
        </div>
      </aside>
    </transition>
  </main>
</template>

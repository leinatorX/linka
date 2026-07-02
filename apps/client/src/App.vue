<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { 
  Archive, Bell, ChevronDown, ExternalLink, Link2, Loader2, 
  MoreVertical, Pin, Plus, Search, Send, Settings, Trash2, X,
  ArrowRight, Bot
} from "@lucide/vue";
import { createBookmark, deleteBookmark, listBookmarks, sendAssistantMessage, updateBookmark } from "./api";
import type { AssistantResponse, Bookmark } from "./types";

const bookmarks = ref<Bookmark[]>([]);
const urlInput = ref("");
const searchInput = ref("");
const selectedCategory = ref("全部");
const selectedTag = ref("全部");
const assistantInput = ref("");
const assistantOpen = ref(false);
const assistantMessages = ref<Array<{ role: "user" | "assistant"; text: string; results?: Bookmark[] }>>([
  {
    role: "assistant",
    text: "把链接发给我，我会帮你收藏、摘要和归档。也可以直接问我之前收藏过什么。"
  }
]);
const isLoading = ref(false);
const isAssistantLoading = ref(false);
const errorMessage = ref("");

const categories = ref<string[]>(["全部"]);
const visibleBookmarks = computed(() => bookmarks.value);

async function loadBookmarks() {
  const params = new URLSearchParams();
  if (searchInput.value.trim()) {
    params.set("q", searchInput.value.trim());
  }
  if (selectedCategory.value !== "全部") {
    params.set("category", selectedCategory.value);
  }
  if (selectedTag.value !== "全部") {
    params.set("tag", selectedTag.value);
  }

  const result = await listBookmarks(params);
  bookmarks.value = result.bookmarks;
  
  if (selectedCategory.value === "全部" && !searchInput.value.trim()) {
    const cats = new Set(result.bookmarks.map((b) => b.category).filter(Boolean));
    categories.value = ["全部", ...Array.from(cats) as string[]];
  }
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

async function togglePinned(bookmark: Bookmark) {
  await updateBookmark(bookmark.id, { pinned: !bookmark.pinned });
  await loadBookmarks();
}

async function archiveBookmark(bookmark: Bookmark) {
  await updateBookmark(bookmark.id, { archived: true });
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

function setTag(tag: string) {
  selectedTag.value = tag;
  loadBookmarks();
}

function search() {
  loadBookmarks();
}

onMounted(() => {
  loadBookmarks();
});
</script>

<template>
  <main class="app-shell">
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
        <button class="top-icon" title="通知">
          <Bell :size="20" />
        </button>
        <button class="top-icon" title="设置">
          <Settings :size="20" />
        </button>
        <button class="user-pill" title="当前用户">
          <span>Hongli</span>
          <ChevronDown :size="16" />
        </button>
      </div>
    </header>



    <nav class="filter-rail" aria-label="收藏筛选">
      <div class="filter-group">
        <span class="filter-label">分类</span>
        <button
          v-for="category in categories"
          :key="category"
          class="filter-btn"
          :class="{ active: selectedCategory === category }"
          @click="setCategory(category)"
        >
          {{ category }}
        </button>
      </div>


    </nav>

    <section class="library">
      <transition-group name="fade" tag="div" class="card-grid" v-if="visibleBookmarks.length">
        <article v-for="bookmark in visibleBookmarks" :key="bookmark.id" class="bookmark-card">
          <div class="card-header">
            <div class="site-icon" :style="{ backgroundImage: bookmark.coverImageUrl ? `url(${bookmark.coverImageUrl})` : '' }">
              <img v-if="bookmark.faviconUrl" :src="bookmark.faviconUrl" alt="" />
              <span v-else>{{ bookmark.domain.slice(0, 1).toUpperCase() }}</span>
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
            <button class="icon-action" :class="{ selected: bookmark.pinned }" title="置顶" @click="togglePinned(bookmark)">
              <Pin :size="16" />
            </button>
            <button class="icon-action" title="归档" @click="archiveBookmark(bookmark)">
              <Archive :size="16" />
            </button>
            <button class="icon-action danger" title="删除" @click="removeBookmark(bookmark)">
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

    <!-- AI Assistant -->
    <button class="assistant-fab" title="唤起 AI 助手" @click="assistantOpen = true" v-show="!assistantOpen">
      <Bot />
    </button>

    <transition name="fade">
      <aside v-if="assistantOpen" class="assistant-panel">
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

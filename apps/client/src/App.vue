<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Archive, Bot, ExternalLink, Loader2, Pin, Plus, Search, Send, Trash2 } from "@lucide/vue";
import { createBookmark, deleteBookmark, listBookmarks, sendAssistantMessage, updateBookmark } from "./api";
import type { AssistantResponse, Bookmark } from "./types";

const bookmarks = ref<Bookmark[]>([]);
const urlInput = ref("");
const searchInput = ref("");
const selectedCategory = ref("全部");
const selectedTag = ref("全部");
const assistantInput = ref("");
const assistantMessages = ref<Array<{ role: "user" | "assistant"; text: string; results?: Bookmark[] }>>([
  {
    role: "assistant",
    text: "把链接发给我，我会帮你收藏、摘要和归档。也可以直接问我之前收藏过什么。"
  }
]);
const isLoading = ref(false);
const isAssistantLoading = ref(false);
const errorMessage = ref("");

const categories = computed(() => ["全部", ...new Set(bookmarks.value.map((bookmark) => bookmark.category).filter(Boolean))]);
const tags = computed(() => ["全部", ...new Set(bookmarks.value.flatMap((bookmark) => bookmark.tags))]);
const visibleBookmarks = computed(() => bookmarks.value);
const totalTags = computed(() => new Set(bookmarks.value.flatMap((bookmark) => bookmark.tags)).size);

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
  <main class="shell">
    <section class="hero">
      <div class="brand-block">
        <div class="brand-mark">L</div>
        <div>
          <p class="eyebrow">Save it. Let AI organize it.</p>
          <h1>Linka</h1>
        </div>
      </div>

      <div class="quick-add" @submit.prevent>
        <label for="url-input">快速收藏</label>
        <div class="input-row">
          <input
            id="url-input"
            v-model="urlInput"
            type="url"
            placeholder="粘贴一个网页链接"
            @keyup.enter="addBookmark"
          />
          <button class="icon-button primary" title="添加收藏" :disabled="isLoading" @click="addBookmark">
            <Loader2 v-if="isLoading" class="spin" :size="18" />
            <Plus v-else :size="18" />
          </button>
        </div>
        <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>
      </div>
    </section>

    <section class="workspace">
      <aside class="sidebar">
        <div class="stat-grid">
          <div>
            <strong>{{ bookmarks.length }}</strong>
            <span>收藏</span>
          </div>
          <div>
            <strong>{{ categories.length - 1 }}</strong>
            <span>分类</span>
          </div>
          <div>
            <strong>{{ totalTags }}</strong>
            <span>标签</span>
          </div>
        </div>

        <div class="filter-block">
          <h2>分类</h2>
          <button
            v-for="category in categories"
            :key="category"
            :class="{ active: selectedCategory === category }"
            @click="setCategory(category)"
          >
            {{ category }}
          </button>
        </div>

        <div class="filter-block">
          <h2>标签</h2>
          <button
            v-for="tag in tags"
            :key="tag"
            :class="{ active: selectedTag === tag }"
            @click="setTag(tag)"
          >
            {{ tag }}
          </button>
        </div>
      </aside>

      <section class="library">
        <div class="toolbar">
          <div class="search-box">
            <Search :size="18" />
            <input v-model="searchInput" placeholder="搜索标题、摘要、域名或标签" @keyup.enter="search" />
          </div>
          <button class="text-button" @click="search">搜索</button>
        </div>

        <div v-if="visibleBookmarks.length" class="card-grid">
          <article v-for="bookmark in visibleBookmarks" :key="bookmark.id" class="bookmark-card">
            <div class="card-cover" :style="{ backgroundImage: bookmark.coverImageUrl ? `url(${bookmark.coverImageUrl})` : '' }">
              <img v-if="bookmark.faviconUrl" :src="bookmark.faviconUrl" alt="" />
              <span v-else>{{ bookmark.domain.slice(0, 1).toUpperCase() }}</span>
            </div>
            <div class="card-body">
              <div class="card-meta">
                <span>{{ bookmark.category }}</span>
                <span>{{ bookmark.domain }}</span>
              </div>
              <h3>{{ bookmark.title }}</h3>
              <p>{{ bookmark.summary || bookmark.description || "暂无摘要" }}</p>
              <div class="tag-row">
                <span v-for="tag in bookmark.tags" :key="tag">{{ tag }}</span>
              </div>
            </div>
            <div class="card-actions">
              <a class="icon-button" :href="bookmark.url" target="_blank" rel="noreferrer" title="打开链接">
                <ExternalLink :size="17" />
              </a>
              <button class="icon-button" :class="{ selected: bookmark.pinned }" title="置顶" @click="togglePinned(bookmark)">
                <Pin :size="17" />
              </button>
              <button class="icon-button" title="归档" @click="archiveBookmark(bookmark)">
                <Archive :size="17" />
              </button>
              <button class="icon-button danger" title="删除" @click="removeBookmark(bookmark)">
                <Trash2 :size="17" />
              </button>
            </div>
          </article>
        </div>

        <div v-else class="empty-state">
          <h2>还没有收藏</h2>
          <p>粘贴第一个链接，Linka 会自动生成摘要、分类和标签。</p>
        </div>
      </section>

      <aside class="assistant">
        <div class="assistant-header">
          <Bot :size="20" />
          <div>
            <h2>AI 助手</h2>
            <p>收藏、搜索、整理</p>
          </div>
        </div>

        <div class="assistant-input">
          <textarea v-model="assistantInput" rows="4" placeholder="例如：收藏这个链接 https://example.com" @keydown.ctrl.enter.prevent="askAssistant" />
          <button class="icon-button primary" title="发送" :disabled="isAssistantLoading" @click="askAssistant">
            <Loader2 v-if="isAssistantLoading" class="spin" :size="18" />
            <Send v-else :size="18" />
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
      </aside>
    </section>
  </main>
</template>

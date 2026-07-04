<script setup lang="ts">
import { Archive, Bot, ExternalLink, Pin, Trash2 } from "@lucide/vue";
import type { Bookmark, Category } from "../../types";

defineProps<{
  bookmarks: Bookmark[];
  categories: Category[];
  selectedCategory: string;
  showArchived: boolean;
  failedIconIds: Set<string>;
}>();

defineEmits<{
  setCategory: [category: string];
  togglePinned: [bookmark: Bookmark];
  toggleArchived: [bookmark: Bookmark];
  removeBookmark: [bookmark: Bookmark];
  markIconFailed: [bookmarkId: string];
}>();

function getFallbackIconText(bookmark: Bookmark) {
  return (bookmark.domain || bookmark.title || "?").slice(0, 1).toUpperCase();
}
</script>

<template>
  <template v-if="true">
    <nav class="filter-rail" aria-label="收藏筛选">
      <div class="filter-group">
        <span class="filter-label">分类</span>
        <button class="filter-btn" :class="{ active: selectedCategory === '全部' }" @click="$emit('setCategory', '全部')">
          全部
        </button>
        <button v-for="category in categories" :key="category.id" class="filter-btn"
          :class="{ active: selectedCategory === category.name }" @click="$emit('setCategory', category.name)">
          {{ category.name }}
        </button>
      </div>
    </nav>

    <section class="library">
      <transition-group name="fade" tag="div" class="card-grid" v-if="bookmarks.length">
        <article v-for="bookmark in bookmarks" :key="bookmark.id" class="bookmark-card">
          <div class="card-header">
            <div class="site-icon" :style="{ backgroundImage: bookmark.coverImageUrl ? `url(${bookmark.coverImageUrl})` : '' }">
              <img v-if="bookmark.faviconUrl && !failedIconIds.has(bookmark.id)" :src="bookmark.faviconUrl" alt=""
                @error="$emit('markIconFailed', bookmark.id)" />
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
            <button class="icon-action secondary-action" :class="{ selected: bookmark.pinned }" title="置顶"
              @click="$emit('togglePinned', bookmark)">
              <Pin :size="16" />
            </button>
            <button class="icon-action secondary-action" :title="showArchived ? '恢复' : '归档'"
              @click="$emit('toggleArchived', bookmark)">
              <Archive :size="16" />
            </button>
            <button class="icon-action secondary-action danger" title="删除" @click="$emit('removeBookmark', bookmark)">
              <Trash2 :size="16" />
            </button>
          </div>
        </article>
      </transition-group>

      <div v-else class="empty-state">
        <Bot :size="48" color="var(--text-tertiary)" class="empty-state-icon" />
        <h2>你的数字大脑空空如也</h2>
        <p>在上方粘贴链接开始收集，AI 会为你搞定剩下的一切。</p>
      </div>
    </section>
  </template>
</template>

<script setup lang="ts">
import { Archive, Bot, Edit2, ExternalLink, Pin, Trash2 } from "@lucide/vue";
import { RouterLink } from "vue-router";
import { useI18n } from "vue-i18n";
import type { Bookmark, Category } from "../../types";

defineProps<{
  bookmarks: Bookmark[];
  categories: Category[];
  selectedCategory: string;
  showArchived: boolean;
  failedIconIds: Set<string>;
}>();

defineEmits<{
  togglePinned: [bookmark: Bookmark];
  toggleArchived: [bookmark: Bookmark];
  removeBookmark: [bookmark: Bookmark];
  markIconFailed: [bookmarkId: string];
  editBookmark: [bookmark: Bookmark];
}>();

function getFallbackIconText(bookmark: Bookmark) {
  return (bookmark.domain || bookmark.title || "?").slice(0, 1).toUpperCase();
}

const { t } = useI18n();
</script>

<template>
  <template v-if="true">
    <section class="library">
      <transition-group name="fade" tag="div" class="card-grid" v-if="bookmarks.length">
        <article v-for="bookmark in bookmarks" :key="bookmark.id" class="bookmark-card">
          <a class="open-link-btn" :href="bookmark.url" target="_blank" rel="noreferrer" :title="t('library.openLink')">
            <ExternalLink :size="20" />
          </a>

          <div class="card-header">
            <div class="site-icon"
              :style="{ backgroundImage: bookmark.coverImageUrl ? `url(${bookmark.coverImageUrl})` : '' }">
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

          <p class="card-summary">{{ bookmark.summary || bookmark.description || t('library.noSummary') }}</p>

          <div class="card-actions-overlay">
            <button class="icon-action secondary-action" :class="{ selected: bookmark.pinned }" :title="t('library.pin')"
              @click="$emit('togglePinned', bookmark)">
              <Pin :size="16" />
            </button>
            <button class="icon-action secondary-action" :title="t('library.edit')"
              @click="$emit('editBookmark', bookmark)">
              <Edit2 :size="16" />
            </button>
            <button class="icon-action secondary-action" :title="showArchived ? t('library.restore') : t('library.archive')"
              @click="$emit('toggleArchived', bookmark)">
              <Archive :size="16" />
            </button>
            <button class="icon-action secondary-action danger" :title="t('library.delete')" @click="$emit('removeBookmark', bookmark)">
              <Trash2 :size="16" />
            </button>
          </div>
        </article>
      </transition-group>

      <div v-else class="empty-state">
        <Bot :size="48" color="var(--text-tertiary)" class="empty-state-icon" />
        <h2>{{ selectedCategory === '首页' ? t('library.emptyHomeTitle') : t('library.emptyCategoryTitle') }}</h2>
        <p>{{ selectedCategory === '首页' ? t('library.emptyHomeDesc') : t('library.emptyCategoryDesc') }}</p>
      </div>
    </section>
  </template>
</template>

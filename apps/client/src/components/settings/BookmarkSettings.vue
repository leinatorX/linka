<script setup lang="ts">
import { Edit2, Link2, Plus, Trash2 } from "@lucide/vue";
import { useI18n } from "vue-i18n";
import type { Bookmark } from "../../types";

defineProps<{
  bookmarks: Bookmark[];
}>();

const emit = defineEmits<{
  showAddBookmark: [];
  startEditingBookmark: [bookmark: Bookmark];
  removeBookmark: [bookmark: Bookmark];
}>();

const { t } = useI18n();

function confirmDelete(bookmark: Bookmark) {
  if (window.confirm(t('library.deleteConfirm'))) {
    emit('removeBookmark', bookmark);
  }
}
</script>

<template>
  <section>
    <div class="grand-panel">
      <div class="section-title bookmark-settings-title">
        <div>
          <h3>{{ t('settings.bookmarks.title') }}</h3>
          <p>{{ t('settings.bookmarks.desc') }}</p>
        </div>
        <button class="btn-primary icon-btn bookmark-add-button" :title="t('settings.bookmarks.addBookmark')" @click="$emit('showAddBookmark')">
          <Plus :size="20" />
        </button>
      </div>

      <div class="bookmark-manage-list">
        <div v-for="bookmark in bookmarks" :key="bookmark.id" class="bookmark-manage-item">
          <div class="bookmark-manage-info">
            <img v-if="bookmark.faviconUrl" :src="bookmark.faviconUrl" alt="" class="bookmark-manage-icon" />
            <div v-else class="bookmark-manage-icon-placeholder">
              <Link2 :size="16" />
            </div>
            <div class="bookmark-manage-texts">
              <h4>{{ bookmark.title || bookmark.domain }}</h4>
              <p>{{ bookmark.url }}</p>
            </div>
            <span class="bookmark-manage-category" v-if="bookmark.category">{{ bookmark.category }}</span>
          </div>
          <div class="bookmark-manage-actions" style="display: flex; gap: 8px;">
            <button class="mini-button icon-only" :title="t('settings.bookmarks.edit')" @click="$emit('startEditingBookmark', bookmark)">
              <Edit2 :size="16" />
            </button>
            <button class="mini-button icon-only" style="color: var(--danger)" :title="t('library.delete')" @click.stop.prevent="confirmDelete(bookmark)">
              <Trash2 :size="16" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

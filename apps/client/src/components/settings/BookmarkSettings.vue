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
    <div class="settings-section-title" style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 12px; margin-top: 8px;">
      <div>
        <h3>{{ t('settings.bookmarks.title') }}</h3>
        <p style="margin: 6px 0 0; font-size: 13px; color: var(--text-secondary); text-transform: none; font-weight: normal;">{{ t('settings.bookmarks.desc') }}</p>
      </div>
    </div>

    <div class="settings-list-group">
      <!-- Create bookmark row -->
      <div class="settings-list-item" style="padding: 12px 20px; cursor: pointer;" @click="$emit('showAddBookmark')">
         <div style="display: flex; align-items: center; gap: 12px; color: var(--accent-primary);">
            <Plus :size="18" />
            <span style="font-size: 15px; font-weight: 500;">{{ t('settings.bookmarks.addBookmark') }}</span>
         </div>
      </div>

      <!-- Bookmarks List -->
      <div v-for="bookmark in bookmarks" :key="bookmark.id" class="settings-list-item bookmark-manage-item" style="padding: 12px 20px;">
        <div class="bookmark-manage-info">
          <img v-if="bookmark.faviconUrl" :src="bookmark.faviconUrl" alt="" class="bookmark-manage-icon" />
          <div v-else class="bookmark-manage-icon-placeholder">
            <Link2 :size="16" />
          </div>
          <div class="bookmark-manage-texts">
            <h4 style="margin: 0; font-size: 15px; font-weight: 500; color: var(--text-primary);">{{ bookmark.title || bookmark.domain }}</h4>
            <p style="margin: 0; font-size: 13px; color: var(--text-secondary);">{{ bookmark.url }}</p>
          </div>
          <span class="bookmark-manage-category" v-if="bookmark.category">{{ bookmark.category }}</span>
        </div>
        <div class="bookmark-manage-actions" style="display: flex; gap: 8px; margin-top: 0;">
          <button class="btn-secondary compact" style="width: 28px; height: 28px; border-radius: 6px; padding: 0; display: flex; align-items: center; justify-content: center;" :title="t('settings.bookmarks.edit')" @click="$emit('startEditingBookmark', bookmark)">
            <Edit2 :size="14" />
          </button>
          <button class="btn-secondary compact" style="width: 28px; height: 28px; border-radius: 6px; padding: 0; display: flex; align-items: center; justify-content: center; color: var(--danger);" :title="t('library.delete')" @click.stop.prevent="confirmDelete(bookmark)">
            <Trash2 :size="14" />
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

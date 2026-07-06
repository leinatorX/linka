<script setup lang="ts">
import { Edit2, Link2, Plus } from "@lucide/vue";
import { useI18n } from "vue-i18n";
import type { Bookmark } from "../../types";

defineProps<{
  bookmarks: Bookmark[];
}>();

defineEmits<{
  showAddBookmark: [];
  startEditingBookmark: [bookmark: Bookmark];
}>();

const { t } = useI18n();
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
          <button class="mini-button icon-only" :title="t('settings.bookmarks.edit')" @click="$emit('startEditingBookmark', bookmark)">
            <Edit2 :size="16" />
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

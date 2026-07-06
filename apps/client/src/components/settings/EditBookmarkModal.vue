<script setup lang="ts">
import { ImagePlus, X } from "@lucide/vue";
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import type { Category } from "../../types";
import { readIconFileAsDataUrl } from "../../utils/imageInput";

const props = defineProps<{
  categories: Category[];
  editData: {
    title: string;
    url: string;
    summary: string;
    faviconUrl: string;
    category: string;
    showOnHome: boolean;
  };
}>();

const editingBookmarkId = defineModel<string | null>("editingBookmarkId", { required: true });

defineEmits<{
  submit: [];
}>();

const { t } = useI18n();

const fileInput = ref<HTMLInputElement | null>(null);
const uploadError = ref("");

function openFilePicker() {
  fileInput.value?.click();
}

async function onIconFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) {
    return;
  }

  uploadError.value = "";
  try {
    props.editData.faviconUrl = await readIconFileAsDataUrl(file);
  } catch (error) {
    uploadError.value = error instanceof Error ? error.message : t('settings.bookmarks.readIconFailed');
  }
}
</script>

<template>
  <transition name="fade">
    <div class="modal-overlay" v-if="editingBookmarkId" @click.self="editingBookmarkId = null">
      <div class="modal-card">
        <header class="modal-header">
          <h3>{{ t('settings.bookmarks.editBookmarkTitle') }}</h3>
          <button class="btn-close" @click="editingBookmarkId = null">
            <X :size="20" />
          </button>
        </header>
        <div class="modal-body settings-form">
          <label>
            <span>{{ t('settings.bookmarks.url') }}</span>
            <input v-model="editData.url" placeholder="https://example.com" @keyup.enter="$emit('submit')" />
          </label>
          <label>
            <span>{{ t('settings.bookmarks.titleField') }}</span>
            <input v-model="editData.title" :placeholder="t('settings.bookmarks.optionalAuto')" @keyup.enter="$emit('submit')" />
          </label>
          <label>
            <span>{{ t('settings.bookmarks.summary') }}</span>
            <textarea v-model="editData.summary" :placeholder="t('settings.bookmarks.summaryPlaceholder')"></textarea>
          </label>
          <label>
            <span>{{ t('settings.bookmarks.iconLink') }}</span>
            <div class="icon-input-row">
              <input v-model="editData.faviconUrl" :placeholder="t('settings.bookmarks.iconPlaceholder')" @keyup.enter="$emit('submit')" />
              <button type="button" class="btn-secondary icon-upload-btn" @click="openFilePicker">
                <ImagePlus :size="16" />
                <span>{{ t('settings.bookmarks.upload') }}</span>
              </button>
              <input ref="fileInput" class="visually-hidden" type="file" accept="image/*" @change="onIconFileChange" />
            </div>
            <small v-if="uploadError" class="field-error">{{ uploadError }}</small>
          </label>
          <label>
            <span>{{ t('settings.bookmarks.category') }}</span>
            <select v-model="editData.category">
              <option value="">{{ t('settings.bookmarks.uncategorized') }}</option>
              <option v-for="item in categories" :key="item.id" :value="item.name">
                {{ item.name }}
              </option>
            </select>
          </label>
          <label class="bookmark-home-toggle">
            <span>{{ t('settings.bookmarks.showOnHome') }}</span>
            <button type="button" class="switch-toggle" :class="{ active: editData.showOnHome }" @click="editData.showOnHome = !editData.showOnHome">
              <div></div>
            </button>
          </label>
          <div class="modal-two-actions">
            <button class="btn-secondary" @click="editingBookmarkId = null">{{ t('settings.ai.cancel') }}</button>
            <button class="btn-primary" @click="$emit('submit')">
              <span>{{ t('settings.bookmarks.saveChanges') }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

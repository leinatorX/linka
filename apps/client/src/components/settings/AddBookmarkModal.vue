<script setup lang="ts">
import { ImagePlus, Loader2, Plus, X } from "@lucide/vue";
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import type { Category } from "../../types";
import { readIconFileAsDataUrl } from "../../utils/imageInput";

defineProps<{
  categories: Category[];
  isSaving: boolean;
  message: string;
}>();

const visible = defineModel<boolean>("visible", { required: true });
const url = defineModel<string>("url", { required: true });
const title = defineModel<string>("title", { required: true });
const category = defineModel<string>("category", { required: true });
const faviconUrl = defineModel<string>("faviconUrl", { required: true });
const showOnHome = defineModel<boolean>("showOnHome", { required: true });

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
    faviconUrl.value = await readIconFileAsDataUrl(file);
  } catch (error) {
    uploadError.value = error instanceof Error ? error.message : t('settings.bookmarks.readIconFailed');
  }
}
</script>

<template>
  <transition name="fade">
    <div class="modal-overlay" v-if="visible" @click.self="visible = false">
      <div class="modal-card">
        <header class="modal-header">
          <h3>{{ t('settings.bookmarks.addBookmark') }}</h3>
          <button class="btn-close" @click="visible = false">
            <X :size="20" />
          </button>
        </header>
        <div class="modal-body settings-form">
          <label>
            <span>{{ t('settings.bookmarks.url') }}</span>
            <input v-model="url" placeholder="https://example.com" @keyup.enter="$emit('submit')" />
          </label>
          <label>
            <span>{{ t('settings.bookmarks.titleField') }}</span>
            <input v-model="title" :placeholder="t('settings.bookmarks.optionalAuto')" @keyup.enter="$emit('submit')" />
          </label>
          <label>
            <span>{{ t('settings.bookmarks.icon') }}</span>
            <div class="icon-input-row">
              <input v-model="faviconUrl" :placeholder="t('settings.bookmarks.optionalAuto')" @keyup.enter="$emit('submit')" />
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
            <select v-model="category">
              <option value="">{{ t('settings.bookmarks.aiAuto') }}</option>
              <option v-for="item in categories" :key="item.id" :value="item.name">
                {{ item.name }}
              </option>
            </select>
          </label>
          <label class="bookmark-home-toggle">
            <span>{{ t('settings.bookmarks.showOnHome') }}</span>
            <button type="button" class="switch-toggle" :class="{ active: showOnHome }" @click="showOnHome = !showOnHome">
              <div></div>
            </button>
          </label>
          <button class="btn-primary settings-submit add-bookmark-submit" :disabled="isSaving" @click="$emit('submit')">
            <Loader2 v-if="isSaving" class="spin" :size="18" />
            <Plus v-else :size="18" />
            <span>{{ t('settings.bookmarks.addToLinka') }}</span>
          </button>
          <p v-if="message" class="settings-message">{{ message }}</p>
        </div>
      </div>
    </div>
  </transition>
</template>

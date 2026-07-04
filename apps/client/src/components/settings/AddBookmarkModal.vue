<script setup lang="ts">
import { ImagePlus, Loader2, Plus, X } from "@lucide/vue";
import { ref } from "vue";
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

defineEmits<{
  submit: [];
}>();

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
    uploadError.value = error instanceof Error ? error.message : "图片读取失败。";
  }
}
</script>

<template>
  <transition name="fade">
    <div class="modal-overlay" v-if="visible" @click.self="visible = false">
      <div class="modal-card">
        <header class="modal-header">
          <h3>添加书签</h3>
          <button class="btn-close" @click="visible = false">
            <X :size="20" />
          </button>
        </header>
        <div class="modal-body settings-form">
          <label>
            <span>网页链接</span>
            <input v-model="url" placeholder="https://example.com" @keyup.enter="$emit('submit')" />
          </label>
          <label>
            <span>标题</span>
            <input v-model="title" placeholder="可选，不填则自动抓取" @keyup.enter="$emit('submit')" />
          </label>
          <label>
            <span>图标</span>
            <div class="icon-input-row">
              <input v-model="faviconUrl" placeholder="可选，不填则自动抓取" @keyup.enter="$emit('submit')" />
              <button type="button" class="btn-secondary icon-upload-btn" @click="openFilePicker">
                <ImagePlus :size="16" />
                <span>上传</span>
              </button>
              <input ref="fileInput" class="visually-hidden" type="file" accept="image/*" @change="onIconFileChange" />
            </div>
            <small v-if="uploadError" class="field-error">{{ uploadError }}</small>
          </label>
          <label>
            <span>分类</span>
            <select v-model="category">
              <option value="">AI 自动选择</option>
              <option v-for="item in categories" :key="item.id" :value="item.name">
                {{ item.name }}
              </option>
            </select>
          </label>
          <button class="btn-primary settings-submit add-bookmark-submit" :disabled="isSaving" @click="$emit('submit')">
            <Loader2 v-if="isSaving" class="spin" :size="18" />
            <Plus v-else :size="18" />
            <span>添加到 Linka</span>
          </button>
          <p v-if="message" class="settings-message">{{ message }}</p>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ImagePlus, X } from "@lucide/vue";
import { ref } from "vue";
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
    uploadError.value = error instanceof Error ? error.message : "图片读取失败。";
  }
}
</script>

<template>
  <transition name="fade">
    <div class="modal-overlay" v-if="editingBookmarkId" @click.self="editingBookmarkId = null">
      <div class="modal-card">
        <header class="modal-header">
          <h3>编辑书签</h3>
          <button class="btn-close" @click="editingBookmarkId = null">
            <X :size="20" />
          </button>
        </header>
        <div class="modal-body settings-form">
          <label>
            <span>网页链接</span>
            <input v-model="editData.url" placeholder="https://example.com" @keyup.enter="$emit('submit')" />
          </label>
          <label>
            <span>标题</span>
            <input v-model="editData.title" placeholder="可选，不填则自动抓取" @keyup.enter="$emit('submit')" />
          </label>
          <label>
            <span>描述</span>
            <textarea v-model="editData.summary" placeholder="可选，用于书签卡片摘要显示；留空则显示暂无摘要"></textarea>
          </label>
          <label>
            <span>图标链接</span>
            <div class="icon-input-row">
              <input v-model="editData.faviconUrl" placeholder="可选，支持在线地址或本地上传" @keyup.enter="$emit('submit')" />
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
            <select v-model="editData.category">
              <option value="">未分类</option>
              <option v-for="item in categories" :key="item.id" :value="item.name">
                {{ item.name }}
              </option>
            </select>
          </label>
          <label class="bookmark-home-toggle">
            <span>首页显示</span>
            <button type="button" class="switch-toggle" :class="{ active: editData.showOnHome }" @click="editData.showOnHome = !editData.showOnHome">
              <div></div>
            </button>
          </label>
          <div class="modal-two-actions">
            <button class="btn-secondary" @click="editingBookmarkId = null">取消</button>
            <button class="btn-primary" @click="$emit('submit')">
              <span>保存修改</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

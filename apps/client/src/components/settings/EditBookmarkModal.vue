<script setup lang="ts">
import { X } from "@lucide/vue";
import type { Category } from "../../types";

defineProps<{
  categories: Category[];
  editData: {
    title: string;
    url: string;
    faviconUrl: string;
    category: string;
  };
}>();

const editingBookmarkId = defineModel<string | null>("editingBookmarkId", { required: true });

defineEmits<{
  submit: [];
}>();
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
            <span>图标链接</span>
            <input v-model="editData.faviconUrl" placeholder="可选" @keyup.enter="$emit('submit')" />
          </label>
          <label>
            <span>分类</span>
            <select v-model="editData.category">
              <option value="全部">全部 / 未分类</option>
              <option v-for="item in categories" :key="item.id" :value="item.name">
                {{ item.name }}
              </option>
            </select>
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

<script setup lang="ts">
import { Loader2, Plus, X } from "@lucide/vue";
import type { Category } from "../../types";

defineProps<{
  categories: Category[];
  isSaving: boolean;
  message: string;
}>();

const visible = defineModel<boolean>("visible", { required: true });
const url = defineModel<string>("url", { required: true });
const title = defineModel<string>("title", { required: true });
const category = defineModel<string>("category", { required: true });

defineEmits<{
  submit: [];
}>();
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

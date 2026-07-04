<script setup lang="ts">
import { Plus } from "@lucide/vue";
import type { Category } from "../../types";

defineProps<{
  categories: Category[];
  editingCategoryNames: Record<string, string>;
}>();

const newCategoryName = defineModel<string>("newCategoryName", { required: true });

defineEmits<{
  addCategory: [];
  saveCategory: [category: Category];
  removeCategory: [category: Category];
}>();
</script>

<template>
  <section>
    <div class="grand-panel">
      <div class="section-title">
        <h3>分类管理</h3>
        <p>AI 会优先从这些分类中选择。删除分类后，相关书签会归入“未分类”。</p>
      </div>

      <div class="category-create settings-form">
        <input v-model="newCategoryName" placeholder="新分类名称" @keyup.enter="$emit('addCategory')" />
        <button class="btn-primary compact icon-btn" title="添加" @click="$emit('addCategory')">
          <Plus />
        </button>
      </div>

      <div class="category-list">
        <div v-for="category in categories" :key="category.id" class="category-item">
          <input class="settings-inline-input" :value="editingCategoryNames[category.id]"
            :disabled="category.name === '未分类'"
            @input="editingCategoryNames[category.id] = ($event.target as HTMLInputElement).value"
            @keyup.enter="$emit('saveCategory', category)" />
          <div class="category-item-actions">
            <button class="mini-button" :disabled="category.name === '未分类'"
              @click="$emit('saveCategory', category)">保存</button>
            <button class="mini-button danger" :disabled="category.name === '未分类'"
              @click="$emit('removeCategory', category)">删除</button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Plus, GripVertical } from "@lucide/vue";
import { ref } from "vue";
import type { Category } from "../../types";

const props = defineProps<{
  categories: Category[];
  editingCategoryNames: Record<string, string>;
}>();

const newCategoryName = defineModel<string>("newCategoryName", { required: true });

const emit = defineEmits<{
  addCategory: [];
  saveCategory: [category: Category];
  removeCategory: [category: Category];
  reorderCategories: [orderedIds: string[]];
}>();

// 拖拽状态：当前被拖的 id、目标位置。
// 纯状态量驱动 class 绑定，零额外运行时。
const draggedId = ref<string | null>(null);
const dropTargetId = ref<string | null>(null);
const dropPosition = ref<"before" | "after">("before");

function onDragStart(event: DragEvent, id: string) {
  if (!event.dataTransfer) {
    return;
  }
  draggedId.value = id;
  event.dataTransfer.effectAllowed = "move";
  // text/plain 必备，否则 Firefox 不发 dragstart
  event.dataTransfer.setData("text/plain", id);
}

function onDragOver(event: DragEvent, targetId: string) {
  if (!draggedId.value || draggedId.value === targetId) {
    return;
  }
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  // 上半部分视为 before，下半部分视为 after，让用户能精确控制插入点
  const position = event.clientY - rect.top < rect.height / 2 ? "before" : "after";
  dropTargetId.value = targetId;
  dropPosition.value = position;
}

function onDragLeave(targetId: string) {
  if (dropTargetId.value === targetId) {
    dropTargetId.value = null;
  }
}

function onDragEnd() {
  draggedId.value = null;
  dropTargetId.value = null;
}

function onDrop(event: DragEvent, targetId: string) {
  event.preventDefault();
  const sourceId = draggedId.value ?? event.dataTransfer?.getData("text/plain") ?? "";
  onDragEnd();
  if (!sourceId || sourceId === targetId) {
    return;
  }

  // 计算新顺序：以当前 categories 为基准，把 sourceId 移动到 targetId 旁（before / after）
  const ids = props.categories.map((category) => category.id);
  const fromIndex = ids.indexOf(sourceId);
  const toIndex = ids.indexOf(targetId);
  if (fromIndex < 0 || toIndex < 0) {
    return;
  }
  const next = ids.slice();
  next.splice(fromIndex, 1);
  const insertAt = dropPosition.value === "before" ? toIndex : toIndex + 1;
  next.splice(insertAt > fromIndex ? insertAt - 1 : insertAt, 0, sourceId);

  emit("reorderCategories", next);
}
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
        <div
          v-for="category in categories"
          :key="category.id"
          class="category-item"
          :class="{
            'is-dragging': draggedId === category.id,
            'drop-before': dropTargetId === category.id && dropPosition === 'before',
            'drop-after': dropTargetId === category.id && dropPosition === 'after'
          }"
          draggable="true"
          @dragstart="onDragStart($event, category.id)"
          @dragover="onDragOver($event, category.id)"
          @dragleave="onDragLeave(category.id)"
          @dragend="onDragEnd"
          @drop="onDrop($event, category.id)"
        >
          <span class="drag-handle" title="拖拽排序" aria-label="拖拽排序">
            <GripVertical :size="16" />
          </span>
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

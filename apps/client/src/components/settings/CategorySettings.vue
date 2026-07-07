<script setup lang="ts">
import { Plus, GripVertical } from "@lucide/vue";
import { ref } from "vue";
import { useI18n } from "vue-i18n";
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

const { t } = useI18n();

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
    <div class="settings-section-title" style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 12px; margin-top: 8px;">
      <div>
        <h3>{{ t('settings.categories.title') }}</h3>
        <p style="margin: 6px 0 0; font-size: 13px; color: var(--text-secondary); text-transform: none; font-weight: normal;">{{ t('settings.categories.desc') }}</p>
      </div>
    </div>

    <div class="settings-list-group">
      <!-- Create category row -->
      <div class="settings-list-item" style="padding-left: 20px; padding-right: 20px;">
        <div style="flex: 1; display: flex; align-items: center; min-width: 0;">
          <input v-model="newCategoryName" :placeholder="t('settings.categories.newCategoryPlaceholder')" @keyup.enter="$emit('addCategory')" style="background: transparent; border: none; font-size: 15px; padding: 0; width: 100%; color: var(--text-primary); outline: none;" />
        </div>
        <button class="btn-primary icon-btn compact" style="width: 28px; height: 28px; border-radius: 50%; padding: 0; display: flex; align-items: center; justify-content: center; flex-shrink: 0;" :title="t('settings.categories.add')" @click="$emit('addCategory')">
          <Plus :size="16" />
        </button>
      </div>

      <!-- Category List -->
      <div
        v-for="category in categories"
        :key="category.id"
        class="settings-list-item category-item"
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
        <span class="drag-handle" :title="t('settings.categories.dragSort')" :aria-label="t('settings.categories.dragSort')">
          <GripVertical :size="16" />
        </span>
        <div style="flex: 1; display: flex; align-items: center; min-width: 0;">
          <input :value="editingCategoryNames[category.id]"
            :disabled="category.name === '未分类'"
            @input="editingCategoryNames[category.id] = ($event.target as HTMLInputElement).value"
            @keyup.enter="$emit('saveCategory', category)" 
            style="background: transparent; border: none; font-size: 15px; padding: 0; width: 100%; color: var(--text-primary); outline: none;" />
        </div>
        <div class="category-item-actions" style="display: flex; gap: 6px;">
          <button class="btn-secondary" style="height: 28px; padding: 0 10px; font-size: 12px; border-radius: 6px;" :disabled="category.name === '未分类'"
            @click="$emit('saveCategory', category)">{{ t('settings.categories.save') }}</button>
          <button class="btn-secondary" style="height: 28px; padding: 0 10px; font-size: 12px; border-radius: 6px; color: var(--danger);" :disabled="category.name === '未分类'"
            @click="$emit('removeCategory', category)">{{ t('settings.categories.delete') }}</button>
        </div>
      </div>
    </div>
  </section>
</template>

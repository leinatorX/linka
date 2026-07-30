<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { X } from "@lucide/vue";
import type { AgentRule, AgentRulePayload } from "../../types";

const props = defineProps<{
  initialData?: AgentRule | null;
  saving?: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "save", payload: AgentRulePayload, id?: string): void;
}>();

const { t } = useI18n();

const title = ref("");
const ruleType = ref("agents_md");
const category = ref("general");
const description = ref("");
const content = ref("");
const tagsInput = ref("");
const isPinned = ref(false);

watch(
  () => props.initialData,
  (val) => {
    if (val) {
      title.value = val.title || "";
      ruleType.value = val.ruleType || "agents_md";
      category.value = val.category || "general";
      description.value = val.description || "";
      content.value = val.content || "";
      tagsInput.value = (val.tags || []).join(", ");
      isPinned.value = Boolean(val.isPinned);
    } else {
      resetForm();
    }
  },
  { immediate: true }
);

function resetForm() {
  title.value = "";
  ruleType.value = "agents_md";
  category.value = "general";
  description.value = "";
  content.value = "";
  tagsInput.value = "";
  isPinned.value = false;
}

function handleSave() {
  if (!title.value.trim()) return;

  const tags = tagsInput.value
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const payload: AgentRulePayload = {
    title: title.value.trim(),
    ruleType: ruleType.value,
    category: category.value,
    description: description.value.trim(),
    content: content.value,
    tags,
    isPinned: isPinned.value
  };

  emit("save", payload, props.initialData?.id);
}
</script>

<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-card">
      <div class="modal-header">
        <h3>{{ initialData ? t('agentRules.editRule') : t('agentRules.newRule') }}</h3>
        <button type="button" class="close-btn" @click="$emit('close')">
          <X :size="18" />
        </button>
      </div>

      <div class="modal-body">
        <div class="form-row gap-2">
          <div class="form-group flex-2">
            <label>{{ t('agentRules.ruleTitle') }} *</label>
            <input
              v-model="title"
              type="text"
              :placeholder="t('agentRules.ruleTitlePlaceholder')"
              required
            />
          </div>
          <div class="form-group flex-1">
            <label>{{ t('agentRules.ruleType') }}</label>
            <select v-model="ruleType">
              <option value="agents_md">AGENTS.md</option>
              <option value="cursorrules">.cursorrules</option>
              <option value="windsurfrules">.windsurfrules</option>
              <option value="claude_md">CLAUDE.md</option>
              <option value="prompt">通用 Prompt</option>
              <option value="custom">自定义</option>
            </select>
          </div>
        </div>

        <div class="form-row gap-2">
          <div class="form-group flex-1">
            <label>{{ t('agentRules.category') }}</label>
            <select v-model="category">
              <option value="general">{{ t('agentRules.categories.general') }}</option>
              <option value="frontend">{{ t('agentRules.categories.frontend') }}</option>
              <option value="backend">{{ t('agentRules.categories.backend') }}</option>
              <option value="fullstack">{{ t('agentRules.categories.fullstack') }}</option>
              <option value="devops">{{ t('agentRules.categories.devops') }}</option>
            </select>
          </div>
          <div class="form-group flex-2">
            <label>{{ t('agentRules.tags') }}</label>
            <input
              v-model="tagsInput"
              type="text"
              :placeholder="t('agentRules.tagsPlaceholder')"
            />
          </div>
        </div>

        <div class="form-group">
          <label>{{ t('agentRules.description') }}</label>
          <input
            v-model="description"
            type="text"
            :placeholder="t('agentRules.descriptionPlaceholder')"
          />
        </div>

        <div class="form-group flex-1-editor">
          <div class="editor-header">
            <label>{{ t('agentRules.content') }}</label>
            <span class="char-count">{{ content.length }} 字</span>
          </div>
          <textarea
            v-model="content"
            rows="12"
            class="code-textarea"
            :placeholder="t('agentRules.contentPlaceholder')"
          ></textarea>
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn-secondary" @click="$emit('close')">
          {{ t('common.cancel') }}
        </button>
        <button type="button" class="btn-primary" :disabled="saving || !title.trim()" @click="handleSave">
          {{ t('common.save') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 10500;
  background-color: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

:root.light-theme .modal-overlay {
  background-color: rgba(0, 0, 0, 0.45);
}

.modal-card {
  background-color: #161618;
  color: #f3f4f6;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  width: 100%;
  max-width: 860px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 40px -5px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

:root.light-theme .modal-card {
  background-color: #ffffff;
  color: #111827;
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.15);
}

.modal-header {
  padding: 18px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: #1c1c1e;
}

:root.light-theme .modal-header {
  border-bottom-color: rgba(0, 0, 0, 0.06);
  background-color: #fbfbfd;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.close-btn {
  border: none;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
}

.close-btn:hover {
  background-color: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}

:root.light-theme .close-btn:hover {
  background-color: rgba(0, 0, 0, 0.05);
  color: #111827;
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-row {
  display: flex;
}

.gap-2 {
  gap: 12px;
}

.flex-1 {
  flex: 1;
}

.flex-2 {
  flex: 2;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 13px;
  font-weight: 500;
  color: #9ca3af;
}

:root.light-theme .form-group label {
  color: #4b5563;
}

.form-group input,
.form-group select {
  background-color: #242426;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 8px 12px;
  color: #ffffff;
  font-size: 14px;
  outline: none;
}

:root.light-theme .form-group input,
:root.light-theme .form-group select {
  background-color: #f3f4f6;
  border-color: rgba(0, 0, 0, 0.1);
  color: #111827;
}

.form-group input:focus,
.form-group select:focus,
.code-textarea:focus {
  border-color: #3b82f6;
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.char-count {
  font-size: 12px;
  color: #9ca3af;
}

.code-textarea {
  background-color: #1a1a1c;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 12px;
  color: #f3f4f6;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  line-height: 1.6;
  outline: none;
  resize: vertical;
  min-height: 220px;
}

:root.light-theme .code-textarea {
  background-color: #f8fafc;
  border-color: rgba(0, 0, 0, 0.1);
  color: #0f172a;
}

.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  background-color: #1c1c1e;
}

:root.light-theme .modal-footer {
  border-top-color: rgba(0, 0, 0, 0.06);
  background-color: #fbfbfd;
}

.btn-primary {
  background-color: #3b82f6;
  color: #ffffff;
  border: none;
  padding: 8px 20px;
  border-radius: 8px;
  font-weight: 500;
  font-size: 14px;
  cursor: pointer;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background-color: #242426;
  color: #9ca3af;
  border: 1px solid rgba(255, 255, 255, 0.12);
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}

:root.light-theme .btn-secondary {
  background-color: #f3f4f6;
  color: #4b5563;
  border-color: rgba(0, 0, 0, 0.1);
}
</style>

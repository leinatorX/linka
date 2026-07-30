<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Check, Copy, Download, Edit3, FileCode, Plus, Search, Trash2, X } from "@lucide/vue";
import { useAgentRules } from "../../composables/useAgentRules";
import AgentRuleEditModal from "./AgentRuleEditModal.vue";
import type { AgentRule, AgentRulePayload } from "../../types";

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "show-toast", msg: string): void;
}>();

const { t } = useI18n();

const {
  rules,
  searchInput,
  selectedCategory,
  selectedRuleType,
  loading,
  errorMsg,
  loadRules,
  saveRule,
  removeRule
} = useAgentRules();

const showEditModal = ref(false);
const editingRule = ref<AgentRule | null>(null);
const isSaving = ref(false);
const copiedRuleId = ref<string | null>(null);

watch(
  () => props.show,
  (val) => {
    if (val) {
      loadRules();
    }
  },
  { immediate: true }
);

function openCreateModal() {
  editingRule.value = null;
  showEditModal.value = true;
}

function openEditModal(rule: AgentRule) {
  editingRule.value = rule;
  showEditModal.value = true;
}

async function handleSaveRule(payload: AgentRulePayload, id?: string) {
  isSaving.value = true;
  try {
    await saveRule(payload, id);
    showEditModal.value = false;
    emit("show-toast", t("vault.copySuccess"));
  } catch (e: any) {
    emit("show-toast", e.message || "保存失败");
  } finally {
    isSaving.value = false;
  }
}

async function handleDeleteRule(rule: AgentRule) {
  if (!confirm(t("agentRules.deleteConfirm"))) return;
  try {
    await removeRule(rule.id);
    emit("show-toast", "规则已删除");
  } catch (e: any) {
    emit("show-toast", e.message || "删除失败");
  }
}

async function copyRuleContent(rule: AgentRule) {
  try {
    await navigator.clipboard.writeText(rule.content);
    copiedRuleId.value = rule.id;
    emit("show-toast", t("agentRules.copySuccess"));
    setTimeout(() => {
      if (copiedRuleId.value === rule.id) {
        copiedRuleId.value = null;
      }
    }, 2000);
  } catch (e: any) {
    emit("show-toast", e.message || "复制失败");
  }
}

function downloadRuleFile(rule: AgentRule) {
  const link = document.createElement("a");
  link.href = `/api/agent-rules/${rule.id}/download`;
  link.download = getRuleFilename(rule);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function getRuleFilename(rule: AgentRule) {
  switch (rule.ruleType) {
    case "agents_md":
      return "AGENTS.md";
    case "cursorrules":
      return ".cursorrules";
    case "windsurfrules":
      return ".windsurfrules";
    case "claude_md":
      return "CLAUDE.md";
    default:
      return `${rule.title.replace(/[\/\\?%*:|"<>]/g, "-") || "rule"}.md`;
  }
}
</script>

<template>
  <div v-if="show" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-card">
      <!-- Header -->
      <div class="modal-header">
        <div class="header-title">
          <div class="header-icon">
            <FileCode :size="22" />
          </div>
          <div>
            <h3>{{ t('agentRules.title') }}</h3>
            <p class="header-desc">{{ t('agentRules.desc') }}</p>
          </div>
        </div>

        <div class="header-actions">
          <button type="button" class="btn-add-rule" @click="openCreateModal">
            <Plus :size="16" />
            <span>{{ t('agentRules.newRule') }}</span>
          </button>
          <button type="button" class="close-btn" @click="$emit('close')">
            <X :size="18" />
          </button>
        </div>
      </div>

      <!-- Controls & Filter Bar -->
      <div class="controls-bar">
        <div class="category-tabs">
          <button
            type="button"
            class="tab-btn"
            :class="{ active: selectedCategory === 'all' }"
            @click="selectedCategory = 'all'"
          >
            {{ t('agentRules.categories.all') }}
          </button>
          <button
            type="button"
            class="tab-btn"
            :class="{ active: selectedCategory === 'general' }"
            @click="selectedCategory = 'general'"
          >
            {{ t('agentRules.categories.general') }}
          </button>
          <button
            type="button"
            class="tab-btn"
            :class="{ active: selectedCategory === 'frontend' }"
            @click="selectedCategory = 'frontend'"
          >
            {{ t('agentRules.categories.frontend') }}
          </button>
          <button
            type="button"
            class="tab-btn"
            :class="{ active: selectedCategory === 'backend' }"
            @click="selectedCategory = 'backend'"
          >
            {{ t('agentRules.categories.backend') }}
          </button>
          <button
            type="button"
            class="tab-btn"
            :class="{ active: selectedCategory === 'fullstack' }"
            @click="selectedCategory = 'fullstack'"
          >
            {{ t('agentRules.categories.fullstack') }}
          </button>
          <button
            type="button"
            class="tab-btn"
            :class="{ active: selectedCategory === 'devops' }"
            @click="selectedCategory = 'devops'"
          >
            {{ t('agentRules.categories.devops') }}
          </button>
        </div>

        <div class="filter-right">
          <div class="type-filter">
            <select v-model="selectedRuleType">
              <option value="all">{{ t('agentRules.types.all') }}</option>
              <option value="agents_md">AGENTS.md</option>
              <option value="cursorrules">.cursorrules</option>
              <option value="windsurfrules">.windsurfrules</option>
              <option value="claude_md">CLAUDE.md</option>
              <option value="prompt">通用 Prompt</option>
              <option value="custom">自定义</option>
            </select>
          </div>

          <div class="search-box">
            <Search :size="14" />
            <input
              v-model="searchInput"
              type="text"
              :placeholder="t('agentRules.searchPlaceholder')"
            />
          </div>
        </div>
      </div>

      <!-- Main Body List -->
      <div class="modal-body">
        <div v-if="loading && rules.length === 0" class="empty-state">
          <span>加载中...</span>
        </div>

        <div v-else-if="rules.length === 0" class="empty-state">
          <FileCode :size="40" class="empty-icon" />
          <p>{{ t('agentRules.emptyHint') }}</p>
        </div>

        <div v-else class="rules-grid">
          <div v-for="rule in rules" :key="rule.id" class="rule-card">
            <div class="card-top">
              <div class="card-header-left">
                <span class="rule-type-badge" :class="rule.ruleType">
                  {{ rule.ruleType === 'agents_md' ? 'AGENTS.md' : rule.ruleType === 'cursorrules' ? '.cursorrules' : rule.ruleType === 'windsurfrules' ? '.windsurfrules' : rule.ruleType === 'claude_md' ? 'CLAUDE.md' : rule.ruleType === 'prompt' ? 'Prompt' : 'Custom' }}
                </span>
                <span class="category-badge">{{ t(`agentRules.categories.${rule.category}`) || rule.category }}</span>
              </div>
              <div class="card-actions">
                <button
                  type="button"
                  class="action-btn"
                  :title="t('agentRules.copyContent')"
                  @click="copyRuleContent(rule)"
                >
                  <Check v-if="copiedRuleId === rule.id" :size="15" class="icon-success" />
                  <Copy v-else :size="15" />
                </button>
                <button
                  type="button"
                  class="action-btn"
                  :title="t('agentRules.downloadFile')"
                  @click="downloadRuleFile(rule)"
                >
                  <Download :size="15" />
                </button>
                <button
                  type="button"
                  class="action-btn"
                  :title="t('common.edit')"
                  @click="openEditModal(rule)"
                >
                  <Edit3 :size="15" />
                </button>
                <button
                  type="button"
                  class="action-btn danger"
                  :title="t('common.delete')"
                  @click="handleDeleteRule(rule)"
                >
                  <Trash2 :size="15" />
                </button>
              </div>
            </div>

            <h4 class="rule-title">{{ rule.title }}</h4>

            <p v-if="rule.description" class="rule-desc">{{ rule.description }}</p>

            <div class="code-preview">
              <pre><code>{{ rule.content.slice(0, 160) || "（无内容）" }}{{ rule.content.length > 160 ? '...' : '' }}</code></pre>
            </div>

            <div v-if="rule.tags && rule.tags.length > 0" class="tags-row">
              <span v-for="tag in rule.tags" :key="tag" class="tag-chip">#{{ tag }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit / Create Modal -->
    <AgentRuleEditModal
      v-if="showEditModal"
      :initial-data="editingRule"
      :saving="isSaving"
      @close="showEditModal = false"
      @save="handleSaveRule"
    />
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
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
  max-width: 1080px;
  height: 88vh;
  max-height: 880px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 50px -5px rgba(0, 0, 0, 0.6);
  overflow: hidden;
}

:root.light-theme .modal-card {
  background-color: #ffffff;
  color: #111827;
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.15);
}

.modal-header {
  padding: 20px 24px;
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

.header-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background-color: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-title h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.header-desc {
  margin: 2px 0 0 0;
  font-size: 12px;
  color: #9ca3af;
}

:root.light-theme .header-desc {
  color: #6b7280;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.btn-add-rule {
  display: flex;
  align-items: center;
  gap: 6px;
  background-color: #3b82f6;
  color: #ffffff;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.btn-add-rule:hover {
  background-color: #2563eb;
}

.close-btn {
  border: none;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
}

.close-btn:hover {
  background-color: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}

.controls-bar {
  padding: 12px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background-color: #1a1a1c;
  flex-wrap: wrap;
}

:root.light-theme .controls-bar {
  border-bottom-color: rgba(0, 0, 0, 0.06);
  background-color: #f3f4f6;
}

.category-tabs {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tab-btn {
  border: none;
  background: transparent;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #9ca3af;
  cursor: pointer;
  transition: all 0.15s ease;
}

:root.light-theme .tab-btn {
  color: #6b7280;
}

.tab-btn:hover {
  color: #ffffff;
  background-color: rgba(255, 255, 255, 0.06);
}

:root.light-theme .tab-btn:hover {
  color: #111827;
  background-color: rgba(0, 0, 0, 0.05);
}

.tab-btn.active {
  background-color: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
  font-weight: 600;
}

.filter-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.type-filter select {
  background-color: #242426;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 6px 10px;
  color: #ffffff;
  font-size: 13px;
  outline: none;
}

:root.light-theme .type-filter select {
  background-color: #ffffff;
  border-color: rgba(0, 0, 0, 0.12);
  color: #111827;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: #242426;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 6px 12px;
  width: 220px;
  color: #9ca3af;
}

:root.light-theme .search-box {
  background-color: #ffffff;
  border-color: rgba(0, 0, 0, 0.12);
  color: #6b7280;
}

.search-box input {
  border: none;
  background: transparent;
  color: inherit;
  font-size: 13px;
  outline: none;
  width: 100%;
}

.modal-body {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

.empty-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  gap: 12px;
}

.empty-icon {
  opacity: 0.4;
}

.rules-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.rule-card {
  background-color: #242426;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: all 0.2s ease;
}

:root.light-theme .rule-card {
  background-color: #f9f9fb;
  border-color: rgba(0, 0, 0, 0.06);
}

.rule-card:hover {
  border-color: rgba(59, 130, 246, 0.4);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.card-header-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.rule-type-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 6px;
  background-color: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
}

.rule-type-badge.cursorrules {
  background-color: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.rule-type-badge.claude_md {
  background-color: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}

.rule-type-badge.windsurfrules {
  background-color: rgba(139, 92, 246, 0.15);
  color: #8b5cf6;
}

.category-badge {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background-color: rgba(255, 255, 255, 0.06);
  color: #9ca3af;
}

:root.light-theme .category-badge {
  background-color: rgba(0, 0, 0, 0.05);
  color: #6b7280;
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.action-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.action-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

:root.light-theme .action-btn:hover {
  background-color: rgba(0, 0, 0, 0.06);
  color: #111827;
}

.action-btn.danger:hover {
  background-color: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.icon-success {
  color: #10b981;
}

.rule-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #f3f4f6;
}

:root.light-theme .rule-title {
  color: #111827;
}

.rule-desc {
  margin: 0;
  font-size: 12px;
  color: #9ca3af;
  line-height: 1.4;
}

.code-preview {
  background-color: #1a1a1c;
  border-radius: 6px;
  padding: 8px 10px;
  font-family: ui-monospace, monospace;
  font-size: 11px;
  color: #d1d5db;
  overflow: hidden;
}

:root.light-theme .code-preview {
  background-color: #f1f5f9;
  color: #334155;
}

.code-preview pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}

.tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag-chip {
  font-size: 11px;
  color: #3b82f6;
  background-color: rgba(59, 130, 246, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
}
</style>

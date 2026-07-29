<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { Check, ChevronDown, ChevronUp, Copy, Edit3, Eye, EyeOff, Key, Lock, Shield, Trash2, User, ExternalLink } from "@lucide/vue";
import { useVault } from "../../composables/useVault";
import type { VaultCredentialType, VaultItemDetail, VaultItemSummary } from "../../types";

const { fetchDetail } = useVault();

const props = defineProps<{
  item: VaultItemSummary;
}>();

const emit = defineEmits<{
  (e: "edit", id: string): void;
  (e: "delete", id: string): void;
  (e: "copy-toast", msg: string): void;
}>();

const { t } = useI18n();

const isDetailExpanded = ref(false);
const detailData = ref<VaultItemDetail | null>(null);
const loadingDetail = ref(false);
const visibleFields = ref<Record<string, boolean>>({});
const copiedFields = ref<Record<string, boolean>>({});

function toggleVisibility(field: string) {
  visibleFields.value[field] = !visibleFields.value[field];
}

async function toggleExpand() {
  if (isDetailExpanded.value) {
    isDetailExpanded.value = false;
    visibleFields.value = {};
    return;
  }
  
  loadingDetail.value = true;
  try {
    detailData.value = await fetchDetail(props.item.id);
    isDetailExpanded.value = true;
  } catch (e: any) {
    emit("copy-toast", e.message || "获取详情失败");
  } finally {
    loadingDetail.value = false;
  }
}

async function copyText(text: string | undefined, fieldName: string, toastMsg: string) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    copiedFields.value[fieldName] = true;
    emit("copy-toast", toastMsg);
    setTimeout(() => {
      copiedFields.value[fieldName] = false;
    }, 2000);
  } catch (e: any) {
    emit("copy-toast", e.message || "复制失败");
  }
}

async function quickCopyPrimary() {
  loadingDetail.value = true;
  try {
    const detail = await fetchDetail(props.item.id);
    detailData.value = detail;
    const p = detail.payload;
    if (props.item.credentialType === "api_key" && p.apiKey) {
      await copyText(p.apiKey, "key", t("vault.copySuccess"));
    } else if (props.item.credentialType === "secret_pair" && p.secretKey) {
      await copyText(p.secretKey, "secretKey", t("vault.copySuccess"));
    } else if (props.item.credentialType === "user_password" && p.password) {
      await copyText(p.password, "password", t("vault.copySuccess"));
    } else if (p.apiKey) {
      await copyText(p.apiKey, "key", t("vault.copySuccess"));
    }
  } catch (e: any) {
    emit("copy-toast", e.message || "复制失败");
  } finally {
    loadingDetail.value = false;
  }
}
</script>

<template>
  <div class="vault-card" :class="{ expanded: isDetailExpanded }">
    <div class="card-header">
      <div class="service-info">
        <div class="service-icon">
          <img v-if="item.iconUrl" :src="item.iconUrl" alt="" />
          <Shield v-else-if="item.credentialType === 'api_key'" :size="20" />
          <Key v-else-if="item.credentialType === 'secret_pair'" :size="20" />
          <User v-else-if="item.credentialType === 'user_password'" :size="20" />
          <Lock v-else :size="20" />
        </div>
        <div class="title-meta">
          <div class="service-title-row">
            <span class="service-name">{{ item.serviceName }}</span>
            <span class="type-badge">{{ t(`vault.types.${item.credentialType}`) }}</span>
          </div>
          <div class="item-title" v-if="item.title && item.title !== item.serviceName">{{ item.title }}</div>
        </div>
      </div>

      <div class="card-actions">
        <button
          class="btn-icon-action"
          :title="isDetailExpanded ? t('common.cancel') : t('common.edit')"
          @click="toggleExpand"
        >
          <ChevronUp v-if="isDetailExpanded" :size="16" />
          <ChevronDown v-else :size="16" />
        </button>
        <button
          class="btn-icon-action"
          :title="t('common.edit')"
          @click="$emit('edit', item.id)"
        >
          <Edit3 :size="16" />
        </button>
        <button
          class="btn-icon-action danger"
          :title="t('common.delete')"
          @click="$emit('delete', item.id)"
        >
          <Trash2 :size="16" />
        </button>
      </div>
    </div>

    <!-- Preview line -->
    <div v-if="!isDetailExpanded" class="card-preview">
      <span class="preview-text">{{ item.preview || "••••••••••••" }}</span>
    </div>

    <!-- Expanded Detail Payload -->
    <div v-else-if="detailData" class="card-body">
      <!-- Single API Key -->
      <div v-if="detailData.payload.apiKey" class="field-row">
        <label>{{ t('vault.apiKey') }}:</label>
        <div class="secret-box">
          <input
            :type="visibleFields['apiKey'] ? 'text' : 'password'"
            readonly
            :value="detailData.payload.apiKey"
          />
          <button class="icon-btn" @click="toggleVisibility('apiKey')" :title="visibleFields['apiKey'] ? t('auth.hidePassword') : t('auth.showPassword')">
            <EyeOff v-if="visibleFields['apiKey']" :size="14" />
            <Eye v-else :size="14" />
          </button>
          <button class="icon-btn" @click="copyText(detailData.payload.apiKey, 'apiKey', t('vault.copySuccess'))" :title="t('vault.copyKey')">
            <Check v-if="copiedFields['apiKey']" :size="14" class="icon-success" />
            <Copy v-else :size="14" />
          </button>
        </div>
      </div>

      <template v-if="detailData.payload.secretId || detailData.payload.secretKey">
        <div v-if="detailData.payload.secretId" class="field-row">
          <label>{{ t('vault.secretId') }}:</label>
          <div class="secret-box">
            <input type="text" readonly :value="detailData.payload.secretId" />
            <button class="icon-btn" @click="copyText(detailData.payload.secretId, 'secretId', t('vault.copySuccess'))">
              <Check v-if="copiedFields['secretId']" :size="14" class="icon-success" />
              <Copy v-else :size="14" />
            </button>
          </div>
        </div>
        <div v-if="detailData.payload.secretKey" class="field-row">
          <label>{{ t('vault.secretKey') }}:</label>
          <div class="secret-box">
            <input
              :type="visibleFields['secretKey'] ? 'text' : 'password'"
              readonly
              :value="detailData.payload.secretKey"
            />
            <button class="icon-btn" @click="toggleVisibility('secretKey')" :title="visibleFields['secretKey'] ? t('auth.hidePassword') : t('auth.showPassword')">
              <EyeOff v-if="visibleFields['secretKey']" :size="14" />
              <Eye v-else :size="14" />
            </button>
            <button class="icon-btn" @click="copyText(detailData.payload.secretKey, 'secretKey', t('vault.copySuccess'))">
              <Check v-if="copiedFields['secretKey']" :size="14" class="icon-success" />
              <Copy v-else :size="14" />
            </button>
          </div>
        </div>
      </template>

      <template v-if="detailData.payload.username || detailData.payload.password">
        <div v-if="detailData.payload.username" class="field-row">
          <label>{{ t('vault.username') }}:</label>
          <div class="secret-box">
            <input type="text" readonly :value="detailData.payload.username" />
            <button class="icon-btn" @click="copyText(detailData.payload.username, 'username', t('vault.copySuccess'))">
              <Check v-if="copiedFields['username']" :size="14" class="icon-success" />
              <Copy v-else :size="14" />
            </button>
          </div>
        </div>
        <div v-if="detailData.payload.password" class="field-row">
          <label>{{ t('vault.password') }}:</label>
          <div class="secret-box">
            <input
              :type="visibleFields['password'] ? 'text' : 'password'"
              readonly
              :value="detailData.payload.password"
            />
            <button class="icon-btn" @click="toggleVisibility('password')" :title="visibleFields['password'] ? t('auth.hidePassword') : t('auth.showPassword')">
              <EyeOff v-if="visibleFields['password']" :size="14" />
              <Eye v-else :size="14" />
            </button>
            <button class="icon-btn" @click="copyText(detailData.payload.password, 'password', t('vault.copySuccess'))">
              <Check v-if="copiedFields['password']" :size="14" class="icon-success" />
              <Copy v-else :size="14" />
            </button>
          </div>
        </div>
      </template>

      <!-- Website URL -->
      <div v-if="detailData.payload.websiteUrl" class="field-row">
        <label>{{ t('vault.websiteUrl') }}:</label>
        <div class="url-box">
          <a :href="detailData.payload.websiteUrl" target="_blank" rel="noopener">
            {{ detailData.payload.websiteUrl }}
            <ExternalLink :size="12" />
          </a>
        </div>
      </div>

      <!-- Custom Fields -->
      <div
        v-for="(cf, idx) in detailData.payload.customFields || []"
        :key="idx"
        class="field-row"
      >
        <label>{{ cf.key }}:</label>
        <div class="secret-box">
          <input :type="visibleFields['cf_' + idx] ? 'text' : 'password'" readonly :value="cf.value" />
          <button class="icon-btn" @click="toggleVisibility('cf_' + idx)" :title="visibleFields['cf_' + idx] ? t('auth.hidePassword') : t('auth.showPassword')">
            <EyeOff v-if="visibleFields['cf_' + idx]" :size="14" />
            <Eye v-else :size="14" />
          </button>
          <button class="icon-btn" @click="copyText(cf.value, 'cf_' + idx, t('vault.copySuccess'))">
            <Check v-if="copiedFields['cf_' + idx]" :size="14" class="icon-success" />
            <Copy v-else :size="14" />
          </button>
        </div>
      </div>

      <!-- Notes -->
      <div v-if="detailData.payload.notes" class="field-notes">
        <label>{{ t('vault.notes') }}:</label>
        <p>{{ detailData.payload.notes }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vault-card {
  background-color: #242426;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 14px 16px;
  transition: all 0.2s ease;
  color: #f3f4f6;
}

:root.light-theme .vault-card {
  background-color: #f9f9fb;
  border-color: rgba(0, 0, 0, 0.06);
  color: #111827;
}

.vault-card:hover {
  border-color: rgba(255, 255, 255, 0.18);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
}

:root.light-theme .vault-card:hover {
  border-color: rgba(0, 0, 0, 0.12);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.service-info {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.service-icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background-color: #2c2c2e;
  display: flex;
  align-items: center;
  justify-content: center;
  color: inherit;
  flex-shrink: 0;
  overflow: hidden;
}

:root.light-theme .service-icon {
  background-color: #e5e7eb;
}

.service-icon img {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

.title-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.service-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.service-name {
  font-weight: 600;
  font-size: 15px;
  color: var(--text-primary);
}

.type-badge {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 6px;
  background-color: var(--bg-tertiary);
  color: var(--text-secondary);
  font-weight: 500;
}

.item-title {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn-icon-action {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.btn-icon-action:hover {
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
}

.btn-icon-action.danger:hover {
  background-color: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.icon-success {
  color: #10b981;
}

.card-preview {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--border-subtle);
  font-family: monospace;
  font-size: 13px;
  color: var(--text-secondary);
  letter-spacing: 1px;
}

.card-body {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.field-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-row label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}

.secret-box {
  display: flex;
  align-items: center;
  background-color: var(--bg-primary);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 4px 8px;
}

.secret-box input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-family: monospace;
  font-size: 13px;
  outline: none;
}

.secret-box button {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
}

.secret-box button:hover {
  color: var(--text-primary);
  background-color: var(--bg-secondary);
}

.url-box a {
  font-size: 13px;
  color: var(--accent-color, #3b82f6);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.url-box a:hover {
  text-decoration: underline;
}

.field-notes {
  background-color: var(--bg-primary);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.field-notes label {
  font-weight: 600;
  display: block;
  margin-bottom: 2px;
}
</style>

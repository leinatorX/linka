<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Plus, Trash2, X } from "@lucide/vue";
import type { VaultCredentialType, VaultItemDetail } from "../../types";

const props = defineProps<{
  initialData?: VaultItemDetail | null;
  saving?: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "save", payload: any, id?: string): void;
}>();

const { t } = useI18n();

const serviceName = ref("");
const title = ref("");
const category = ref("ai_provider");
const credentialType = ref<VaultCredentialType>("api_key");
const iconUrl = ref("");
const tagsInput = ref("");

// Payload fields
const apiKey = ref("");
const secretId = ref("");
const secretKey = ref("");
const username = ref("");
const password = ref("");
const websiteUrl = ref("");
const customFields = ref<Array<{ key: string; value: string }>>([]);
const notes = ref("");

watch(
  () => props.initialData,
  (val) => {
    if (val) {
      serviceName.value = val.serviceName || "";
      title.value = val.title || "";
      category.value = val.category || "ai_provider";
      credentialType.value = val.credentialType || "custom";
      iconUrl.value = val.iconUrl || "";
      tagsInput.value = (val.tags || []).join(", ");
      
      const p = val.payload || {};
      apiKey.value = p.apiKey || "";
      secretId.value = p.secretId || "";
      secretKey.value = p.secretKey || "";
      username.value = p.username || "";
      password.value = p.password || "";
      websiteUrl.value = p.websiteUrl || "";
      customFields.value = p.customFields ? [...p.customFields] : [];
      notes.value = p.notes || "";
    } else {
      resetForm();
    }
  },
  { immediate: true }
);

function resetForm() {
  serviceName.value = "";
  title.value = "";
  category.value = "ai_provider";
  credentialType.value = "custom";
  iconUrl.value = "";
  tagsInput.value = "";
  apiKey.value = "";
  secretId.value = "";
  secretKey.value = "";
  username.value = "";
  password.value = "";
  websiteUrl.value = "";
  customFields.value = [];
  notes.value = "";
}

function addCustomField() {
  customFields.value.push({ key: "", value: "" });
}

function removeCustomField(index: number) {
  customFields.value.splice(index, 1);
}

function handleSave() {
  if (!serviceName.value.trim()) return;
  
  const tags: string[] = [];
    
  const payload: any = {
    apiKey: apiKey.value || undefined,
    secretId: secretId.value || undefined,
    secretKey: secretKey.value || undefined,
    username: username.value || undefined,
    password: password.value || undefined,
    websiteUrl: websiteUrl.value || undefined,
    customFields: customFields.value.filter((cf) => cf.key.trim()),
    notes: notes.value || undefined
  };
  
  const itemData = {
    serviceName: serviceName.value.trim(),
    title: serviceName.value.trim(),
    category: category.value,
    credentialType: credentialType.value,
    iconUrl: iconUrl.value.trim(),
    tags,
    payload
  };
  
  emit("save", itemData, props.initialData?.id);
}
</script>

<template>
  <div class="modal-overlay">
    <div class="modal-card">
      <div class="modal-header">
        <h3>{{ initialData ? t('vault.editItem') : t('vault.newItem') }}</h3>
        <button class="close-btn" @click="$emit('close')">
          <X :size="18" />
        </button>
      </div>

      <div class="modal-body">
        <div class="form-row gap-2">
          <div class="form-group flex-1">
            <label>{{ t('vault.serviceName') }} *</label>
            <input
              v-model="serviceName"
              type="text"
              :placeholder="t('vault.serviceNamePlaceholder')"
              required
            />
          </div>
        </div>

        <div class="form-row gap-2">
          <div class="form-group flex-1">
            <label>{{ t('vault.category') }}</label>
            <select v-model="category">
              <option value="ai_provider">{{ t('vault.categories.ai_provider') }}</option>
              <option value="cloud_service">{{ t('vault.categories.cloud_service') }}</option>
              <option value="account_login">{{ t('vault.categories.account_login') }}</option>
              <option value="custom">{{ t('vault.categories.custom') }}</option>
            </select>
          </div>
          <div class="form-group flex-1">
            <label>{{ t('vault.credentialType') }}</label>
            <select v-model="credentialType">
              <option v-if="credentialType === 'api_key'" value="api_key">{{ t('vault.types.api_key') }}</option>
              <option value="secret_pair">{{ t('vault.types.secret_pair') }}</option>
              <option value="user_password">{{ t('vault.types.user_password') }}</option>
              <option value="custom">{{ t('vault.types.custom') }}</option>
            </select>
          </div>
        </div>

        <!-- Dynamic Inputs based on type -->
        <div v-if="credentialType === 'api_key'" class="form-group">
          <label>{{ t('vault.apiKey') }}</label>
          <input
            v-model="apiKey"
            type="text"
            :placeholder="t('vault.apiKeyPlaceholder')"
          />
        </div>

        <template v-else-if="credentialType === 'secret_pair'">
          <div class="form-group">
            <label>{{ t('vault.secretId') }}</label>
            <input v-model="secretId" type="text" placeholder="AKIA..." />
          </div>
          <div class="form-group">
            <label>{{ t('vault.secretKey') }}</label>
            <input v-model="secretKey" type="text" placeholder="..." />
          </div>
        </template>

        <template v-else-if="credentialType === 'user_password'">
          <div class="form-group">
            <label>{{ t('vault.username') }}</label>
            <input v-model="username" type="text" placeholder="admin@example.com" />
          </div>
          <div class="form-group">
            <label>{{ t('vault.password') }}</label>
            <input v-model="password" type="password" placeholder="••••••••" />
          </div>
          <div class="form-group">
            <label>{{ t('vault.websiteUrl') }}</label>
            <input v-model="websiteUrl" type="url" placeholder="https://example.com/login" />
          </div>
        </template>

        <!-- Custom Fields & Notes -->
        <div class="custom-fields-section">
          <div class="section-title">
            <span>{{ t('vault.customFields') }}</span>
            <button class="add-field-btn" @click="addCustomField">
              <Plus :size="14" />
              <span>{{ t('vault.addCustomField') }}</span>
            </button>
          </div>

          <div
            v-for="(cf, idx) in customFields"
            :key="idx"
            class="custom-field-row"
          >
            <input
              v-model="cf.key"
              type="text"
              :placeholder="t('vault.fieldName')"
              class="flex-1"
            />
            <input
              v-model="cf.value"
              type="text"
              :placeholder="t('vault.fieldValue')"
              class="flex-2"
            />
            <button class="remove-field-btn" @click="removeCustomField(idx)">
              <Trash2 :size="14" />
            </button>
          </div>
        </div>

        <div class="form-group">
          <label>{{ t('vault.notes') }}</label>
          <textarea
            v-model="notes"
            rows="3"
            :placeholder="t('vault.notesPlaceholder')"
          ></textarea>
        </div>


      </div>

      <div class="modal-footer">
        <button class="btn-secondary" @click="$emit('close')">
          {{ t('common.cancel') }}
        </button>
        <button class="btn-primary" :disabled="saving" @click="handleSave">
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
  z-index: 1050;
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
  /* 默认暗色模式 100% 实色 */
  background-color: #161618;
  color: #f3f4f6;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  width: 100%;
  max-width: 840px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 40px -5px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

/* 4K / 大屏自动放大 */
@media (min-width: 1800px) {
  .modal-card {
    max-width: 1000px;
  }
}

/* 小屏几乎全屏 */
@media (max-width: 768px) {
  .modal-card {
    width: 96vw;
    max-height: 95vh;
    border-radius: 12px;
  }
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

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: inherit;
}

.close-btn {
  border: none;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
}

:root.light-theme .close-btn {
  color: #6b7280;
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
  gap: 18px;
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
.form-group select,
.form-group textarea {
  background-color: #242426;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 8px 12px;
  color: #ffffff;
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s ease;
}

:root.light-theme .form-group input,
:root.light-theme .form-group select,
:root.light-theme .form-group textarea {
  background-color: #f3f4f6;
  border-color: rgba(0, 0, 0, 0.1);
  color: #111827;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  border-color: #3b82f6;
}

.custom-fields-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 600;
  color: inherit;
}

.add-field-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: transparent;
  color: #3b82f6;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}

.custom-field-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.custom-field-row input {
  background-color: #242426;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 6px 10px;
  color: #ffffff;
  font-size: 13px;
  outline: none;
}

:root.light-theme .custom-field-row input {
  background-color: #f3f4f6;
  border-color: rgba(0, 0, 0, 0.1);
  color: #111827;
}

.remove-field-btn {
  border: none;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
}

.remove-field-btn:hover {
  color: #ef4444;
  background-color: rgba(239, 68, 68, 0.1);
}

.modal-footer {
  padding: 18px 24px;
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
  padding: 10px 22px;
  border-radius: 8px;
  font-weight: 500;
  font-size: 14px;
  cursor: pointer;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background-color: #242426;
  color: #9ca3af;
  border: 1px solid rgba(255, 255, 255, 0.12);
  padding: 10px 22px;
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

<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Eye, EyeOff, KeyRound, Lock, Plus, Search, ShieldCheck, Unlock, X } from "@lucide/vue";
import { useVault } from "../../composables/useVault";
import VaultItemCard from "./VaultItemCard.vue";
import VaultItemEditModal from "./VaultItemEditModal.vue";
import type { VaultItemDetail } from "../../types";

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "show-toast", msg: string): void;
}>();

const { t } = useI18n();

const {
  isInitialized,
  isUnlocked,
  items,
  searchInput,
  selectedCategory,
  loading,
  errorMsg,
  checkStatus,
  initialize,
  unlock,
  lock,
  reset,
  fetchDetail,
  saveItem,
  removeItem
} = useVault();

const masterPassword = ref("");
const confirmMasterPassword = ref("");
const formError = ref("");
const showPassword = ref(false);

const showEditModal = ref(false);
const editingDetail = ref<VaultItemDetail | null>(null);
const isSaving = ref(false);

const showResetConfirm = ref(false);
const loginPassword = ref("");
const resetError = ref("");

// 每次弹窗打开时检查状态，关闭时自动锁定
watch(() => props.show, (newVal) => {
  if (newVal) {
    formError.value = "";
    masterPassword.value = "";
    confirmMasterPassword.value = "";
    checkStatus();
  } else {
    // 关闭弹窗时自动锁定保险箱，确保下次打开需要重新输入主密码
    lock();
  }
}, { immediate: true });

async function handleUnlock() {
  if (!masterPassword.value) return;
  formError.value = "";
  try {
    await unlock(masterPassword.value);
    masterPassword.value = "";
  } catch (e: any) {
    formError.value = e.message || t("vault.passwordMismatch");
  }
}

async function handleSetup() {
  formError.value = "";
  if (masterPassword.value.length < 6) {
    formError.value = t("vault.masterPasswordMinLength");
    return;
  }
  if (masterPassword.value !== confirmMasterPassword.value) {
    formError.value = t("vault.passwordMismatch");
    return;
  }
  try {
    await initialize(masterPassword.value);
    masterPassword.value = "";
    confirmMasterPassword.value = "";
  } catch (e: any) {
    formError.value = e.message || "初始化失败";
  }
}

async function handleLock() {
  await lock();
  masterPassword.value = "";
  confirmMasterPassword.value = "";
  formError.value = "";
}

function openResetConfirm() {
  showResetConfirm.value = true;
  loginPassword.value = "";
  resetError.value = "";
}

function closeResetConfirm() {
  showResetConfirm.value = false;
  loginPassword.value = "";
  resetError.value = "";
}

async function executeReset() {
  if (!loginPassword.value) {
    resetError.value = "请输入当前登录密码";
    return;
  }
  try {
    await reset(loginPassword.value);
    closeResetConfirm();
    emit("show-toast", "保险箱已注销并重置");
  } catch (e: any) {
    resetError.value = e.message || "注销失败";
  }
}

function openNewModal() {
  editingDetail.value = null;
  showEditModal.value = true;
}

async function openEditModal(id: string) {
  try {
    editingDetail.value = await fetchDetail(id);
    showEditModal.value = true;
  } catch (e: any) {
    emit("show-toast", e.message || "无法加载凭据数据");
  }
}

async function handleDelete(id: string) {
  if (!confirm(t("vault.deleteConfirm"))) return;
  try {
    await removeItem(id);
    emit("show-toast", t("common.success"));
  } catch (e: any) {
    emit("show-toast", e.message || t("common.error"));
  }
}

async function handleSaveItem(payload: any, id?: string) {
  isSaving.value = true;
  try {
    await saveItem(payload, id);
    showEditModal.value = false;
    emit("show-toast", t("common.success"));
  } catch (e: any) {
    emit("show-toast", e.message || t("common.error"));
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <div v-if="show" class="modal-overlay">
    <div class="vault-container-card">
      <!-- Top Bar Header -->
      <div class="vault-header">
        <div class="header-title">
          <ShieldCheck class="brand-icon" :size="22" />
          <span>{{ t('vault.title') }}</span>
        </div>
        <div class="header-right">
          <button
            v-if="isUnlocked"
            class="btn-header-action"
            :title="t('vault.lock')"
            @click="handleLock"
          >
            <Lock :size="16" />
            <span>{{ t('vault.lock') }}</span>
          </button>
          <button class="close-btn" @click="$emit('close')">
            <X :size="20" />
          </button>
        </div>
      </div>

      <!-- State 1: Not Initialized -->
      <div v-if="!isInitialized" class="auth-box">
        <div class="auth-icon-wrapper">
          <KeyRound :size="36" />
        </div>
        <h3>{{ t('vault.setupTitle') }}</h3>
        <p class="auth-desc">{{ t('vault.setupDesc') }}</p>

        <form class="auth-form" @submit.prevent="handleSetup">
          <div class="form-group">
            <label>{{ t('vault.masterPassword') }}</label>
            <div class="password-input-wrapper">
              <input
                v-model="masterPassword"
                :type="showPassword ? 'text' : 'password'"
                :placeholder="t('auth.passwordPlaceholder')"
                required
              />
              <button type="button" class="eye-btn" @click="showPassword = !showPassword">
                <EyeOff v-if="showPassword" :size="16" />
                <Eye v-else :size="16" />
              </button>
            </div>
          </div>

          <div class="form-group">
            <label>{{ t('vault.confirmMasterPassword') }}</label>
            <div class="password-input-wrapper">
              <input
                v-model="confirmMasterPassword"
                :type="showPassword ? 'text' : 'password'"
                :placeholder="t('auth.passwordPlaceholder')"
                required
              />
            </div>
          </div>

          <div v-if="formError" class="error-msg">{{ formError }}</div>

          <button class="btn-primary-block" :disabled="loading" type="submit">
            {{ t('vault.setupBtn') }}
          </button>
        </form>
      </div>

      <!-- State 2: Locked -->
      <div v-else-if="!isUnlocked" class="auth-box">
        <div class="auth-icon-wrapper locked">
          <Lock :size="36" />
        </div>
        <h3>{{ t('vault.unlockTitle') }}</h3>
        <p class="auth-desc">{{ t('vault.unlockDesc') }}</p>

        <form class="auth-form" @submit.prevent="handleUnlock">
          <div class="form-group">
            <label>{{ t('vault.masterPassword') }}</label>
            <div class="password-input-wrapper">
              <input
                v-model="masterPassword"
                :type="showPassword ? 'text' : 'password'"
                :placeholder="t('auth.passwordPlaceholder')"
                autofocus
                required
              />
              <button type="button" class="eye-btn" @click="showPassword = !showPassword">
                <EyeOff v-if="showPassword" :size="16" />
                <Eye v-else :size="16" />
              </button>
            </div>
          </div>

          <div v-if="formError" class="error-msg">{{ formError }}</div>

          <button class="btn-primary-block" :disabled="loading" type="submit">
            <Unlock :size="16" />
            <span>{{ t('vault.unlock') }}</span>
          </button>

          <div class="reset-wrapper">
            <button type="button" class="btn-text-danger" @click="openResetConfirm">
              忘记密码？注销并清空保险箱
            </button>
          </div>
        </form>
      </div>

      <!-- State 3: Unlocked Vault List -->
      <div v-else class="vault-content">
        <!-- Search & Control Bar -->
        <div class="controls-bar">
          <div class="search-box">
            <Search :size="16" />
            <input
              v-model="searchInput"
              type="text"
              :placeholder="t('vault.searchPlaceholder')"
            />
          </div>
          <button class="btn-add" @click="openNewModal">
            <Plus :size="16" />
            <span>{{ t('vault.newItem') }}</span>
          </button>
        </div>

        <!-- Filter Categories Tabs -->
        <div class="category-tabs">
          <button
            class="tab-btn"
            :class="{ active: selectedCategory === 'all' }"
            @click="selectedCategory = 'all'"
          >
            {{ t('vault.categories.all') }}
          </button>
          <button
            class="tab-btn"
            :class="{ active: selectedCategory === 'ai_provider' }"
            @click="selectedCategory = 'ai_provider'"
          >
            {{ t('vault.categories.ai_provider') }}
          </button>
          <button
            class="tab-btn"
            :class="{ active: selectedCategory === 'cloud_service' }"
            @click="selectedCategory = 'cloud_service'"
          >
            {{ t('vault.categories.cloud_service') }}
          </button>
          <button
            class="tab-btn"
            :class="{ active: selectedCategory === 'account_login' }"
            @click="selectedCategory = 'account_login'"
          >
            {{ t('vault.categories.account_login') }}
          </button>
          <button
            class="tab-btn"
            :class="{ active: selectedCategory === 'custom' }"
            @click="selectedCategory = 'custom'"
          >
            {{ t('vault.categories.custom') }}
          </button>
        </div>

        <!-- Items Grid / List -->
        <div class="items-scroll-area">
          <div v-if="loading && items.length === 0" class="empty-state">
            <span>{{ t('auth.checkingStatus') }}</span>
          </div>

          <div v-else-if="items.length === 0" class="empty-state">
            <ShieldCheck :size="48" class="empty-icon" />
            <p>{{ t('vault.emptyHint') }}</p>
          </div>

          <div v-else class="items-grid">
            <VaultItemCard
              v-for="item in items"
              :key="item.id"
              :item="item"
              @edit="openEditModal"
              @delete="handleDelete"
              @copy-toast="$emit('show-toast', $event)"
            />
          </div>
        </div>
      </div>

      <!-- Add/Edit Modal Child -->
      <VaultItemEditModal
        v-if="showEditModal"
        :initial-data="editingDetail"
        :saving="isSaving"
        @close="showEditModal = false"
        @save="handleSaveItem"
      />
    </div>

    <!-- 自定义注销确认弹窗 -->
    <div v-if="showResetConfirm" class="reset-modal-overlay">
      <div class="reset-modal-card">
        <div class="reset-modal-header">
          <h3>高危操作：注销保险箱</h3>
          <button class="close-btn" @click="closeResetConfirm">
            <X :size="18" />
          </button>
        </div>
        <div class="reset-modal-body">
          <p class="reset-warning-text">
            此操作将<strong>永久删除</strong>保险箱内的【所有凭据数据】，且<strong>无法恢复</strong>！
          </p>
          <div class="reset-form-group">
            <label>当前登录密码：</label>
            <input
              v-model="loginPassword"
              type="password"
              placeholder="请输入当前账号的登录密码"
              autofocus
              @keyup.enter="executeReset"
            />
          </div>
          <div v-if="resetError" class="error-msg" style="margin-top: 8px;">{{ resetError }}</div>
        </div>
        <div class="reset-modal-footer">
          <button class="btn-secondary" @click="closeResetConfirm">
            {{ t('common.cancel') }}
          </button>
          <button class="btn-danger" :disabled="loading" @click="executeReset">
            确认注销
          </button>
        </div>
      </div>
    </div>
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

.vault-container-card {
  /* 默认（暗黑模式）实色 100% 不透明 */
  background-color: #161618;
  color: #f3f4f6;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 20px;
  width: min(90vw, 900px);
  height: min(85vh, 760px);
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 60px -12px rgba(0, 0, 0, 0.7);
  overflow: hidden;
}

/* 明亮模式 100% 实白不透明 */
:root.light-theme .vault-container-card {
  background-color: #ffffff;
  color: #111827;
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 20px 45px -10px rgba(0, 0, 0, 0.18);
}

/* 4K / 大屏 (≥1800px) 自动放大 */
@media (min-width: 1800px) {
  .vault-container-card {
    width: min(70vw, 1200px);
    height: min(80vh, 900px);
  }
}

/* 笔记本小屏 / 平板 (≤768px) 几乎全屏 */
@media (max-width: 768px) {
  .vault-container-card {
    width: 96vw;
    height: 92vh;
    border-radius: 12px;
  }
}

.vault-header {
  padding: 16px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: #1c1c1e;
}

:root.light-theme .vault-header {
  border-bottom-color: rgba(0, 0, 0, 0.06);
  background-color: #fbfbfd;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 18px;
  font-weight: 600;
  color: inherit;
}

.brand-icon {
  color: #3b82f6;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn-header-action {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background-color: #242426;
  color: #9ca3af;
  font-size: 13px;
  padding: 6px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

:root.light-theme .btn-header-action {
  border-color: rgba(0, 0, 0, 0.1);
  background-color: #f3f4f6;
  color: #4b5563;
}

.btn-header-action:hover {
  background-color: #2c2c2e;
  color: #ffffff;
}

:root.light-theme .btn-header-action:hover {
  background-color: #e5e7eb;
  color: #111827;
}

.close-btn {
  border: none;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  padding: 6px;
  border-radius: 8px;
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

/* Auth Section */
.auth-box {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 32px 10vh 32px; /* 底部增加 padding 整体向上推 */
  max-width: 380px;
  margin: 0 auto;
  width: 100%;
  text-align: center;
}

.auth-icon-wrapper {
  width: 68px;
  height: 68px;
  border-radius: 20px;
  background-color: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.auth-icon-wrapper.locked {
  background-color: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}

.auth-box h3 {
  margin: 0 0 8px 0;
  font-size: 20px;
  font-weight: 600;
  color: inherit;
}

.auth-desc {
  font-size: 13px;
  color: #9ca3af;
  margin-bottom: 24px;
  line-height: 1.5;
}

:root.light-theme .auth-desc {
  color: #6b7280;
}

.auth-form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.auth-form .form-group {
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.auth-form label {
  font-size: 13px;
  font-weight: 500;
  color: #9ca3af;
}

:root.light-theme .auth-form label {
  color: #4b5563;
}

.password-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.auth-form input {
  background-color: #242426;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  padding: 10px 40px 10px 14px; /* 右侧留出眼睛图标的空间 */
  color: #ffffff;
  font-size: 14px;
  outline: none;
  width: 100%;
}

:root.light-theme .auth-form input {
  background-color: #f3f4f6;
  border-color: rgba(0, 0, 0, 0.1);
  color: #111827;
}

.eye-btn {
  position: absolute;
  right: 12px;
  background: transparent;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border-radius: 4px;
}

.eye-btn:hover {
  color: #ffffff;
}

:root.light-theme .eye-btn:hover {
  color: #111827;
}

.reset-wrapper {
  margin-top: 16px;
  text-align: center;
}

.btn-text-danger {
  background: transparent;
  border: none;
  color: #6b7280;
  font-size: 12px;
  cursor: pointer;
  transition: color 0.15s ease;
}

.btn-text-danger:hover {
  color: #ef4444;
  text-decoration: underline;
}

/* Reset Modal Styles */
.reset-modal-overlay {
  position: absolute;
  inset: 0;
  z-index: 1060;
  background-color: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

:root.light-theme .reset-modal-overlay {
  background-color: rgba(0, 0, 0, 0.4);
}

.reset-modal-card {
  background-color: #1c1c1e;
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 12px;
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.6), 0 0 20px rgba(239, 68, 68, 0.1);
}

:root.light-theme .reset-modal-card {
  background-color: #ffffff;
  border-color: rgba(239, 68, 68, 0.4);
  box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.2), 0 0 20px rgba(239, 68, 68, 0.1);
}

.reset-modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

:root.light-theme .reset-modal-header {
  border-bottom-color: rgba(0, 0, 0, 0.06);
}

.reset-modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #ef4444;
}

.reset-modal-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
}

.reset-warning-text {
  margin: 0 0 16px 0;
  font-size: 14px;
  color: #d1d5db;
  line-height: 1.5;
}

.reset-warning-text strong {
  color: #ef4444;
}

:root.light-theme .reset-warning-text {
  color: #4b5563;
}

.reset-form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.reset-form-group label {
  font-size: 13px;
  color: #9ca3af;
}

:root.light-theme .reset-form-group label {
  color: #4b5563;
}

.reset-form-group input {
  background-color: #242426;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 10px 14px;
  color: #ffffff;
  font-size: 14px;
  outline: none;
}

:root.light-theme .reset-form-group input {
  background-color: #f3f4f6;
  border-color: rgba(0, 0, 0, 0.1);
  color: #111827;
}

.reset-form-group input:focus {
  border-color: #ef4444;
}

.reset-modal-footer {
  padding: 16px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

:root.light-theme .reset-modal-footer {
  border-top-color: rgba(0, 0, 0, 0.06);
}

.btn-danger {
  background-color: #ef4444;
  color: #ffffff;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: 500;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.btn-danger:hover:not(:disabled) {
  background-color: #dc2626;
}

.btn-danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background-color: #242426;
  color: #9ca3af;
  border: 1px solid rgba(255, 255, 255, 0.12);
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}

:root.light-theme .btn-secondary {
  background-color: #f3f4f6;
  color: #4b5563;
  border-color: rgba(0, 0, 0, 0.1);
}

.auth-form input:focus {
  border-color: #3b82f6;
}

.error-msg {
  color: #ef4444;
  font-size: 13px;
  text-align: left;
}

.btn-primary-block {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background-color: #3b82f6;
  color: #ffffff;
  border: none;
  padding: 11px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s ease;
  margin-top: 6px;
}

.btn-primary-block:hover {
  opacity: 0.9;
}

/* Vault Content Layout */
.vault-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.controls-bar {
  padding: 16px 24px;
  display: flex;
  gap: 12px;
  align-items: center;
}

.search-box {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  background-color: #242426;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  padding: 8px 14px;
  color: #9ca3af;
}

:root.light-theme .search-box {
  background-color: #f3f4f6;
  border-color: rgba(0, 0, 0, 0.1);
  color: #6b7280;
}

.search-box input {
  flex: 1;
  border: none;
  background: transparent;
  color: inherit;
  font-size: 14px;
  outline: none;
}

.btn-add {
  display: flex;
  align-items: center;
  gap: 6px;
  background-color: #3b82f6;
  color: #ffffff;
  border: none;
  padding: 8px 16px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
}

.category-tabs {
  padding: 0 24px 12px 24px;
  display: flex;
  gap: 8px;
  overflow-x: auto;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

:root.light-theme .category-tabs {
  border-bottom-color: rgba(0, 0, 0, 0.06);
}

.tab-btn {
  background: transparent;
  border: none;
  color: #9ca3af;
  font-size: 13px;
  padding: 6px 12px;
  border-radius: 8px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

:root.light-theme .tab-btn {
  color: #6b7280;
}

.tab-btn:hover {
  background-color: rgba(255, 255, 255, 0.05);
  color: #ffffff;
}

:root.light-theme .tab-btn:hover {
  background-color: rgba(0, 0, 0, 0.05);
  color: #111827;
}

.tab-btn.active {
  background-color: #2c2c2e;
  color: #ffffff;
  font-weight: 600;
}

:root.light-theme .tab-btn.active {
  background-color: #e5e7eb;
  color: #111827;
}

.items-scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}

.empty-state {
  height: 100%;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  gap: 12px;
}

:root.light-theme .empty-state {
  color: #6b7280;
}

.empty-icon {
  opacity: 0.3;
}

.items-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>


<script setup lang="ts">
import { Loader2, LogOut, Save, X } from "@lucide/vue";
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import type { AuthUser } from "../../types";
import ImageCropperModal from "../common/ImageCropperModal.vue";

defineProps<{
  user: AuthUser;
  message: string;
  avatarMessage: string;
  isSaving: boolean;
  isAvatarSaving: boolean;
}>();

const username = defineModel<string>("username", { required: true });
const avatarUrl = defineModel<string>("avatarUrl", { required: true });
const currentPassword = defineModel<string>("currentPassword", { required: true });
const newPassword = defineModel<string>("newPassword", { required: true });
const confirmPassword = defineModel<string>("confirmPassword", { required: true });

const emit = defineEmits<{
  save: [];
  saveAvatar: [avatarUrl: string];
  logout: [];
}>();

const { t } = useI18n();

const fileInput = ref<HTMLInputElement | null>(null);
const uploadError = ref("");
const isCropperOpen = ref(false);
const rawAvatarUrl = ref("");

function openFilePicker() {
  fileInput.value?.click();
}

async function onAvatarFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) {
    return;
  }

  uploadError.value = "";
  
  if (!file.type.startsWith("image/")) {
    uploadError.value = "请选择图片文件。";
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result === "string") {
      rawAvatarUrl.value = reader.result;
      isCropperOpen.value = true;
    } else {
      uploadError.value = "读取图片失败。";
    }
  };
  reader.onerror = () => { uploadError.value = "读取图片失败。"; };
  reader.readAsDataURL(file);
}

function onCropConfirm(dataUrl: string) {
  avatarUrl.value = dataUrl;
  emit("saveAvatar", dataUrl);
  isCropperOpen.value = false;
  rawAvatarUrl.value = "";
}

function onCropCancel() {
  isCropperOpen.value = false;
  rawAvatarUrl.value = "";
}

function clearAvatar() {
  avatarUrl.value = "";
  emit("saveAvatar", "");
}
</script>

<template>
  <section>
    <!-- macOS style header -->
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 12px 0 32px;">
      <div class="account-avatar-wrapper" style="position: relative; margin-bottom: 16px; width: 88px; height: 88px;">
        <button type="button" class="account-avatar-preview" :title="t('settings.account.uploadAvatar')" :disabled="isAvatarSaving" @click="openFilePicker" style="width: 100%; height: 100%; border-radius: 50%; font-size: 36px; padding: 0; overflow: hidden; background: var(--bg-surface-elevated, rgba(255,255,255,0.05)); border: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text-primary); transition: all 0.2s;">
          <img v-if="avatarUrl" :src="avatarUrl" alt="" style="width: 100%; height: 100%; object-fit: cover;" />
          <Loader2 v-else-if="isAvatarSaving" class="spin" :size="32" />
          <span v-else>{{ username.slice(0, 1).toUpperCase() || "U" }}</span>
        </button>
        <button v-if="avatarUrl" type="button" class="account-avatar-clear" :title="t('settings.account.clear')" :disabled="isAvatarSaving" @click="clearAvatar" style="position: absolute; top: -2px; right: -2px; z-index: 10; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text-secondary); transition: all 0.2s;">
          <X :size="14" />
        </button>
        <input ref="fileInput" class="visually-hidden" type="file" accept="image/*" @change="onAvatarFileChange" />
      </div>

      <h2 style="margin: 0 0 6px; font-size: 22px; font-weight: 600; color: var(--text-primary); letter-spacing: -0.3px;">{{ user.username }}</h2>
      <p style="margin: 0; font-size: 14px; color: var(--text-secondary);">{{ t('settings.account.desc', { username: user.username }) }}</p>

      <small v-if="uploadError" class="field-error" style="margin-top: 12px;">{{ uploadError }}</small>
      <small v-else-if="avatarMessage" class="settings-message" style="margin-top: 12px; color: var(--success, #10b981);">{{ avatarMessage }}</small>
    </div>

    <!-- Login & Security Section -->
    <div class="settings-section-title">
      <h3>{{ t('settings.account.title') }}</h3>
    </div>

    <div class="settings-list-group">
      <div class="settings-list-item">
        <div class="settings-item-label">
          <div class="settings-item-title">{{ t('settings.account.username') }}</div>
        </div>
        <div class="settings-item-control">
          <input v-model="username" autocomplete="username" />
        </div>
      </div>

      <div class="settings-list-item">
        <div class="settings-item-label">
          <div class="settings-item-title">{{ t('settings.account.currentPassword') }}</div>
        </div>
        <div class="settings-item-control">
          <input v-model="currentPassword" type="password" autocomplete="current-password" :placeholder="t('settings.account.currentPasswordPlaceholder')" />
        </div>
      </div>

      <div class="settings-list-item">
        <div class="settings-item-label">
          <div class="settings-item-title">{{ t('settings.account.newPassword') }}</div>
        </div>
        <div class="settings-item-control">
          <input v-model="newPassword" type="password" autocomplete="new-password" :placeholder="t('settings.account.newPasswordPlaceholder')" />
        </div>
      </div>

      <div class="settings-list-item">
        <div class="settings-item-label">
          <div class="settings-item-title">{{ t('settings.account.confirmPassword') }}</div>
        </div>
        <div class="settings-item-control">
          <input v-model="confirmPassword" type="password" autocomplete="new-password" :placeholder="t('settings.account.confirmPasswordPlaceholder')" />
        </div>
      </div>
      
      <div class="settings-list-item" style="background: rgba(0,0,0,0.02); justify-content: space-between; align-items: center;">
        <div>
           <p v-if="message" class="settings-message" style="margin: 0; font-size: 13px;">{{ message }}</p>
        </div>
        <div class="settings-item-control">
          <button type="button" class="btn-primary" :disabled="isSaving" @click="$emit('save')">
            <Loader2 v-if="isSaving" class="spin" :size="16" />
            <Save v-else :size="16" />
            <span>{{ t('settings.account.saveAccount') }}</span>
          </button>
        </div>
      </div>
    </div>
    
    <!-- Logout button at the bottom -->
    <div style="display: flex; justify-content: center; margin-top: 48px; padding-bottom: 24px;">
      <button type="button" class="btn-secondary" style="padding: 0 20px; height: 36px; border-radius: 8px; display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 500; background: var(--bg-surface); color: var(--danger); transition: all 0.2s;" @click="$emit('logout')">
        <LogOut :size="16" />
        <span>{{ t('settings.account.logout') }}</span>
      </button>
    </div>

    <!-- Cropper Modal -->
    <ImageCropperModal
      :isOpen="isCropperOpen"
      :imageUrl="rawAvatarUrl"
      @crop="onCropConfirm"
      @cancel="onCropCancel"
    />
  </section>
</template>

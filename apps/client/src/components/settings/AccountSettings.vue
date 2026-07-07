<script setup lang="ts">
import { Loader2, LogOut, Save, X } from "@lucide/vue";
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import type { AuthUser } from "../../types";
import { readAvatarFileAsDataUrl } from "../../utils/imageInput";

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
  try {
    const nextAvatarUrl = await readAvatarFileAsDataUrl(file);
    avatarUrl.value = nextAvatarUrl;
    emit("saveAvatar", nextAvatarUrl);
  } catch (error) {
    uploadError.value = error instanceof Error ? error.message : t('settings.account.readAvatarFailed');
  }
}

function clearAvatar() {
  avatarUrl.value = "";
  emit("saveAvatar", "");
}
</script>

<template>
  <section>
    <div class="settings-section-title" style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 12px; margin-top: 8px;">
      <div>
        <h3>{{ t('settings.account.title') }}</h3>
        <p style="margin: 6px 0 0; font-size: 13px; color: var(--text-secondary); text-transform: none; letter-spacing: 0; font-weight: normal;">{{ t('settings.account.desc', { username: user.username }) }}</p>
      </div>
      <button type="button" class="btn-secondary" style="height: 32px; font-size: 13px; padding: 0 12px; border-radius: var(--radius-sm); margin-bottom: 2px; display: flex; align-items: center; gap: 6px;" @click="$emit('logout')">
        <LogOut :size="14" />
        <span>{{ t('settings.account.logout') }}</span>
      </button>
    </div>

    <div class="settings-list-group">
      <div class="settings-list-item" style="align-items: center; padding-top: 20px; padding-bottom: 20px;">
        <div class="settings-item-label">
          <div class="settings-item-title">{{ t('settings.account.avatar') }}</div>
          <small v-if="uploadError" class="field-error" style="margin-top: 8px; display: block;">{{ uploadError }}</small>
          <small v-else-if="avatarMessage" class="settings-message" style="margin-top: 8px; display: block;">{{ avatarMessage }}</small>
        </div>
        <div class="settings-item-control">
          <div class="account-avatar-row">
            <div class="account-avatar-wrapper">
              <button type="button" class="account-avatar-preview" :title="t('settings.account.uploadAvatar')" :disabled="isAvatarSaving" @click="openFilePicker">
                <img v-if="avatarUrl" :src="avatarUrl" alt="" />
                <Loader2 v-else-if="isAvatarSaving" class="spin" :size="22" />
                <span v-else>{{ username.slice(0, 1).toUpperCase() || "U" }}</span>
                <small>{{ isAvatarSaving ? t('settings.account.saving') : t('settings.account.upload') }}</small>
              </button>
              <button v-if="avatarUrl" type="button" class="account-avatar-clear" :title="t('settings.account.clear')" :disabled="isAvatarSaving" @click="clearAvatar">
                <X :size="12" />
              </button>
            </div>
            <input ref="fileInput" class="visually-hidden" type="file" accept="image/*" @change="onAvatarFileChange" />
          </div>
        </div>
      </div>

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
  </section>
</template>

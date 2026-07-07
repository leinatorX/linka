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
    <div class="grand-panel account-panel settings-form">
      <div class="section-title account-title">
        <div>
          <h3>{{ t('settings.account.title') }}</h3>
          <p>{{ t('settings.account.desc', { username: user.username }) }}</p>
        </div>
        <button type="button" class="btn-secondary" @click="$emit('logout')">
          <LogOut :size="16" />
          <span>{{ t('settings.account.logout') }}</span>
        </button>
      </div>

      <div class="account-form-grid">
        <div class="account-avatar-field">
          <span>{{ t('settings.account.avatar') }}</span>
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
          <small v-if="uploadError" class="field-error">{{ uploadError }}</small>
          <small v-else-if="avatarMessage" class="settings-message">{{ avatarMessage }}</small>
        </div>
        <label>
          <span>{{ t('settings.account.username') }}</span>
          <input v-model="username" autocomplete="username" />
        </label>
        <label>
          <span>{{ t('settings.account.currentPassword') }}</span>
          <input v-model="currentPassword" type="password" autocomplete="current-password" :placeholder="t('settings.account.currentPasswordPlaceholder')" />
        </label>
        <label>
          <span>{{ t('settings.account.newPassword') }}</span>
          <input v-model="newPassword" type="password" autocomplete="new-password" :placeholder="t('settings.account.newPasswordPlaceholder')" />
        </label>
        <label>
          <span>{{ t('settings.account.confirmPassword') }}</span>
          <input v-model="confirmPassword" type="password" autocomplete="new-password" :placeholder="t('settings.account.confirmPasswordPlaceholder')" />
        </label>
      </div>

      <div class="account-actions">
        <button type="button" class="btn-primary" :disabled="isSaving" @click="$emit('save')">
          <Loader2 v-if="isSaving" class="spin" :size="16" />
          <Save v-else :size="16" />
          <span>{{ t('settings.account.saveAccount') }}</span>
        </button>
        <p v-if="message" class="settings-message">{{ message }}</p>
      </div>
    </div>
  </section>
</template>

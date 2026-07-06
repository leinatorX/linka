<script setup lang="ts">
import { Loader2, LogOut, Save, X } from "@lucide/vue";
import { ref } from "vue";
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
    uploadError.value = error instanceof Error ? error.message : "头像读取失败。";
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
          <h3>账号安全</h3>
          <p>当前登录账号：{{ user.username }}。修改默认账号和密码，降低公网暴露风险。</p>
        </div>
        <button type="button" class="btn-secondary" @click="$emit('logout')">
          <LogOut :size="16" />
          <span>退出登录</span>
        </button>
      </div>

      <div class="account-form-grid">
        <div class="account-avatar-field">
          <span>头像</span>
          <div class="account-avatar-row">
            <button type="button" class="account-avatar-preview" title="上传头像" :disabled="isAvatarSaving" @click="openFilePicker">
              <img v-if="avatarUrl" :src="avatarUrl" alt="" />
              <Loader2 v-else-if="isAvatarSaving" class="spin" :size="22" />
              <span v-else>{{ username.slice(0, 1).toUpperCase() || "U" }}</span>
              <small>{{ isAvatarSaving ? '保存中' : '上传' }}</small>
            </button>
            <div class="account-avatar-actions">
              <button v-if="avatarUrl" type="button" class="btn-secondary" :disabled="isAvatarSaving" @click="clearAvatar">
                <X :size="16" />
                <span>清除</span>
              </button>
              <input ref="fileInput" class="visually-hidden" type="file" accept="image/*" @change="onAvatarFileChange" />
            </div>
          </div>
          <small v-if="uploadError" class="field-error">{{ uploadError }}</small>
          <small v-else-if="avatarMessage" class="settings-message">{{ avatarMessage }}</small>
        </div>
        <label>
          <span>用户名</span>
          <input v-model="username" autocomplete="username" />
        </label>
        <label>
          <span>当前密码</span>
          <input v-model="currentPassword" type="password" autocomplete="current-password" placeholder="保存修改前需要验证" />
        </label>
        <label>
          <span>新密码</span>
          <input v-model="newPassword" type="password" autocomplete="new-password" placeholder="不修改密码可留空" />
        </label>
        <label>
          <span>确认新密码</span>
          <input v-model="confirmPassword" type="password" autocomplete="new-password" placeholder="再次输入新密码" />
        </label>
      </div>

      <div class="account-actions">
        <button type="button" class="btn-primary" :disabled="isSaving" @click="$emit('save')">
          <Loader2 v-if="isSaving" class="spin" :size="16" />
          <Save v-else :size="16" />
          <span>保存账号</span>
        </button>
        <p v-if="message" class="settings-message">{{ message }}</p>
      </div>
    </div>
  </section>
</template>

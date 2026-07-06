<script setup lang="ts">
import { Eye, EyeOff, Loader2, LockKeyhole } from "@lucide/vue";
import { ref } from "vue";

defineProps<{
  message: string;
  isSaving: boolean;
}>();

const username = defineModel<string>("username", { required: true });
const password = defineModel<string>("password", { required: true });
const rememberUsername = defineModel<boolean>("rememberUsername", { required: true });
const autoLogin = defineModel<boolean>("autoLogin", { required: true });

const showPassword = ref(false);

defineEmits<{
  submit: [];
}>();
</script>

<template>
  <main class="login-shell">
    <section class="login-panel">
      <div class="login-brand">
        <div class="login-logo-wrap">
          <img class="login-logo" src="/logo.svg" alt="" />
        </div>
        <div>
          <h1>Linka</h1>
          <p>登录后管理你的书签和 AI 配置。</p>
        </div>
      </div>

      <div class="login-defaults">
        <LockKeyhole :size="16" />
        <span>首次部署默认账号：admin / linka123456，登录后请在设置中修改。</span>
      </div>

      <form class="login-form" @submit.prevent="$emit('submit')">
        <label>
          <span>用户名</span>
          <input v-model="username" autocomplete="username" placeholder="admin" />
        </label>
        <label>
          <span>密码</span>
          <div class="login-password-field">
            <input v-model="password" :type="showPassword ? 'text' : 'password'" autocomplete="current-password" placeholder="请输入密码" />
            <button type="button" :title="showPassword ? '隐藏密码' : '显示密码'" @click="showPassword = !showPassword">
              <EyeOff v-if="showPassword" :size="16" />
              <Eye v-else :size="16" />
            </button>
          </div>
        </label>

        <div class="login-options">
          <label class="login-check">
            <input v-model="rememberUsername" type="checkbox" />
            <span>记住用户名</span>
          </label>
          <label class="login-check">
            <input v-model="autoLogin" type="checkbox" />
            <span>自动登录</span>
          </label>
        </div>

        <button class="btn-primary login-submit" :disabled="isSaving" type="submit">
          <Loader2 v-if="isSaving" class="spin" :size="18" />
          <LockKeyhole v-else :size="18" />
          <span>登录</span>
        </button>
        <p v-if="message" class="login-message">{{ message }}</p>
      </form>
    </section>
  </main>
</template>

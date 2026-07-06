<script setup lang="ts">
import { Eye, EyeOff, Loader2, LockKeyhole } from "@lucide/vue";
import { ref } from "vue";
import { useI18n } from "vue-i18n";

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

const { t } = useI18n();
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
          <p>{{ t('auth.loginDesc') }}</p>
        </div>
      </div>

      <div class="login-defaults">
        <LockKeyhole :size="16" />
        <span>{{ t('auth.defaultAccountHint') }}</span>
      </div>

      <form class="login-form" @submit.prevent="$emit('submit')">
        <label>
          <span>{{ t('auth.username') }}</span>
          <input v-model="username" autocomplete="username" placeholder="admin" />
        </label>
        <label>
          <span>{{ t('auth.password') }}</span>
          <div class="login-password-field">
            <input v-model="password" :type="showPassword ? 'text' : 'password'" autocomplete="current-password" :placeholder="t('auth.passwordPlaceholder')" />
            <button type="button" :title="showPassword ? t('auth.hidePassword') : t('auth.showPassword')" @click="showPassword = !showPassword">
              <EyeOff v-if="showPassword" :size="16" />
              <Eye v-else :size="16" />
            </button>
          </div>
        </label>

        <div class="login-options">
          <label class="login-check">
            <input v-model="rememberUsername" type="checkbox" />
            <span>{{ t('auth.rememberUsername') }}</span>
          </label>
          <label class="login-check">
            <input v-model="autoLogin" type="checkbox" />
            <span>{{ t('auth.autoLogin') }}</span>
          </label>
        </div>

        <button class="btn-primary login-submit" :disabled="isSaving" type="submit">
          <Loader2 v-if="isSaving" class="spin" :size="18" />
          <LockKeyhole v-else :size="18" />
          <span>{{ t('auth.loginBtn') }}</span>
        </button>
        <p v-if="message" class="login-message">{{ message }}</p>
      </form>
    </section>
  </main>
</template>

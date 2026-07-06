<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { setLocale } from '../../i18n';

const { t, locale } = useI18n();

function handleLanguageChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  const newLocale = target.value as 'zh-CN' | 'en-US' | 'zh-TW' | 'zh-HK';
  setLocale(newLocale);
}
</script>

<template>
  <section>
    <div class="grand-panel settings-form">
      <div class="section-title">
        <div>
          <h3>{{ t('settings.general.title') }}</h3>
          <p>{{ t('settings.general.desc') }}</p>
        </div>
      </div>

      <div class="account-form-grid">
        <label>
          <span>{{ t('settings.general.language') }}</span>
          <select :value="locale" @change="handleLanguageChange">
            <option value="zh-CN">简体中文</option>
            <option value="zh-TW">繁體中文 (台灣)</option>
            <option value="zh-HK">繁體中文 (香港)</option>
            <option value="en-US">English</option>
          </select>
          <small class="settings-message" style="margin-top: 4px;">{{ t('settings.general.languageHint') }}</small>
        </label>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Loader2, Save } from "@lucide/vue";
import { useI18n } from 'vue-i18n';
import { setLocale } from '../../i18n';
import { getWeatherSettings, saveWeatherSettings } from '../../api';

const { t, locale } = useI18n();

const weatherEnabled = ref(false);
const weatherApiKey = ref('');
const weatherLocation = ref('');
const weatherShowDate = ref(false);
const weatherDateFormat = ref('full');
const isSaving = ref(false);

onMounted(async () => {
  try {
    const { settings } = await getWeatherSettings();
    weatherEnabled.value = settings.enabled;
    weatherApiKey.value = settings.apiKeySet ? '********' : '';
    weatherLocation.value = settings.location;
    weatherShowDate.value = settings.showDate;
    weatherDateFormat.value = settings.dateFormat || 'full';
  } catch (error) {
    console.error('Failed to load weather settings:', error);
  }
});

function handleLanguageChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  const newLocale = target.value as 'zh-CN' | 'en-US' | 'zh-TW' | 'zh-HK';
  setLocale(newLocale);
}

function toggleWeather() {
  weatherEnabled.value = !weatherEnabled.value;
  if (!weatherEnabled.value) {
    handleSaveWeather(); // save immediately when toggling off
  }
}

async function handleSaveWeather() {
  try {
    isSaving.value = true;
    const payload: any = {
      enabled: weatherEnabled.value,
      location: weatherLocation.value,
      showDate: weatherShowDate.value,
      dateFormat: weatherDateFormat.value,
    };
    if (weatherApiKey.value && weatherApiKey.value !== '********') {
      payload.apiKey = weatherApiKey.value;
    }
    const { settings } = await saveWeatherSettings(payload);
    weatherEnabled.value = settings.enabled;
    weatherApiKey.value = settings.apiKeySet ? '********' : '';
    weatherLocation.value = settings.location;
    weatherShowDate.value = settings.showDate;
    weatherDateFormat.value = settings.dateFormat || 'full';
  } catch (error) {
    console.error('Failed to save weather settings:', error);
  } finally {
    isSaving.value = false;
  }
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

      <div class="section-title" style="margin-top: 32px; border-top: 1px solid var(--border-subtle); padding-top: 32px;">
        <div>
          <h3>{{ t('settings.general.weatherTitle') }}</h3>
          <p>{{ t('settings.general.weatherDesc') }}</p>
        </div>
        <button type="button" class="switch-toggle" :class="{ active: weatherEnabled }" @click="toggleWeather">
          <div></div>
        </button>
      </div>

      <div class="account-form-grid" v-if="weatherEnabled">
        <label style="flex-direction: row; justify-content: space-between; align-items: center;">
          <span>{{ t('settings.general.weatherShowDate') }}</span>
          <button type="button" class="switch-toggle" :class="{ active: weatherShowDate }" @click="weatherShowDate = !weatherShowDate">
            <div></div>
          </button>
        </label>
        <label v-if="weatherShowDate">
          <span>{{ t('settings.general.weatherDateFormat') }}</span>
          <select v-model="weatherDateFormat" class="settings-select">
            <option value="full">{{ t('settings.general.weatherDateFormat_full') }}</option>
            <option value="long">{{ t('settings.general.weatherDateFormat_long') }}</option>
            <option value="short">{{ t('settings.general.weatherDateFormat_short') }}</option>
            <option value="time">{{ t('settings.general.weatherDateFormat_time') }}</option>
          </select>
        </label>
        <div style="grid-column: 1 / -1; height: 1px; background: var(--border-subtle); margin: 8px 0;"></div>
        <label>
          <span>{{ t('settings.general.weatherApiKey') }}</span>
          <input type="password" v-model="weatherApiKey" :placeholder="t('settings.general.weatherApiKeyPlaceholder')" />
        </label>
        <label>
          <span>{{ t('settings.general.weatherLocation') }}</span>
          <input type="text" v-model="weatherLocation" :placeholder="t('settings.general.weatherLocationPlaceholder')" />
        </label>
      </div>
      
      <div class="account-actions" v-if="weatherEnabled" style="margin-top: 16px;">
        <button type="button" class="btn-primary" :disabled="isSaving" @click="handleSaveWeather">
          <Loader2 v-if="isSaving" class="spin" :size="16" />
          <Save v-else :size="16" />
          <span>{{ isSaving ? t('settings.account.saving') : t('common.save') }}</span>
        </button>
      </div>
    </div>
  </section>
</template>

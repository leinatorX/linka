<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Loader2, Save, Eye, EyeOff } from "@lucide/vue";
import { useI18n } from 'vue-i18n';
import { setLocale } from '../../i18n';
import { getWeatherSettings, saveWeatherSettings } from '../../api';
import WebSearchSettings from './WebSearchSettings.vue';
import type { AiSettingsPayload } from '../../types';

const props = defineProps<{
  aiSettingsForm?: AiSettingsPayload;
  isAiSettingsSaving?: boolean;
}>();

const emit = defineEmits<{
  saveAiSettings: [];
}>();

const { t, locale } = useI18n();

const showWeatherApiKey = ref(false);
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
    weatherApiKey.value = settings.apiKey || '';
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
    if (weatherApiKey.value) {
      payload.apiKey = weatherApiKey.value;
    } else {
      payload.apiKey = ''; // Allow clearing the API key
    }
    const { settings } = await saveWeatherSettings(payload);
    weatherEnabled.value = settings.enabled;
    weatherApiKey.value = settings.apiKey || '';
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
        
        <label v-if="aiSettingsForm">
          <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
            <span>{{ t('settings.general.aiLanguage') }}</span>
            <div v-if="isAiSettingsSaving" style="display: flex; align-items: center; gap: 4px; color: var(--text-secondary); font-size: 12px;">
              <Loader2 class="spin" :size="12" />
              <span>{{ t('settings.account.saving') }}</span>
            </div>
          </div>
          <select v-model="aiSettingsForm.aiLanguage" @change="$emit('saveAiSettings')">
            <option value="简体中文">简体中文</option>
            <option value="繁體中文">繁體中文</option>
            <option value="English">English</option>
            <option value="日本語">日本語</option>
            <option value="한국어">한국어</option>
            <option value="Français">Français</option>
            <option value="Deutsch">Deutsch</option>
            <option value="Español">Español</option>
            <option value="Português">Português</option>
            <option value="Русский">Русский</option>
            <option value="Italiano">Italiano</option>
            <option value="العربية">العربية</option>
            <option value="हिन्दी">हिन्दी</option>
            <option value="Türkçe">Türkçe</option>
            <option value="Tiếng Việt">Tiếng Việt</option>
            <option value="ภาษาไทย">ภาษาไทย</option>
          </select>
          <small class="settings-message" style="margin-top: 4px;">{{ t('settings.general.aiLanguageHint') }}</small>
        </label>
      </div>

      <div class="section-title" style="margin-top: 32px; border-top: 1px solid var(--border-subtle); padding-top: 32px;">
        <div>
          <h3>{{ t('settings.general.weatherTitle') }}</h3>
          <p>
            {{ t('settings.general.weatherDesc').split('WeatherAPI')[0] }}<a href="https://www.weatherapi.com/" target="_blank" rel="noopener noreferrer" style="color: var(--accent-primary); text-decoration: none;">WeatherAPI</a>{{ t('settings.general.weatherDesc').split('WeatherAPI')[1] }}
          </p>
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
          <div class="login-password-field" style="width: 100%;">
            <input :type="showWeatherApiKey ? 'text' : 'password'" v-model="weatherApiKey" :placeholder="t('settings.general.weatherApiKeyPlaceholder')" />
            <button type="button" @click="showWeatherApiKey = !showWeatherApiKey">
              <EyeOff v-if="showWeatherApiKey" :size="16" />
              <Eye v-else :size="16" />
            </button>
          </div>
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

      <WebSearchSettings />
    </div>
  </section>
</template>

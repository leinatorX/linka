<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Loader2, Save, Eye, EyeOff } from "@lucide/vue";
import { useI18n } from 'vue-i18n';
import { getSearchSettings, saveSearchSettings } from '../../api';

const { t } = useI18n();

const showSearchApiKey = ref(false);

const searchEnabled = ref(false);
const searchEngine = ref<'tavily' | 'brave' | 'searxng'>('tavily');
const searchApiKey = ref('');
const searchBaseUrl = ref('');
const searchMaxResults = ref(5);
const isSaving = ref(false);

onMounted(async () => {
  try {
    const { settings } = await getSearchSettings();
    searchEnabled.value = settings.enabled;
    searchEngine.value = settings.engine || 'tavily';
    searchApiKey.value = settings.apiKey || '';
    searchBaseUrl.value = settings.baseUrl || '';
    searchMaxResults.value = settings.maxResults || 5;
  } catch (error) {
    console.error('加载搜索设置失败:', error);
  }
});

// 切换搜索开关，关闭时立即保存
function toggleSearch() {
  searchEnabled.value = !searchEnabled.value;
  if (!searchEnabled.value) {
    handleSaveSearch();
  }
}

async function handleSaveSearch() {
  try {
    isSaving.value = true;
    const payload: any = {
      enabled: searchEnabled.value,
      engine: searchEngine.value,
      baseUrl: searchBaseUrl.value,
      maxResults: searchMaxResults.value,
    };
    // Allow clearing the API key
    if (searchApiKey.value) {
      payload.apiKey = searchApiKey.value;
    } else {
      payload.apiKey = '';
    }
    const { settings } = await saveSearchSettings(payload);
    searchEnabled.value = settings.enabled;
    searchEngine.value = settings.engine || 'tavily';
    searchApiKey.value = settings.apiKey || '';
    searchBaseUrl.value = settings.baseUrl || '';
    searchMaxResults.value = settings.maxResults || 5;
  } catch (error) {
    console.error('保存搜索设置失败:', error);
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <div>
    <div class="section-title" style="margin-top: 32px; border-top: 1px solid var(--border-subtle); padding-top: 32px;">
      <div>
        <h3>{{ t('settings.general.searchTitle') }}</h3>
        <p>{{ t('settings.general.searchDesc') }}</p>
      </div>
      <button type="button" class="switch-toggle" :class="{ active: searchEnabled }" @click="toggleSearch">
        <div></div>
      </button>
    </div>

    <div class="account-form-grid" v-if="searchEnabled">
      <label>
        <span>{{ t('settings.general.searchEngine') }}</span>
        <select v-model="searchEngine">
          <option value="tavily">Tavily</option>
          <option value="brave">Brave Search</option>
          <option value="searxng">SearXNG</option>
        </select>
      </label>
      <label v-if="searchEngine !== 'searxng'">
        <span>{{ t('settings.general.searchApiKey') }}</span>
        <div class="login-password-field" style="width: 100%;">
          <input :type="showSearchApiKey ? 'text' : 'password'" v-model="searchApiKey" :placeholder="t('settings.general.searchApiKeyPlaceholder')" />
          <button type="button" @click="showSearchApiKey = !showSearchApiKey">
            <EyeOff v-if="showSearchApiKey" :size="16" />
            <Eye v-else :size="16" />
          </button>
        </div>
      </label>
      <label v-if="searchEngine === 'searxng'">
        <span>{{ t('settings.general.searchBaseUrl') }}</span>
        <input type="text" v-model="searchBaseUrl" :placeholder="t('settings.general.searchBaseUrlPlaceholder')" />
      </label>
      <label>
        <span>{{ t('settings.general.searchMaxResults') }}</span>
        <input type="number" v-model.number="searchMaxResults" min="3" max="10" />
      </label>
    </div>

    <div class="account-actions" v-if="searchEnabled" style="margin-top: 16px;">
      <button type="button" class="btn-primary" :disabled="isSaving" @click="handleSaveSearch">
        <Loader2 v-if="isSaving" class="spin" :size="16" />
        <Save v-else :size="16" />
        <span>{{ isSaving ? t('settings.account.saving') : t('common.save') }}</span>
      </button>
    </div>
  </div>
</template>

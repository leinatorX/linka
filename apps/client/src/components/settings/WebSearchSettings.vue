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
  <section>
    <!-- 网页搜索 -->
    <div class="settings-section-title" style="margin-top: 32px;">
      <h3>{{ t('settings.general.searchTitle') }}</h3>
    </div>
    <div class="settings-list-group">
      <div class="settings-list-item is-header">
        <div class="settings-item-label">
          <div class="settings-item-title">{{ t('settings.general.searchTitle') }}</div>
          <div class="settings-item-desc">{{ t('settings.general.searchDesc') }}</div>
        </div>
        <div class="settings-item-control">
          <button type="button" class="switch-toggle" :class="{ active: searchEnabled }" @click="toggleSearch">
            <div></div>
          </button>
        </div>
      </div>

      <template v-if="searchEnabled">
        <div class="settings-list-item">
          <div class="settings-item-label">
            <div class="settings-item-title">{{ t('settings.general.searchEngine') }}</div>
          </div>
          <div class="settings-item-control">
            <select v-model="searchEngine">
              <option value="tavily">Tavily</option>
              <option value="brave">Brave Search</option>
              <option value="searxng">SearXNG</option>
            </select>
          </div>
        </div>

        <div class="settings-list-item" v-if="searchEngine !== 'searxng'">
          <div class="settings-item-label">
            <div class="settings-item-title-row">
              <span class="settings-item-title">{{ t('settings.general.searchApiKey') }}</span>
              <a v-if="searchEngine === 'tavily'" href="https://app.tavily.com/" target="_blank" rel="noopener noreferrer" style="font-size: 11px; color: var(--accent-primary); text-decoration: none;">(获取密钥)</a>
              <a v-else-if="searchEngine === 'brave'" href="https://api.search.brave.com/app/keys" target="_blank" rel="noopener noreferrer" style="font-size: 11px; color: var(--accent-primary); text-decoration: none;">(获取密钥)</a>
            </div>
          </div>
          <div class="settings-item-control">
            <div class="login-password-field">
              <input :type="showSearchApiKey ? 'text' : 'password'" v-model="searchApiKey" :placeholder="t('settings.general.searchApiKeyPlaceholder')" />
              <button type="button" @click="showSearchApiKey = !showSearchApiKey">
                <EyeOff v-if="showSearchApiKey" :size="16" />
                <Eye v-else :size="16" />
              </button>
            </div>
          </div>
        </div>

        <div class="settings-list-item" v-if="searchEngine === 'searxng'">
          <div class="settings-item-label">
            <div class="settings-item-title-row">
              <span class="settings-item-title">{{ t('settings.general.searchBaseUrl') }}</span>
              <a href="https://docs.searxng.org/" target="_blank" rel="noopener noreferrer" style="font-size: 11px; color: var(--accent-primary); text-decoration: none;">(部署指南)</a>
            </div>
          </div>
          <div class="settings-item-control">
            <input type="text" v-model="searchBaseUrl" :placeholder="t('settings.general.searchBaseUrlPlaceholder')" />
          </div>
        </div>

        <div class="settings-list-item">
          <div class="settings-item-label">
            <div class="settings-item-title">{{ t('settings.general.searchMaxResults') }}</div>
          </div>
          <div class="settings-item-control">
            <input type="number" v-model.number="searchMaxResults" min="3" max="10" />
          </div>
        </div>

        <div class="settings-list-item" style="background: rgba(0,0,0,0.02); justify-content: flex-end;">
          <div class="settings-item-control">
            <button type="button" class="btn-primary" :disabled="isSaving" @click="handleSaveSearch">
              <Loader2 v-if="isSaving" class="spin" :size="16" />
              <Save v-else :size="16" />
              <span>{{ isSaving ? t('settings.account.saving') : t('common.save') }}</span>
            </button>
          </div>
        </div>
      </template>
    </div>
  </section>
</template>

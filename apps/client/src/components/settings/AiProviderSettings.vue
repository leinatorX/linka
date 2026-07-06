<script setup lang="ts">
import {
  Activity, Check, ChevronDown, Copy, Cpu, Edit2, Eye, EyeOff, GripVertical,
  Info, Key, Loader2, Plus, RotateCcw, Save, Sparkles, Trash2, X
} from "@lucide/vue";
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import { useProviderIcons } from "../../composables/useProviderIcons";
import type { ModelTestResult } from "../../composables/useAiSettings";
import type { AiApiFormat, AiProviderConfig, AiModelConfig } from "../../types";

const props = defineProps<{
  aiSettingsForm: {
    providers: AiProviderConfig[];
  };
  activeAiProvider?: AiProviderConfig;
  editingProviderId: string;
  isAiSettingsSaving: boolean;
  revealedApiKeys: Record<string, string>;
  revealingApiKeyProviderIds: Set<string>;
  testingModelId: string | null;
  modelTestResults: Record<string, ModelTestResult>;
  lastSavedTime: string;
  isApiKeyRevealed: (providerId: string) => boolean;
}>();

const showApiKey = defineModel<boolean>("showApiKey", { required: true });

const emit = defineEmits<{
  selectAiProvider: [providerId: string];
  addAiProvider: [];
  removeAiProvider: [providerId: string];
  toggleRevealApiKey: [providerId: string];
  copyApiKeyValue: [provider: AiProviderConfig];
  openAddAiModelModal: [];
  openEditAiModelModal: [model: AiModelConfig];
  removeAiModel: [provider: AiProviderConfig, modelId: string];
  modelDragStart: [index: number];
  modelDragEnter: [index: number];
  modelDragEnd: [];
  testModel: [provider: AiProviderConfig, model: AiModelConfig];
  clearModelTestResult: [modelId: string];
  loadAiSettings: [];
  saveAiSettings: [];
  reorderProviders: [orderedIds: string[]];
}>();

const { t } = useI18n();

// 供应商卡片拖拽：HTML5 原生 drag-and-drop，零依赖。
// 注意：整张卡片既可拖动也响应 click 切换，两者事件不冲突。
const draggedProviderId = ref<string | null>(null);
const dropTargetProviderId = ref<string | null>(null);
const dropProviderPosition = ref<"before" | "after">("before");

function onProviderDragStart(event: DragEvent, id: string) {
  if (!event.dataTransfer) {
    return;
  }
  draggedProviderId.value = id;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", id);
}

function onProviderDragOver(event: DragEvent, targetId: string) {
  if (!draggedProviderId.value || draggedProviderId.value === targetId) {
    return;
  }
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  dropProviderPosition.value = event.clientY - rect.top < rect.height / 2 ? "before" : "after";
  dropTargetProviderId.value = targetId;
}

function onProviderDragLeave(targetId: string) {
  if (dropTargetProviderId.value === targetId) {
    dropTargetProviderId.value = null;
  }
}

function onProviderDragEnd() {
  draggedProviderId.value = null;
  dropTargetProviderId.value = null;
}

function onProviderDrop(event: DragEvent, targetId: string) {
  event.preventDefault();
  const sourceId = draggedProviderId.value ?? event.dataTransfer?.getData("text/plain") ?? "";
  onProviderDragEnd();
  if (!sourceId || sourceId === targetId) {
    return;
  }
  const ids = props.aiSettingsForm.providers.map((provider) => provider.id);
  const fromIndex = ids.indexOf(sourceId);
  const toIndex = ids.indexOf(targetId);
  if (fromIndex < 0 || toIndex < 0) {
    return;
  }
  const next = ids.slice();
  next.splice(fromIndex, 1);
  const insertAt = dropProviderPosition.value === "before" ? toIndex : toIndex + 1;
  next.splice(insertAt > fromIndex ? insertAt - 1 : insertAt, 0, sourceId);
  emit("reorderProviders", next);
}

const {
  getAvatarStyle,
  getProviderIconUrl,
  showProviderIcon,
  onProviderIconError
} = useProviderIcons();

const apiFormatLabels = computed<Record<AiApiFormat, string>>(() => ({
  openai: t('settings.ai.formatOpenAI'),
  anthropic: t('settings.ai.formatAnthropic')
}));

function getApiFormatLabel(format: AiApiFormat) {
  return apiFormatLabels.value[format];
}
</script>

<template>
  <section>
    <div class="ai-provider-layout">
      <div class="ai-provider-sidebar">
        <div class="sidebar-header">
          <h3>{{ t('settings.ai.title') }}</h3>
          <p>{{ t('settings.ai.desc') }}</p>
        </div>

        <div class="ai-provider-cards">
          <div v-for="provider in aiSettingsForm.providers" :key="provider.id" class="provider-card"
            :class="{
              active: editingProviderId === provider.id,
              'is-dragging': draggedProviderId === provider.id,
              'drop-before': dropTargetProviderId === provider.id && dropProviderPosition === 'before',
              'drop-after': dropTargetProviderId === provider.id && dropProviderPosition === 'after'
            }"
            draggable="true"
            @click="$emit('selectAiProvider', provider.id)"
            @dragstart="onProviderDragStart($event, provider.id)"
            @dragover="onProviderDragOver($event, provider.id)"
            @dragleave="onProviderDragLeave(provider.id)"
            @dragend="onProviderDragEnd"
            @drop="onProviderDrop($event, provider.id)">
            <span class="provider-drag-handle" :title="t('settings.ai.dragToSort')" :aria-label="t('settings.ai.dragToSort')"
              @click.stop>
              <span class="grip-dot"></span>
              <span class="grip-dot"></span>
              <span class="grip-dot"></span>
              <span class="grip-dot"></span>
              <span class="grip-dot"></span>
              <span class="grip-dot"></span>
            </span>
            <div class="provider-card-main">
              <div class="provider-avatar" :style="getAvatarStyle(provider)">
                <img v-if="showProviderIcon(provider)" :src="getProviderIconUrl(provider) ?? ''" :alt="provider.name"
                  @error="onProviderIconError(provider)" />
                <span v-else>{{ provider.name[0] }}</span>
              </div>
              <div class="provider-card-text">
                <span>{{ provider.name }}</span>
                <small>{{ t('settings.ai.modelCount', { count: provider.models.length }) }}</small>
              </div>
            </div>

            <span class="status-badge" :class="{ active: provider.enabled }">
              {{ provider.enabled ? t('settings.ai.enabled') : t('settings.ai.disabled') }}
              <i></i>
            </span>
          </div>

          <button class="add-provider-btn" @click="$emit('addAiProvider')">
            <Plus :size="16" />
            <span>{{ t('settings.ai.addProvider') }}</span>
          </button>
        </div>
      </div>

      <div class="ai-provider-detail-container" v-if="activeAiProvider">
        <div class="grand-panel ai-provider-summary">
          <div class="provider-summary-main">
            <div class="provider-avatar large" :style="getAvatarStyle(activeAiProvider)">
              <img v-if="showProviderIcon(activeAiProvider)" :src="getProviderIconUrl(activeAiProvider) ?? ''"
                :alt="activeAiProvider.name" @error="onProviderIconError(activeAiProvider)" />
              <span v-else>{{ activeAiProvider.name[0] }}</span>
            </div>
            <div class="provider-summary-text">
              <div class="provider-summary-title">
                <h4>{{ activeAiProvider.name }}</h4>
                <span class="status-badge" :class="{ active: activeAiProvider.enabled }">
                  {{ activeAiProvider.enabled ? t('settings.ai.enabled') : t('settings.ai.disabled') }}
                </span>
              </div>
              <div class="provider-meta-row">
                <span class="meta-pill">
                  <Cpu :size="12" />
                  <span>{{ getApiFormatLabel(activeAiProvider.apiFormat) }}</span>
                </span>
                <span class="meta-pill">
                  <Key :size="12" />
                  <span>{{ activeAiProvider.apiKeySet ? t('settings.ai.apiKeySetText') : t('settings.ai.apiKeyNotSet') }}</span>
                </span>
                <span class="meta-pill">
                  <Sparkles :size="12" />
                  <span>{{ t('settings.ai.defaultModel') }}{{ activeAiProvider.models[0]?.name || t('settings.ai.none') }}</span>
                </span>
              </div>
            </div>
          </div>

          <button class="provider-more-btn" @click.stop="$emit('removeAiProvider', activeAiProvider.id)" :title="t('settings.ai.deleteProvider')">
            <Trash2 :size="16" />
          </button>
        </div>

        <div class="grand-panel settings-form ai-provider-form">
          <div class="ai-form-section">
            <h4>{{ t('settings.ai.basicInfo') }}</h4>
            <div class="ai-form-grid ai-form-grid-name">
              <label>
                <span>{{ t('settings.ai.providerName') }}</span>
                <input v-model="activeAiProvider.name" />
              </label>

              <label class="ai-toggle-field">
                <span>{{ t('settings.ai.enableStatus') }}</span>
                <div class="switch-toggle" :class="{ active: activeAiProvider.enabled }"
                  @click="activeAiProvider.enabled = !activeAiProvider.enabled">
                  <div></div>
                </div>
              </label>
            </div>
          </div>

          <div class="ai-form-section">
            <h4>{{ t('settings.ai.apiConfig') }}</h4>
            <div class="ai-form-grid">
              <label>
                <span>{{ t('settings.ai.apiFormat') }}</span>
                <div class="select-field">
                  <select v-model="activeAiProvider.apiFormat">
                    <option value="openai">{{ apiFormatLabels.openai }}</option>
                    <option value="anthropic">{{ apiFormatLabels.anthropic }}</option>
                  </select>
                  <ChevronDown :size="16" />
                </div>
              </label>

              <label>
                <div class="field-label-with-icon">
                  <span>{{ t('settings.ai.temperature') }}</span>
                  <Info :size="14" :title="t('settings.ai.temperatureHint')" />
                </div>
                <div class="temperature-control">
                  <input type="number" v-model.number="activeAiProvider.temperature" min="0" max="2" step="0.1" />
                  <div class="temperature-slider">
                    <input v-model.number="activeAiProvider.temperature" type="range" min="0" max="2" step="0.1" />
                    <div>
                      <span>0</span>
                      <span>2</span>
                    </div>
                  </div>
                </div>
              </label>
            </div>

            <div class="ai-form-grid api-credentials-grid">
              <label>
                <span>{{ t('settings.ai.baseUrl') }}</span>
                <input v-model="activeAiProvider.baseUrl"
                  :placeholder="activeAiProvider.apiFormat === 'anthropic' ? 'https://api.anthropic.com' : 'https://api.openai.com/v1'" />
              </label>

              <label>
                <span>{{ t('settings.ai.apiKey') }}</span>
                <div class="api-key-field">
                  <input v-if="activeAiProvider.apiKeySet && !isApiKeyRevealed(activeAiProvider.id)" type="text"
                    :value="'•'.repeat(Math.max(activeAiProvider.apiKeyPreview.length || 12, 12))" readonly tabindex="-1"
                    class="api-key-mask" />
                  <input v-else-if="revealingApiKeyProviderIds.has(activeAiProvider.id)" type="text" :value="t('settings.ai.loading')"
                    readonly tabindex="-1" />
                  <input v-else-if="isApiKeyRevealed(activeAiProvider.id)" type="text"
                    v-model="revealedApiKeys[activeAiProvider.id]" :placeholder="t('settings.ai.enterNewKey')" autocomplete="off" />
                  <input v-else :type="showApiKey ? 'text' : 'password'" v-model="activeAiProvider.apiKey"
                    :placeholder="t('settings.ai.enterKey')" autocomplete="off" />
                  <div class="api-key-actions">
                    <button v-if="activeAiProvider.apiKeySet && !isApiKeyRevealed(activeAiProvider.id)" type="button"
                      :disabled="revealingApiKeyProviderIds.has(activeAiProvider.id)"
                      @click="$emit('toggleRevealApiKey', activeAiProvider.id)" :title="t('settings.ai.unlockKey')">
                      <Loader2 v-if="revealingApiKeyProviderIds.has(activeAiProvider.id)" class="spin" :size="14" />
                      <Eye v-else :size="16" />
                    </button>
                    <button v-else-if="activeAiProvider.apiKeySet" type="button"
                      @click="$emit('toggleRevealApiKey', activeAiProvider.id)" :title="t('settings.ai.lockKey')">
                      <EyeOff :size="16" />
                    </button>
                    <button v-else type="button" @click="showApiKey = !showApiKey">
                      <Eye v-if="!showApiKey" :size="16" />
                      <EyeOff v-else :size="16" />
                    </button>
                    <button type="button" @click="$emit('copyApiKeyValue', activeAiProvider)" :title="t('settings.ai.copy')">
                      <Copy :size="16" />
                    </button>
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div class="ai-form-section">
            <div class="ai-model-header">
              <div>
                <h4>{{ t('settings.ai.modelList') }}</h4>
                <p>{{ t('settings.ai.modelListDesc') }}</p>
              </div>
              <button type="button" class="outline-btn" @click="$emit('openAddAiModelModal')">
                <Plus :size="14" />
                <span>{{ t('settings.ai.addModel') }}</span>
              </button>
            </div>

            <div class="ai-model-list">
              <div v-for="(model, index) in activeAiProvider.models" :key="model.id" class="ai-model-row"
                :class="{ active: index === 0 }" draggable="true" @dragstart="$emit('modelDragStart', index)"
                @dragenter="$emit('modelDragEnter', index)" @dragend="$emit('modelDragEnd')" @dragover.prevent>
                <div class="ai-model-row-main">
                  <div class="drag-handle">
                    <GripVertical :size="16" />
                  </div>
                  <div class="ai-model-info">
                    <div class="ai-model-name-row">
                      <span class="ai-model-name">{{ model.name }}</span>
                      <span v-if="index === 0" class="default-model-badge">{{ t('settings.ai.default') }}</span>
                      <span v-if="model.supportsVision" class="vision-model-badge">{{ t('settings.ai.vision') }}</span>
                    </div>
                    <div class="ai-model-tokens">
                      <span>{{ t('settings.ai.contextPrefix') }}{{ model.maxTokens.toLocaleString() }}{{ t('settings.ai.tokenSuffix') }}</span>
                    </div>
                  </div>

                  <div class="ai-model-actions">
                    <button type="button" class="btn-model-icon" :title="t('settings.ai.testConnection')" :disabled="testingModelId === model.id"
                      @click="$emit('testModel', activeAiProvider, model)">
                      <Loader2 v-if="testingModelId === model.id" class="spin" :size="14" />
                      <Activity v-else :size="14" />
                    </button>
                    <button type="button" class="btn-model-icon" :title="t('settings.ai.edit')" @click="$emit('openEditAiModelModal', model)">
                      <Edit2 :size="14" />
                    </button>
                    <button type="button" class="btn-model-icon btn-model-icon-danger" :title="t('settings.ai.delete')"
                      @click="$emit('removeAiModel', activeAiProvider, model.id)">
                      <Trash2 :size="14" />
                    </button>
                  </div>
                </div>

                <div v-if="modelTestResults[model.id]" class="model-test-result"
                  :class="['model-test-result-' + modelTestResults[model.id].status]">
                  <Check v-if="modelTestResults[model.id].status === 'success'" :size="14" />
                  <X v-else :size="14" />
                  <span>{{ modelTestResults[model.id].message }}</span>
                  <button type="button" @click="$emit('clearModelTestResult', model.id)" :title="t('settings.ai.close')">
                    <X :size="12" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="ai-form-actions">
            <span>{{ t('settings.ai.lastSaved') }}{{ lastSavedTime }}</span>
            <div>
              <button type="button" class="btn-secondary" @click="$emit('loadAiSettings')">
                <RotateCcw :size="14" />
                <span>{{ t('settings.ai.reset') }}</span>
              </button>
              <button type="button" class="btn-primary" :disabled="isAiSettingsSaving" @click="$emit('saveAiSettings')">
                <Loader2 v-if="isAiSettingsSaving" class="spin" :size="16" />
                <Save v-else :size="16" />
                <span>{{ t('settings.ai.saveConfig') }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

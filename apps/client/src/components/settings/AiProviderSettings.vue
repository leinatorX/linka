<script setup lang="ts">
import {
  Activity, Check, ChevronDown, Copy, Cpu, Edit2, Eye, EyeOff, GripVertical,
  Info, Key, Loader2, Plus, RotateCcw, Save, Sparkles, Trash2, X
} from "@lucide/vue";
import { useProviderIcons } from "../../composables/useProviderIcons";
import type { ModelTestResult } from "../../composables/useAiSettings";
import type { AiApiFormat, AiProviderConfig, AiModelConfig } from "../../types";

defineProps<{
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

defineEmits<{
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
}>();

const {
  getAvatarStyle,
  getProviderIconUrl,
  showProviderIcon,
  onProviderIconError
} = useProviderIcons();

const apiFormatLabels: Record<AiApiFormat, string> = {
  openai: "OpenAI 对话补全接口",
  anthropic: "Anthropic 消息接口"
};

function getApiFormatLabel(format: AiApiFormat) {
  return apiFormatLabels[format];
}
</script>

<template>
  <section>
    <div class="ai-provider-layout">
      <div class="ai-provider-sidebar">
        <div class="sidebar-header">
          <h3>供应商管理</h3>
          <p>管理您的 AI 服务商</p>
        </div>

        <div class="ai-provider-cards">
          <div v-for="provider in aiSettingsForm.providers" :key="provider.id" class="provider-card"
            :class="{ active: editingProviderId === provider.id }"
            @click="$emit('selectAiProvider', provider.id)">
            <div class="provider-card-main">
              <div class="provider-avatar" :style="getAvatarStyle(provider)">
                <img v-if="showProviderIcon(provider)" :src="getProviderIconUrl(provider) ?? ''" :alt="provider.name"
                  @error="onProviderIconError(provider)" />
                <span v-else>{{ provider.name[0] }}</span>
              </div>
              <div class="provider-card-text">
                <span>{{ provider.name }}</span>
                <small>{{ provider.models.length }} 个模型</small>
              </div>
            </div>

            <span class="status-badge" :class="{ active: provider.enabled }">
              {{ provider.enabled ? '已启用' : '已禁用' }}
              <i></i>
            </span>
          </div>

          <button class="add-provider-btn" @click="$emit('addAiProvider')">
            <Plus :size="16" />
            <span>添加供应商</span>
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
                  {{ activeAiProvider.enabled ? '已启用' : '已禁用' }}
                </span>
              </div>
              <div class="provider-meta-row">
                <span class="meta-pill">
                  <Cpu :size="12" />
                  <span>{{ getApiFormatLabel(activeAiProvider.apiFormat) }}</span>
                </span>
                <span class="meta-pill">
                  <Key :size="12" />
                  <span>{{ activeAiProvider.apiKeySet ? '已配置接口密钥' : '未配置接口密钥' }}</span>
                </span>
                <span class="meta-pill">
                  <Sparkles :size="12" />
                  <span>默认模型：{{ activeAiProvider.models[0]?.name || '无' }}</span>
                </span>
              </div>
            </div>
          </div>

          <button class="provider-more-btn" @click.stop="$emit('removeAiProvider', activeAiProvider.id)" title="删除供应商">
            <Trash2 :size="16" />
          </button>
        </div>

        <div class="grand-panel settings-form ai-provider-form">
          <div class="ai-form-section">
            <h4>基础信息</h4>
            <div class="ai-form-grid ai-form-grid-name">
              <label>
                <span>供应商名称</span>
                <input v-model="activeAiProvider.name" />
              </label>

              <label class="ai-toggle-field">
                <span>启用状态</span>
                <div class="switch-toggle" :class="{ active: activeAiProvider.enabled }"
                  @click="activeAiProvider.enabled = !activeAiProvider.enabled">
                  <div></div>
                </div>
              </label>
            </div>
          </div>

          <div class="ai-form-section">
            <h4>API 配置</h4>
            <div class="ai-form-grid">
              <label>
                <span>接口格式</span>
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
                  <span>温度</span>
                  <Info :size="14" title="控制模型生成文本的随机性。值越高越有创意，值越低越精确稳定。" />
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
                <span>接口地址</span>
                <input v-model="activeAiProvider.baseUrl"
                  :placeholder="activeAiProvider.apiFormat === 'anthropic' ? 'https://api.anthropic.com' : 'https://api.openai.com/v1'" />
              </label>

              <label>
                <span>接口密钥</span>
                <div class="api-key-field">
                  <input v-if="activeAiProvider.apiKeySet && !isApiKeyRevealed(activeAiProvider.id)" type="text"
                    :value="'•'.repeat(Math.max(activeAiProvider.apiKeyPreview.length || 12, 12))" readonly tabindex="-1"
                    class="api-key-mask" />
                  <input v-else-if="revealingApiKeyProviderIds.has(activeAiProvider.id)" type="text" value="正在加载…"
                    readonly tabindex="-1" />
                  <input v-else-if="isApiKeyRevealed(activeAiProvider.id)" type="text"
                    v-model="revealedApiKeys[activeAiProvider.id]" placeholder="请输入新的接口密钥覆盖现有值" autocomplete="off" />
                  <input v-else :type="showApiKey ? 'text' : 'password'" v-model="activeAiProvider.apiKey"
                    placeholder="请输入接口密钥" autocomplete="off" />
                  <div class="api-key-actions">
                    <button v-if="activeAiProvider.apiKeySet && !isApiKeyRevealed(activeAiProvider.id)" type="button"
                      :disabled="revealingApiKeyProviderIds.has(activeAiProvider.id)"
                      @click="$emit('toggleRevealApiKey', activeAiProvider.id)" title="解锁查看/修改">
                      <Loader2 v-if="revealingApiKeyProviderIds.has(activeAiProvider.id)" class="spin" :size="14" />
                      <Eye v-else :size="16" />
                    </button>
                    <button v-else-if="activeAiProvider.apiKeySet" type="button"
                      @click="$emit('toggleRevealApiKey', activeAiProvider.id)" title="锁定">
                      <EyeOff :size="16" />
                    </button>
                    <button v-else type="button" @click="showApiKey = !showApiKey">
                      <Eye v-if="!showApiKey" :size="16" />
                      <EyeOff v-else :size="16" />
                    </button>
                    <button type="button" @click="$emit('copyApiKeyValue', activeAiProvider)" title="复制">
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
                <h4>模型列表</h4>
                <p>拖动模型调整优先级，排在第一位的模型作为默认模型使用。</p>
              </div>
              <button type="button" class="outline-btn" @click="$emit('openAddAiModelModal')">
                <Plus :size="14" />
                <span>添加模型</span>
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
                      <span v-if="index === 0" class="default-model-badge">默认</span>
                    </div>
                    <div class="ai-model-tokens">
                      <span>上下文：{{ model.maxTokens.toLocaleString() }} 个 token</span>
                    </div>
                  </div>

                  <div class="ai-model-actions">
                    <button type="button" class="btn-model-icon" title="测试连接" :disabled="testingModelId === model.id"
                      @click="$emit('testModel', activeAiProvider, model)">
                      <Loader2 v-if="testingModelId === model.id" class="spin" :size="14" />
                      <Activity v-else :size="14" />
                    </button>
                    <button type="button" class="btn-model-icon" title="编辑" @click="$emit('openEditAiModelModal', model)">
                      <Edit2 :size="14" />
                    </button>
                    <button type="button" class="btn-model-icon btn-model-icon-danger" title="删除"
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
                  <button type="button" @click="$emit('clearModelTestResult', model.id)" title="关闭">
                    <X :size="12" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="ai-form-actions">
            <span>上次保存：{{ lastSavedTime }}</span>
            <div>
              <button type="button" class="btn-secondary" @click="$emit('loadAiSettings')">
                <RotateCcw :size="14" />
                <span>重置修改</span>
              </button>
              <button type="button" class="btn-primary" :disabled="isAiSettingsSaving" @click="$emit('saveAiSettings')">
                <Loader2 v-if="isAiSettingsSaving" class="spin" :size="16" />
                <Save v-else :size="16" />
                <span>保存配置</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

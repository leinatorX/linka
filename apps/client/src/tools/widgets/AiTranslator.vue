<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { streamGenericChatMessage } from '../../api';
import { RefreshCw, Copy, Check, ArrowLeftRight, X, Sparkles, Bot } from '@lucide/vue';

const sourceText = ref('');
const targetText = ref('');
const sourceLang = ref('Auto Detect');
const targetLang = ref('中文 (简体)');
const isTranslating = ref(false);
const error = ref('');
const copied = ref(false);

const availableModels = ref<{ id: string; name: string }[]>([]);
const selectedModelId = ref('');

onMounted(async () => {
  try {
    const res = await fetch('/api/settings/ai');
    if (res.ok) {
      const data = await res.json();
      const models = [];
      for (const provider of data.settings.providers) {
        if (provider.enabled) {
          for (const model of provider.models) {
            if (model.enabled) {
              models.push({ id: model.id, name: model.name });
            }
          }
        }
      }
      availableModels.value = models;
      if (models.length > 0) {
        selectedModelId.value = data.settings.activeModelId || models[0].id;
      }
    }
  } catch (e) {
    console.error('Failed to fetch ai settings', e);
  }
});

const { t } = useI18n();

const sourceLanguages = [
  'Auto Detect',
  'English',
  '中文 (简体)',
  '中文 (繁體)',
  '日本語',
  '한국어',
  'Français',
  'Deutsch',
  'Español',
  'Русский'
];

const targetLanguages = [
  'English',
  '中文 (简体)',
  '中文 (繁體)',
  '日本語',
  '한국어',
  'Français',
  'Deutsch',
  'Español',
  'Русский'
];

async function translate() {
  if (!sourceText.value.trim() || isTranslating.value) return;
  
  isTranslating.value = true;
  error.value = '';
  targetText.value = '';
  copied.value = false;

  const prompt = `你是一个专业的翻译引擎。请将以下文本翻译为 ${targetLang.value}。
${sourceLang.value !== 'Auto Detect' ? `原语言是 ${sourceLang.value}。` : '请自动检测原语言。'}
要求：
1. 只返回翻译结果，不要任何解释说明。
2. 保持原意和语气。
3. 专有名词保留原样。

待翻译文本：
${sourceText.value}`;

  try {
    await streamGenericChatMessage(
      { 
        messages: [{ role: 'user', content: prompt }],
        model: selectedModelId.value || undefined
      },
      {
        onDelta: (data) => {
          targetText.value += data.text;
        },
        onError: (msg) => {
          error.value = msg;
          isTranslating.value = false;
        },
        onDone: () => {
          isTranslating.value = false;
        }
      }
    );
  } catch (err: any) {
    error.value = err.message || t('toolbox.aiTranslator.failed');
    isTranslating.value = false;
  }
}

function swapLangs() {
  if (sourceLang.value !== 'Auto Detect') {
    const temp = sourceLang.value;
    sourceLang.value = targetLang.value;
    targetLang.value = temp;
  }
  const tempText = sourceText.value;
  sourceText.value = targetText.value;
  targetText.value = tempText;
}

function clearSource() {
  sourceText.value = '';
  targetText.value = '';
}

function copyResult() {
  if (!targetText.value) return;
  navigator.clipboard.writeText(targetText.value);
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 2000);
}
</script>

<template>
  <div class="ai-translator google-style">
    <div class="translator-controls">
      <div class="lang-group">
        <select v-model="sourceLang" class="lang-select">
          <option v-for="lang in sourceLanguages" :key="lang" :value="lang">
            {{ lang === 'Auto Detect' ? '检测语言' : lang }}
          </option>
        </select>
      </div>

      <button class="swap-btn" @click="swapLangs" :disabled="sourceLang === 'Auto Detect'" title="切换语言">
        <ArrowLeftRight :size="14" />
      </button>

      <div class="lang-group target-lang-group">
        <select v-model="targetLang" class="lang-select">
          <option v-for="lang in targetLanguages" :key="lang" :value="lang">
            {{ lang }}
          </option>
        </select>
      </div>
    </div>

    <div class="translator-panels">
      <div class="panel input-panel">
        <textarea 
          v-model="sourceText" 
          :placeholder="t('toolbox.aiTranslator.sourcePlaceholder')" 
          @keydown.ctrl.enter="translate"
          @keydown.meta.enter="translate"
        ></textarea>
        <div class="panel-footer">
          <div class="footer-left">
            <button v-if="sourceText" class="icon-btn" @click="clearSource" title="清除">
              <X :size="18" />
            </button>
          </div>
          <div class="footer-right">
            <div class="hint">{{ t('toolbox.aiTranslator.shortcutHint') }}</div>
            <button class="translate-btn" :disabled="isTranslating || !sourceText" @click="translate">
              <RefreshCw v-if="isTranslating" class="spin" :size="16" />
              <Sparkles v-else :size="16" />
              {{ t('toolbox.aiTranslator.translate') }}
            </button>
          </div>
        </div>
      </div>

      <div class="panel output-panel">
        <div v-if="error" class="error-msg">{{ error }}</div>
        <textarea 
          readonly 
          :value="targetText" 
          :placeholder="t('toolbox.aiTranslator.targetPlaceholder')"
        ></textarea>
        <div class="panel-footer">
          <div class="footer-left"></div>
          <div class="footer-right">
            <div class="lang-group model-group">
              <Bot :size="14" class="model-icon" />
              <select v-model="selectedModelId" class="lang-select model-select">
                <option v-for="model in availableModels" :key="model.id" :value="model.id">
                  {{ model.name }}
                </option>
              </select>
            </div>
            <button class="icon-btn copy-btn" v-if="targetText" @click="copyResult" :title="copied ? t('toolbox.aiTranslator.copied') : t('toolbox.aiTranslator.copy')">
              <Check v-if="copied" :size="16" class="text-success" />
              <Copy v-else :size="16" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-translator {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 16px;
}

.translator-controls {
  display: flex;
  align-items: center;
  gap: 16px;
  position: relative;
}

.lang-group {
  flex: 1;
  display: flex;
  align-items: center;
  padding-left: 12px;
}

.target-lang-group {
  justify-content: flex-end;
  padding-left: 0;
  padding-right: 12px;
}

.lang-select {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 500;
  outline: none;
  cursor: pointer;
  padding: 6px 12px;
  transition: all 0.2s ease;
}

.lang-select:hover {
  border-color: var(--border-strong);
}

.lang-select:focus {
  border-color: var(--primary);
  background: var(--bg-surface);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
}

.model-group {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
}

.model-icon {
  flex-shrink: 0;
}

.model-select {
  max-width: 140px;
  font-size: 13px;
  font-weight: 400;
  padding: 4px 8px;
}

.lang-select option {
  background: var(--bg-surface);
  color: var(--text-primary);
}

.swap-btn {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  cursor: pointer;
  padding: 6px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  z-index: 10;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.swap-btn:hover:not(:disabled) {
  background: var(--bg-panel);
  color: var(--primary);
  border-color: var(--border-strong);
}

.swap-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.translator-panels {
  display: flex;
  gap: 16px;
  flex: 1;
  min-height: 350px;
}

.panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-lg);
  position: relative;
  transition: all 0.2s;
  overflow: hidden;
}

.input-panel {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
}

.input-panel:focus-within {
  border-color: var(--accent-primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.output-panel {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
}

textarea {
  flex: 1;
  width: 100%;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: 16px;
  line-height: 1.6;
  resize: none;
  outline: none;
  padding: 20px;
}

textarea::placeholder {
  color: var(--text-secondary);
  opacity: 0.6;
}

.panel-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px 16px;
}

.footer-left, .footer-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.hint {
  font-size: 12px;
  color: var(--text-secondary);
  opacity: 0.7;
}

.icon-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.icon-btn:hover {
  background: rgba(128, 128, 128, 0.1);
  color: var(--text-primary);
}

.translate-btn {
  background: var(--accent-primary);
  color: #fff;
  border: none;
  padding: 8px 20px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: opacity 0.2s, transform 0.1s;
}

.translate-btn:active:not(:disabled) {
  transform: scale(0.96);
}

.translate-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.text-success {
  color: var(--accent-primary);
}

.error-msg {
  color: #ef4444;
  font-size: 13px;
  padding: 16px 20px 0;
}
</style>

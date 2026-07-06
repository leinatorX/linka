<script setup lang="ts">
import { X } from "@lucide/vue";
import { useI18n } from "vue-i18n";
import type { AiModelConfig, AiProviderConfig } from "../../types";

defineProps<{
  editingAiModel: AiModelConfig | null;
  activeProvider?: AiProviderConfig;
  formData: {
    name: string;
    maxTokens: number;
    supportsVision: boolean;
  };
}>();

const visible = defineModel<boolean>("visible", { required: true });

defineEmits<{
  save: [provider: AiProviderConfig];
}>();

const { t } = useI18n();
</script>

<template>
  <div v-if="visible" class="modal-overlay" @click.self="visible = false">
    <div class="modal-card">
      <header class="modal-header">
        <h3>{{ editingAiModel ? t('settings.ai.editModelTitle') : t('settings.ai.addModelTitle') }}</h3>
        <button class="btn-close" @click="visible = false">
          <X :size="20" />
        </button>
      </header>
      <div class="modal-body settings-form">
        <label>
          <span>{{ t('settings.ai.modelName') }}</span>
          <input v-model="formData.name" placeholder="例如 deepseek-v4-flash"
            @keyup.enter="activeProvider && $emit('save', activeProvider)" />
        </label>
        <label>
          <span>{{ t('settings.ai.maxTokens') }}</span>
          <input v-model.number="formData.maxTokens" type="number" min="64" max="2000000" step="64"
            @keyup.enter="activeProvider && $emit('save', activeProvider)" />
        </label>
        <label class="model-capability-toggle">
          <span>{{ t('settings.ai.supportsVision') }}</span>
          <button type="button" class="switch-toggle" :class="{ active: formData.supportsVision }"
            @click="formData.supportsVision = !formData.supportsVision">
            <div></div>
          </button>
          <small>{{ t('settings.ai.visionHint') }}</small>
        </label>
      </div>
      <footer class="modal-footer">
        <button class="btn-secondary" @click="visible = false">{{ t('settings.ai.cancel') }}</button>
        <button class="btn-primary" :disabled="!activeProvider" @click="activeProvider && $emit('save', activeProvider)">{{ t('settings.ai.save') }}</button>
      </footer>
    </div>
  </div>
</template>

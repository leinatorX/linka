<script setup lang="ts">
import { X } from "@lucide/vue";
import type { AiModelConfig, AiProviderConfig } from "../../types";

defineProps<{
  editingAiModel: AiModelConfig | null;
  activeProvider?: AiProviderConfig;
  formData: {
    name: string;
    maxTokens: number;
  };
}>();

const visible = defineModel<boolean>("visible", { required: true });

defineEmits<{
  save: [provider: AiProviderConfig];
}>();
</script>

<template>
  <div v-if="visible" class="modal-overlay" @click.self="visible = false">
    <div class="modal-card">
      <header class="modal-header">
        <h3>{{ editingAiModel ? '编辑模型' : '添加模型' }}</h3>
        <button class="btn-close" @click="visible = false">
          <X :size="20" />
        </button>
      </header>
      <div class="modal-body settings-form">
        <label>
          <span>模型名称</span>
          <input v-model="formData.name" placeholder="例如 deepseek-v4-flash"
            @keyup.enter="activeProvider && $emit('save', activeProvider)" />
        </label>
        <label>
          <span>最大 Token</span>
          <input v-model.number="formData.maxTokens" type="number" min="64" max="2000000" step="64"
            @keyup.enter="activeProvider && $emit('save', activeProvider)" />
        </label>
      </div>
      <footer class="modal-footer">
        <button class="btn-secondary" @click="visible = false">取消</button>
        <button class="btn-primary" :disabled="!activeProvider" @click="activeProvider && $emit('save', activeProvider)">保存</button>
      </footer>
    </div>
  </div>
</template>

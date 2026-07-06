<script setup lang="ts">
import { X } from "@lucide/vue";
import { useI18n } from "vue-i18n";

const visible = defineModel<boolean>("visible", { required: true });

defineEmits<{
  confirm: [];
  cancel: [];
}>();

const { t } = useI18n();
</script>

<template>
  <div v-if="visible" class="modal-overlay" @click.self="$emit('cancel')">
    <div class="modal-card delete-provider-modal">
      <header class="modal-header">
        <h3>{{ t('settings.ai.confirmDelete') }}</h3>
        <button class="btn-close" @click="$emit('cancel')">
          <X :size="20" />
        </button>
      </header>
      <div class="modal-body">
        <p class="delete-provider-message">
          {{ t('settings.ai.deleteWarning') }}
        </p>
      </div>
      <footer class="modal-footer">
        <button class="btn-secondary" @click="$emit('cancel')">{{ t('settings.ai.cancel') }}</button>
        <button class="btn-primary danger-submit" @click="$emit('confirm')">{{ t('settings.ai.confirmDelete') }}</button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { X } from "@lucide/vue";

const visible = defineModel<boolean>("visible", { required: true });

defineEmits<{
  confirm: [];
  cancel: [];
}>();
</script>

<template>
  <div v-if="visible" class="modal-overlay" @click.self="$emit('cancel')">
    <div class="modal-card delete-provider-modal">
      <header class="modal-header">
        <h3>确认删除</h3>
        <button class="btn-close" @click="$emit('cancel')">
          <X :size="20" />
        </button>
      </header>
      <div class="modal-body">
        <p class="delete-provider-message">
          确定要删除该供应商吗？删除后所有相关的模型配置和接口密钥将被清除，此操作无法撤销。
        </p>
      </div>
      <footer class="modal-footer">
        <button class="btn-secondary" @click="$emit('cancel')">取消</button>
        <button class="btn-primary danger-submit" @click="$emit('confirm')">确认删除</button>
      </footer>
    </div>
  </div>
</template>

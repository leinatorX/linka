<script setup lang="ts">
import { AlertCircle, Check, Info } from "@lucide/vue";
import type { Toast } from "../../composables/useToast";

defineProps<{
  toasts: Toast[];
}>();
</script>

<template>
  <div class="toast-container">
    <TransitionGroup name="toast">
      <div v-for="toast in toasts" :key="toast.id" :class="['toast-item', toast.type]">
        <Check v-if="toast.type === 'success'" :size="16" />
        <AlertCircle v-else-if="toast.type === 'error' || toast.type === 'warning'" :size="16" />
        <Info v-else :size="16" />
        <span>{{ toast.message }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>

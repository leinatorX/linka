<script setup lang="ts">
import { type Component } from 'vue';

export interface SlashCommandItem {
  name: string;
  description: string;
  template: string;
  placeholder: string;
  icon: Component;
}

const props = defineProps<{
  commands: SlashCommandItem[];
  selectedIndex: number;
}>();

const emit = defineEmits<{
  select: [cmd: SlashCommandItem];
}>();
</script>

<template>
  <div class="slash-command-menu">
    <div v-if="commands.length === 0" class="slash-menu-empty">
      没有找到匹配的命令
    </div>
    <div v-for="(cmd, index) in commands" :key="cmd.name"
         class="slash-menu-item"
         :class="{ active: index === selectedIndex }"
         @mousedown.prevent
         @click="emit('select', cmd)">
      <div class="cmd-icon">
        <component :is="cmd.icon" :size="16" />
      </div>
      <div class="cmd-info">
        <div class="cmd-name-row">
          <span class="cmd-name">{{ cmd.name }}</span>
          <span v-if="cmd.placeholder" class="cmd-placeholder">{{ cmd.placeholder }}</span>
        </div>
        <div class="cmd-desc">{{ cmd.description }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.slash-command-menu {
  display: flex;
  flex-direction: column;
  background: var(--bg-surface, #ffffff);
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.08));
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  overflow: hidden;
  min-width: 280px;
  max-width: 320px;
  animation: slideUpFade 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@media (prefers-color-scheme: dark) {
  .slash-command-menu {
    background: var(--bg-surface, #1e1e1e);
    border-color: var(--border-color, rgba(255, 255, 255, 0.1));
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  }
}

.slash-menu-empty {
  padding: 12px 16px;
  color: var(--text-secondary, #888);
  font-size: 14px;
  text-align: center;
}

.slash-menu-item {
  display: flex;
  align-items: center;
  padding: 12px 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  gap: 14px;
}

.slash-menu-item:hover, .slash-menu-item.active {
  background-color: var(--bg-hover, #f4f4f5);
}

@media (prefers-color-scheme: dark) {
  .slash-menu-item:hover, .slash-menu-item.active {
    background-color: var(--bg-hover, #2a2a2b);
  }
}

.cmd-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--bg-secondary, #f4f4f5);
  color: var(--text-primary, #18181b);
  transition: all 0.2s ease;
}

.slash-menu-item:hover .cmd-icon,
.slash-menu-item.active .cmd-icon {
  background: var(--primary-color, #2563eb);
  color: #ffffff;
}

@media (prefers-color-scheme: dark) {
  .cmd-icon {
    background: var(--bg-secondary, #27272a);
    color: var(--text-primary, #e4e4e7);
  }
  
  .slash-menu-item:hover .cmd-icon,
  .slash-menu-item.active .cmd-icon {
    background: var(--primary-color, #3b82f6);
    color: #ffffff;
  }
}

.cmd-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cmd-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #18181b);
}

@media (prefers-color-scheme: dark) {
  .cmd-name-row {
    color: var(--text-primary, #e4e4e7);
  }
}

.cmd-name {
  /* Inherits from .cmd-name-row */
}

.cmd-placeholder {
  font-size: 12px;
  color: var(--text-tertiary, #a1a1aa);
  font-weight: normal;
}

@media (prefers-color-scheme: dark) {
  .cmd-placeholder {
    color: var(--text-tertiary, #71717a);
  }
}

.cmd-desc {
  font-size: 12px;
  color: var(--text-secondary, #71717a);
}

@media (prefers-color-scheme: dark) {
  .cmd-desc {
    color: var(--text-secondary, #a1a1aa);
  }
}

@keyframes slideUpFade {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>

<script setup lang="ts">
import { X } from '@lucide/vue';
import { ref, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { registeredTools } from './index';
import type { IToolWidget } from './types';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const activeTool = ref<IToolWidget | null>(null);

const { t } = useI18n();

function close() {
  activeTool.value = null;
  emit('close');
}

// Handle Escape key to close
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.isOpen) {
    if (activeTool.value) {
      activeTool.value = null;
    } else {
      close();
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen" class="toolbox-overlay" @click.self="close">
      <div class="toolbox-modal">
        <div class="toolbox-header">
          <div class="header-left">
            <button v-if="activeTool" class="back-btn" @click="activeTool = null">
              &larr; {{ t('toolbox.back') }}
            </button>
            <h2 v-else>{{ t('toolbox.title') }}</h2>
            <h2 v-if="activeTool">{{ t(activeTool.name) }}</h2>
          </div>
          <button class="close-btn" @click="close">
            <X :size="20" />
          </button>
        </div>

        <div class="toolbox-body">
          <!-- Tool Grid View -->
          <div v-if="!activeTool" class="tool-grid">
            <div 
              v-for="tool in registeredTools" 
              :key="tool.id" 
              class="tool-card"
              @click="activeTool = tool"
            >
              <div class="tool-icon" :class="`category-${tool.category}`">
                <component :is="tool.icon" :size="20" />
              </div>
              <div class="tool-info">
                <h3>{{ t(tool.name) }}</h3>
                <p>{{ t(tool.description) }}</p>
              </div>
            </div>
            
            <div v-if="registeredTools.length === 0" class="empty-state">
              <p>{{ t('toolbox.empty') }}</p>
            </div>
          </div>

          <!-- Active Tool View -->
          <div v-else class="tool-view">
            <Suspense>
              <template #default>
                <component :is="activeTool.component" />
              </template>
              <template #fallback>
                <div class="loading-state">加载中...</div>
              </template>
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.toolbox-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toolbox-modal {
  width: 90%;
  max-width: 800px;
  height: 80vh;
  max-height: 600px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl, 16px);
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.toolbox-header {
  height: 64px;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-subtle);
  background: rgba(255, 255, 255, 0.02);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-left h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.back-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 6px;
  transition: all 0.2s;
}

.back-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
}

.close-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
}

.toolbox-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.tool-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

.tool-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg, 12px);
  padding: 16px;
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 16px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.tool-card:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.1);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.tool-icon {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  box-shadow: inset 0 2px 4px rgba(255, 255, 255, 0.2);
}

.category-ai { background: linear-gradient(135deg, #8b5cf6, #6d28d9); }
.category-dev { background: linear-gradient(135deg, #3b82f6, #1d4ed8); }
.category-utility { background: linear-gradient(135deg, #10b981, #047857); }
.category-design { background: linear-gradient(135deg, #f59e0b, #d97706); }

.tool-info h3 {
  margin: 0 0 4px 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.tool-info p {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.4;
}

.empty-state, .loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--text-secondary);
  font-size: 14px;
}

.tool-view {
  height: 100%;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-enter-active .toolbox-modal {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.fade-leave-active .toolbox-modal {
  transition: all 0.2s ease-in;
}

.fade-enter-from .toolbox-modal {
  opacity: 0;
  transform: translateY(20px) scale(0.98);
}

.fade-leave-to .toolbox-modal {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}
</style>

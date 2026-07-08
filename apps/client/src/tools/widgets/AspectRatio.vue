<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ChevronDown } from '@lucide/vue';

const { t } = useI18n();

const ratios = computed(() => [
  { ratio: '16:9', desc: 'YouTube', value: '16:9' },
  { ratio: '4:3', desc: t('toolbox.aspectRatio.classic'), value: '4:3' },
  { ratio: '21:9', desc: t('toolbox.aspectRatio.ultrawide'), value: '21:9' },
  { ratio: '1:1', desc: t('toolbox.aspectRatio.square'), value: '1:1' },
  { ratio: '9:16', desc: 'TikTok', value: '9:16' },
  { ratio: '4:5', desc: `Instagram ${t('toolbox.aspectRatio.portrait')}`, value: '4:5' },
  { ratio: '3:2', desc: 'DSLR', value: '3:2' },
  { ratio: '5:4', desc: '8×10', value: '5:4' },
]);

const activeRatio = ref('16:9');
const customRatioVal = ref('2.35:1');
const showCustomInput = ref(false);

const width = ref<number | null>(1920);
const height = ref<number | null>(1080);

let isUpdating = false;

function getRatioValue() {
  const str = activeRatio.value === 'custom' ? customRatioVal.value : activeRatio.value;
  if (!str) return null;
  const parts = str.split(':');
  if (parts.length === 2) {
    const w = parseFloat(parts[0]);
    const h = parseFloat(parts[1]);
    if (w && h) return w / h;
  }
  return null;
}

watch([activeRatio, customRatioVal], () => {
  if (width.value) {
    const ratio = getRatioValue();
    if (ratio) {
      isUpdating = true;
      height.value = Math.round((width.value / ratio) * 100) / 100;
      setTimeout(() => { isUpdating = false; }, 0);
    }
  }
});

watch(width, (newW) => {
  if (isUpdating || !newW) return;
  const ratio = getRatioValue();
  if (ratio) {
    isUpdating = true;
    height.value = Math.round((newW / ratio) * 100) / 100;
    setTimeout(() => { isUpdating = false; }, 0);
  }
});

watch(height, (newH) => {
  if (isUpdating || !newH) return;
  const ratio = getRatioValue();
  if (ratio) {
    isUpdating = true;
    width.value = Math.round((newH * ratio) * 100) / 100;
    setTimeout(() => { isUpdating = false; }, 0);
  }
});

function selectRatio(val: string) {
  activeRatio.value = val;
  showCustomInput.value = false;
}

function selectCustom() {
  if (activeRatio.value === 'custom') {
    showCustomInput.value = !showCustomInput.value;
  } else {
    activeRatio.value = 'custom';
    showCustomInput.value = true;
  }
}
</script>

<template>
  <div class="aspect-ratio-tool">
    <div class="ratio-tabs">
      <button 
        v-for="r in ratios" 
        :key="r.value"
        class="ratio-tab" 
        :class="{ active: activeRatio === r.value }"
        @click="selectRatio(r.value)"
      >
        <span class="ratio-val">{{ r.ratio }}</span>
        <span class="ratio-desc">{{ r.desc }}</span>
      </button>

      <div class="custom-tab-container">
        <button 
          class="ratio-tab custom-tab" 
          :class="{ active: activeRatio === 'custom' }"
          @click="selectCustom"
        >
          <div class="custom-content">
            <span class="ratio-val">{{ t('toolbox.aspectRatio.custom') }}</span>
            <span class="ratio-desc">{{ customRatioVal }}</span>
          </div>
          <ChevronDown :size="14" class="custom-icon" />
        </button>
        
        <div v-if="showCustomInput" class="custom-input-popover">
          <input 
            v-model="customRatioVal" 
            :placeholder="t('toolbox.aspectRatio.customExample')"
            @keyup.enter="showCustomInput = false"
          />
        </div>
      </div>
    </div>

    <div class="calc-area">
      <div class="input-col">
        <label>{{ t('toolbox.aspectRatio.width') }}</label>
        <input 
          type="number" 
          v-model="width" 
          class="huge-input"
          :placeholder="t('toolbox.aspectRatio.placeholder')" 
        />
      </div>
      
      <div class="divider">
        <div class="line"></div>
        <div class="icon">×</div>
        <div class="line"></div>
      </div>

      <div class="input-col">
        <label>{{ t('toolbox.aspectRatio.height') }}</label>
        <input 
          type="number" 
          v-model="height" 
          class="huge-input"
          :placeholder="t('toolbox.aspectRatio.placeholder')" 
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.aspect-ratio-tool {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.ratio-tabs {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 16px 24px;
}

.ratio-tab {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  cursor: pointer;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
}

.ratio-tab:hover {
  background: var(--bg-panel);
  border-color: var(--border-strong);
}

.ratio-tab.active {
  background: rgba(var(--primary-rgb), 0.1);
  border-color: var(--primary);
}

.ratio-val {
  color: var(--primary);
  font-weight: 600;
  font-size: 14px;
}

.ratio-desc {
  color: var(--text-secondary);
  font-size: 13px;
}

.custom-tab-container {
  position: relative;
}

.custom-content {
  display: flex;
  align-items: center;
  gap: 6px;
}

.custom-icon {
  color: var(--text-secondary);
}

.custom-input-popover {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 4px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  z-index: 20;
}

.custom-input-popover input {
  background: var(--bg-panel);
  border: 1px solid var(--border-subtle);
  color: var(--text-primary);
  padding: 6px 10px;
  border-radius: 6px;
  outline: none;
  width: 100px;
  text-align: center;
}

.custom-input-popover input:focus {
  border-color: var(--primary);
}

.calc-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 48px;
  padding: 48px 24px;
}

.input-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.input-col label {
  color: var(--primary);
  font-size: 16px;
  font-weight: 500;
  letter-spacing: 2px;
}

.huge-input {
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: 48px;
  font-weight: 600;
  text-align: center;
  outline: none;
  width: 240px;
  padding: 0;
  transition: opacity 0.2s;
}

.huge-input:focus {
  opacity: 0.9;
}

.huge-input::placeholder {
  color: var(--text-secondary);
  opacity: 0.2;
  font-size: 36px;
  font-weight: 400;
}

.huge-input::-webkit-outer-spin-button,
.huge-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.divider {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: var(--text-secondary);
  gap: 16px;
  height: 140px;
}

.divider .line {
  flex: 1;
  width: 1px;
  background: var(--border-subtle);
  opacity: 0.5;
}

.divider .icon {
  font-size: 28px;
  font-weight: 300;
  color: var(--text-primary);
}
</style>

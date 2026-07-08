<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Copy, RefreshCcw, Square, Play, Clock, Calendar } from '@lucide/vue';
import { useToast } from '../../composables/useToast';

const { t } = useI18n();
const { showToast } = useToast();

const isRunning = ref(true);
const currentUnit = ref<'s' | 'ms'>('s');
const currentTime = ref(Date.now());
let timer: ReturnType<typeof setInterval> | null = null;

const displayTime = computed(() => {
  if (currentUnit.value === 's') return Math.floor(currentTime.value / 1000);
  return currentTime.value;
});

function startTimer() {
  if (timer) return;
  isRunning.value = true;
  timer = setInterval(() => {
    currentTime.value = Date.now();
  }, 50);
}

function stopTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  isRunning.value = false;
}

function toggleTimer() {
  if (isRunning.value) stopTimer();
  else startTimer();
}

function toggleUnit() {
  currentUnit.value = currentUnit.value === 's' ? 'ms' : 's';
}

function copyText(text: string | number) {
  navigator.clipboard.writeText(text.toString());
  showToast(t('toolbox.timestamp.clickToCopy'));
}

onMounted(() => {
  startTimer();
});
onUnmounted(() => {
  stopTimer();
});

// === Converter Section ===
const tsInput = ref('');
const tsInputUnit = ref<'s' | 'ms'>('s');
const tsOutput = ref('');
const tsTimezone = ref('local');

function convertTsToDate() {
  if (!tsInput.value) {
    tsOutput.value = '';
    return;
  }
  let ms = Number(tsInput.value);
  if (isNaN(ms)) {
    tsOutput.value = t('toolbox.timestamp.invalidFormat');
    return;
  }
  if (tsInputUnit.value === 's') ms *= 1000;
  
  try {
    if (tsTimezone.value === 'local') {
      const d = new Date(ms);
      tsOutput.value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
    } else {
      const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: tsTimezone.value,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
      });
      const parts = formatter.formatToParts(new Date(ms));
      const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
      tsOutput.value = `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
    }
  } catch (e) {
    tsOutput.value = t('toolbox.timestamp.convertFailed');
  }
}

const dtInput = ref('');
const dtTimezone = ref('local');
const dtOutput = ref('');
const dtOutputUnit = ref<'s' | 'ms'>('s');

function convertDateToTs() {
  if (!dtInput.value) {
    dtOutput.value = '';
    return;
  }
  let str = dtInput.value.trim();
  str = str.replace(/\//g, '-');
  
  let d: Date;
  if (dtTimezone.value === 'UTC') {
    if (!str.endsWith('Z')) str += 'Z';
    d = new Date(str);
  } else {
    d = new Date(str);
  }
  
  if (isNaN(d.getTime())) {
    dtOutput.value = t('toolbox.timestamp.invalidFormat');
    return;
  }
  let result = d.getTime();
  if (dtOutputUnit.value === 's') result = Math.floor(result / 1000);
  dtOutput.value = result.toString();
}
</script>

<template>
  <div class="timestamp-tool">
    <!-- Top Current Timestamp -->
    <div class="current-card">
      <div class="card-header">{{ t('toolbox.timestamp.currentTime') }}</div>
      <div class="time-display">
        <span class="time-val">{{ displayTime }}</span>
        <span class="time-unit">{{ currentUnit === 's' ? t('toolbox.timestamp.seconds') : t('toolbox.timestamp.milliseconds') }}</span>
      </div>
      <div class="time-actions">
        <button class="action-btn" @click="toggleUnit">
          <RefreshCcw :size="14" /> {{ t('toolbox.timestamp.switchUnit') }}
        </button>
        <button class="action-btn" @click="copyText(displayTime)">
          <Copy :size="14" /> {{ t('toolbox.timestamp.copy') }}
        </button>
        <button class="action-btn stop-btn" :class="{ running: isRunning }" @click="toggleTimer">
          <Square v-if="isRunning" :size="12" fill="currentColor" />
          <Play v-else :size="12" fill="currentColor" /> 
          {{ isRunning ? t('toolbox.timestamp.stop') : t('toolbox.timestamp.start') }}
        </button>
      </div>
    </div>

    <!-- Converter Section -->
    <div class="convert-section">
      <div class="section-title">
        <Clock :size="16" /> {{ t('toolbox.timestamp.toDateTime') }}
      </div>
      <div class="convert-row">
        <input class="c-input flex-2" v-model="tsInput" :placeholder="t('toolbox.timestamp.timestampPlaceholder')" @keyup.enter="convertTsToDate" />
        <select class="c-select flex-1" v-model="tsInputUnit">
          <option value="s">{{ t('toolbox.timestamp.secondsShort') }}</option>
          <option value="ms">{{ t('toolbox.timestamp.millisecondsShort') }}</option>
        </select>
        <button class="c-btn primary" @click="convertTsToDate">{{ t('toolbox.timestamp.convert') }}</button>
        <input class="c-input flex-2 readonly" readonly v-model="tsOutput" :placeholder="t('toolbox.timestamp.result')" />
        <select class="c-select flex-1" v-model="tsTimezone">
          <option value="local">{{ t('toolbox.timestamp.localTime') }}</option>
          <option value="UTC">UTC</option>
          <option value="Asia/Shanghai">Asia/Shanghai</option>
        </select>
      </div>

      <div class="section-title mt-32">
        <Calendar :size="16" /> {{ t('toolbox.timestamp.toTimestamp') }}
      </div>
      <div class="convert-row">
        <input class="c-input flex-2" v-model="dtInput" :placeholder="t('toolbox.timestamp.datePlaceholder')" @keyup.enter="convertDateToTs" />
        <select class="c-select flex-1" v-model="dtTimezone">
          <option value="local">{{ t('toolbox.timestamp.localTime') }}</option>
          <option value="UTC">UTC</option>
          <option value="Asia/Shanghai">Asia/Shanghai</option>
        </select>
        <button class="c-btn primary" @click="convertDateToTs">{{ t('toolbox.timestamp.convert') }}</button>
        <input class="c-input flex-2 readonly" readonly v-model="dtOutput" :placeholder="t('toolbox.timestamp.result')" />
        <select class="c-select flex-1" v-model="dtOutputUnit">
          <option value="s">{{ t('toolbox.timestamp.secondsShort') }}</option>
          <option value="ms">{{ t('toolbox.timestamp.millisecondsShort') }}</option>
        </select>
      </div>
    </div>
  </div>
</template>

<style scoped>
.timestamp-tool {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 800px;
  margin: 0 auto;
  padding: 16px 0;
}

.current-card {
  padding: 8px 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card-header {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.time-display {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.time-val {
  font-size: 36px;
  font-weight: 600;
  color: var(--text-primary);
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace);
}

.time-unit {
  font-size: 14px;
  color: var(--text-secondary);
}

.time-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-panel);
  border: 1px solid var(--border-subtle);
  color: var(--text-primary);
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  background: var(--bg-surface-hover);
}

.stop-btn.running {
  background: #dc3545;
  border-color: #dc3545;
  color: white;
}

.stop-btn.running:hover {
  background: #c82333;
}

.convert-section {
  padding: 8px 16px;
  display: flex;
  flex-direction: column;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16px;
}

.mt-32 {
  margin-top: 32px;
}

.convert-row {
  display: flex;
  align-items: stretch;
  gap: 8px;
  height: 40px;
  width: 100%;
}

.flex-1 { flex: 1; min-width: 0; }
.flex-2 { flex: 2; min-width: 0; }

.c-input, .c-select {
  background: var(--bg-panel);
  border: 1px solid var(--border-subtle);
  color: var(--text-primary);
  padding: 0 12px;
  border-radius: 6px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.c-input:focus, .c-select:focus {
  border-color: var(--primary);
}

.c-input.readonly {
  background: rgba(0, 0, 0, 0.02);
  color: var(--text-secondary);
}

.c-btn {
  background: var(--bg-panel);
  border: 1px solid var(--border-subtle);
  color: var(--text-primary);
  padding: 0 20px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
}

.c-btn.primary {
  background: var(--accent-primary);
  color: #fff;
  border-color: transparent;
}

.c-btn.primary:hover {
  opacity: 0.9;
}
</style>

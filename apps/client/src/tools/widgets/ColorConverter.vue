<script setup lang="ts">
import { ref, watch, computed, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { Copy } from '@lucide/vue';
import { useToast } from '../../composables/useToast';

const { t } = useI18n();
const { showToast } = useToast();

// Source of truth for HSV and RGB
const h = ref(217);
const s = ref(0.91);
const v = ref(0.96);

const r = ref(59);
const g = ref(130);
const b = ref(246);
const a = ref(1);

const colorInput = ref('#3B82F6');

// Sync flags to prevent watch loops
let isSyncing = false;

function updateRgbFromHsv() {
  if (isSyncing) return;
  isSyncing = true;
  
  let r_out = 0, g_out = 0, b_out = 0;
  if (s.value === 0) {
    r_out = v.value; g_out = v.value; b_out = v.value;
  } else {
    let h_val = h.value === 360 ? 0 : h.value / 60;
    let i = Math.floor(h_val);
    let f = h_val - i;
    let p = v.value * (1 - s.value);
    let q = v.value * (1 - f * s.value);
    let t_val = v.value * (1 - (1 - f) * s.value);
    switch (i) {
      case 0: r_out = v.value; g_out = t_val; b_out = p; break;
      case 1: r_out = q; g_out = v.value; b_out = p; break;
      case 2: r_out = p; g_out = v.value; b_out = t_val; break;
      case 3: r_out = p; g_out = q; b_out = v.value; break;
      case 4: r_out = t_val; g_out = p; b_out = v.value; break;
      case 5: r_out = v.value; g_out = p; b_out = q; break;
    }
  }
  r.value = Math.round(r_out * 255);
  g.value = Math.round(g_out * 255);
  b.value = Math.round(b_out * 255);
  updateHexFromRgb();
  
  setTimeout(() => isSyncing = false, 0);
}

function updateHsvFromRgb() {
  if (isSyncing) return;
  isSyncing = true;
  
  let r_norm = r.value / 255;
  let g_norm = g.value / 255;
  let b_norm = b.value / 255;
  let max = Math.max(r_norm, g_norm, b_norm);
  let min = Math.min(r_norm, g_norm, b_norm);
  let d = max - min;
  
  v.value = max;
  s.value = max === 0 ? 0 : d / max;
  
  if (max === min) {
    // Keep original hue if grayscale to prevent cursor jumping to left edge
    // h.value = 0; 
  } else {
    let h_out = 0;
    switch (max) {
      case r_norm: h_out = (g_norm - b_norm) / d + (g_norm < b_norm ? 6 : 0); break;
      case g_norm: h_out = (b_norm - r_norm) / d + 2; break;
      case b_norm: h_out = (r_norm - g_norm) / d + 4; break;
    }
    h.value = Math.round(h_out * 60);
  }
  updateHexFromRgb();
  
  setTimeout(() => isSyncing = false, 0);
}

function updateHexFromRgb() {
  const newHex = '#' + ((1 << 24) + (r.value << 16) + (g.value << 8) + b.value).toString(16).slice(1).toUpperCase();
  if (colorInput.value.toUpperCase() !== newHex.toUpperCase()) {
    colorInput.value = newHex;
  }
}

function onHexInput() {
  let hex = colorInput.value;
  if (/^#?([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex)) {
    let cleanHex = hex.replace('#', '');
    if (cleanHex.length === 3) {
      cleanHex = cleanHex.split('').map(c => c + c).join('');
    }
    r.value = parseInt(cleanHex.substring(0, 2), 16);
    g.value = parseInt(cleanHex.substring(2, 4), 16);
    b.value = parseInt(cleanHex.substring(4, 6), 16);
    updateHsvFromRgb();
  }
}

// 2D Picker Logic
const svBoard = ref<HTMLElement | null>(null);
let isDraggingSv = false;

function onSvMouseDown(e: MouseEvent) {
  isDraggingSv = true;
  updateSvFromMouse(e);
  window.addEventListener('mousemove', onSvMouseMove);
  window.addEventListener('mouseup', onSvMouseUp);
}

function onSvMouseMove(e: MouseEvent) {
  if (!isDraggingSv) return;
  updateSvFromMouse(e);
}

function onSvMouseUp() {
  isDraggingSv = false;
  window.removeEventListener('mousemove', onSvMouseMove);
  window.removeEventListener('mouseup', onSvMouseUp);
}

function updateSvFromMouse(e: MouseEvent) {
  if (!svBoard.value) return;
  const rect = svBoard.value.getBoundingClientRect();
  let x = e.clientX - rect.left;
  let y = e.clientY - rect.top;
  
  x = Math.max(0, Math.min(x, rect.width));
  y = Math.max(0, Math.min(y, rect.height));
  
  s.value = x / rect.width;
  v.value = 1 - (y / rect.height);
  
  updateRgbFromHsv();
}

onUnmounted(() => {
  window.removeEventListener('mousemove', onSvMouseMove);
  window.removeEventListener('mouseup', onSvMouseUp);
});

// Formats Output
const hexOutput = computed(() => {
  return '#' + ((1 << 24) + (r.value << 16) + (g.value << 8) + b.value).toString(16).slice(1).toUpperCase();
});

const rgbOutput = computed(() => {
  return `rgb(${r.value}, ${g.value}, ${b.value})`;
});

const rgbaOutput = computed(() => {
  return `rgba(${r.value}, ${g.value}, ${b.value}, ${a.value})`;
});

const hslOutput = computed(() => {
  let r_norm = r.value / 255;
  let g_norm = g.value / 255;
  let b_norm = b.value / 255;

  let max = Math.max(r_norm, g_norm, b_norm), min = Math.min(r_norm, g_norm, b_norm);
  let h_out = 0, s_out = 0, l = (max + min) / 2;

  if (max !== min) {
    let d = max - min;
    s_out = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r_norm: h_out = (g_norm - b_norm) / d + (g_norm < b_norm ? 6 : 0); break;
      case g_norm: h_out = (b_norm - r_norm) / d + 2; break;
      case b_norm: h_out = (r_norm - g_norm) / d + 4; break;
    }
    h_out /= 6;
  }
  return `hsl(${Math.round(h_out * 360)}, ${Math.round(s_out * 100)}%, ${Math.round(l * 100)}%)`;
});

function copy(text: string) {
  navigator.clipboard.writeText(text);
  showToast(t('toolbox.colorConverter.copied'));
}
</script>

<template>
  <div class="color-tool">
    <div class="picker-section">
      
      <!-- Embedded SV Picker -->
      <div class="picker-left">
        <div class="sv-board" ref="svBoard" @mousedown="onSvMouseDown" :style="{ backgroundColor: `hsl(${h}, 100%, 50%)` }">
          <div class="sv-white"></div>
          <div class="sv-black"></div>
          <div class="sv-cursor" :style="{ left: `${s * 100}%`, top: `${(1 - v) * 100}%` }"></div>
        </div>
        
        <div class="picker-controls">
          <div class="preview-circle">
            <div class="color-fill" :style="{ backgroundColor: rgbaOutput }"></div>
          </div>
          <div class="picker-hue-wrap">
            <input type="range" min="0" max="360" v-model.number="h" @input="updateRgbFromHsv" class="custom-slider hue-slider" />
          </div>
        </div>
      </div>
      
      <div class="input-controls">
        <div class="control-row hex-row">
          <label>HEX</label>
          <input type="text" v-model="colorInput" @input="onHexInput" class="c-input hex-input" spellcheck="false" />
        </div>
        
        <div class="sliders">
          <div class="slider-group">
            <label>R</label>
            <div class="slider-track-wrap">
              <input type="range" min="0" max="255" v-model.number="r" @input="updateHsvFromRgb" class="custom-slider r-slider" />
            </div>
            <input type="number" min="0" max="255" v-model.number="r" @input="updateHsvFromRgb" class="c-input num-input" />
          </div>
          <div class="slider-group">
            <label>G</label>
            <div class="slider-track-wrap">
              <input type="range" min="0" max="255" v-model.number="g" @input="updateHsvFromRgb" class="custom-slider g-slider" />
            </div>
            <input type="number" min="0" max="255" v-model.number="g" @input="updateHsvFromRgb" class="c-input num-input" />
          </div>
          <div class="slider-group">
            <label>B</label>
            <div class="slider-track-wrap">
              <input type="range" min="0" max="255" v-model.number="b" @input="updateHsvFromRgb" class="custom-slider b-slider" />
            </div>
            <input type="number" min="0" max="255" v-model.number="b" @input="updateHsvFromRgb" class="c-input num-input" />
          </div>
          <div class="slider-group">
            <label>A</label>
            <div class="slider-track-wrap alpha-track-wrap" :style="{ '--rgb': `${r}, ${g}, ${b}` }">
              <input type="range" min="0" max="1" step="0.01" v-model.number="a" class="custom-slider a-slider" />
            </div>
            <input type="number" min="0" max="1" step="0.01" v-model.number="a" class="c-input num-input" />
          </div>
        </div>
      </div>
    </div>

    <div class="formats-list">
      <div class="format-item">
        <div class="format-label">HEX</div>
        <div class="format-val">{{ hexOutput }}</div>
        <button class="icon-btn" @click="copy(hexOutput)"><Copy :size="16" /></button>
      </div>
      <div class="format-item">
        <div class="format-label">RGB</div>
        <div class="format-val">{{ rgbOutput }}</div>
        <button class="icon-btn" @click="copy(rgbOutput)"><Copy :size="16" /></button>
      </div>
      <div class="format-item">
        <div class="format-label">RGBA</div>
        <div class="format-val">{{ rgbaOutput }}</div>
        <button class="icon-btn" @click="copy(rgbaOutput)"><Copy :size="16" /></button>
      </div>
      <div class="format-item">
        <div class="format-label">HSL</div>
        <div class="format-val">{{ hslOutput }}</div>
        <button class="icon-btn" @click="copy(hslOutput)"><Copy :size="16" /></button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.color-tool {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 650px;
  margin: 0 auto;
}

.picker-section {
  display: flex;
  gap: 32px;
  align-items: center;
  padding: 0 8px;
}

/* Embedded Picker Left Side */
.picker-left {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 220px;
  flex-shrink: 0;
}

.sv-board {
  width: 100%;
  height: 160px;
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  cursor: crosshair;
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.1), 0 0 0 1px rgba(255,255,255,0.05);
  background-color: #f00; /* fallback */
  transition: background-color 0.1s;
}

.sv-white {
  position: absolute;
  inset: 0;
  background: linear-gradient(to right, #fff, rgba(255,255,255,0));
}

.sv-black {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, #000, rgba(0,0,0,0));
}

.sv-cursor {
  position: absolute;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 0 2px rgba(0,0,0,0.5), inset 0 0 1px rgba(0,0,0,0.3);
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 2;
}

.picker-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.preview-circle {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  border: 1px solid var(--border-subtle);
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);
  background-image: linear-gradient(45deg, #ccc 25%, transparent 25%), 
                    linear-gradient(-45deg, #ccc 25%, transparent 25%), 
                    linear-gradient(45deg, transparent 75%, #ccc 75%), 
                    linear-gradient(-45deg, transparent 75%, #ccc 75%);
  background-size: 10px 10px;
  background-position: 0 0, 0 5px, 5px -5px, -5px 0px;
  background-color: #fff;
  flex-shrink: 0;
}

.color-fill {
  width: 100%;
  height: 100%;
  transition: background-color 0.1s;
}

.picker-hue-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  position: relative;
  height: 12px;
}

.hue-slider {
  position: absolute;
  inset: 0;
}

.hue-slider::-webkit-slider-runnable-track {
  background: linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%);
  height: 12px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.hue-slider::-moz-range-track {
  background: linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%);
  height: 12px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.hue-slider::-webkit-slider-thumb {
  margin-top: -6px; /* (12 - 24) / 2 */
  height: 24px;
  width: 24px;
}
.hue-slider::-moz-range-thumb {
  height: 20px;
  width: 20px;
}

/* Input Controls Right Side */
.input-controls {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 20px;
}

.control-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.control-row label, .slider-group label {
  font-weight: 600;
  font-size: 14px;
  width: 32px;
  color: var(--text-secondary);
  letter-spacing: 0.5px;
}

.c-input {
  background: var(--bg-panel);
  border: 1px solid var(--border-subtle);
  color: var(--text-primary);
  border-radius: 8px;
  padding: 8px 12px;
  outline: none;
  font-family: var(--font-mono, monospace);
  font-size: 14px;
  transition: all 0.2s;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05);
}

.c-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.hex-input {
  flex: 1;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.sliders {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.slider-group {
  display: flex;
  align-items: center;
  gap: 16px;
}

.slider-track-wrap {
  flex: 1;
  position: relative;
  height: 16px;
  display: flex;
  align-items: center;
}

/* Custom Sliders (R, G, B, A) */
.custom-slider {
  -webkit-appearance: none;
  width: 100%;
  height: 8px;
  background: transparent;
  outline: none;
  margin: 0;
  z-index: 2;
}

.custom-slider::-webkit-slider-runnable-track {
  width: 100%;
  height: 8px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.custom-slider::-moz-range-track {
  width: 100%;
  height: 8px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.r-slider::-webkit-slider-runnable-track { background: linear-gradient(to right, #000, #ff0000); }
.g-slider::-webkit-slider-runnable-track { background: linear-gradient(to right, #000, #00ff00); }
.b-slider::-webkit-slider-runnable-track { background: linear-gradient(to right, #000, #0000ff); }

.r-slider::-moz-range-track { background: linear-gradient(to right, #000, #ff0000); }
.g-slider::-moz-range-track { background: linear-gradient(to right, #000, #00ff00); }
.b-slider::-moz-range-track { background: linear-gradient(to right, #000, #0000ff); }

.alpha-track-wrap {
  border-radius: 4px;
  background-image: linear-gradient(45deg, #555 25%, transparent 25%), 
                    linear-gradient(-45deg, #555 25%, transparent 25%), 
                    linear-gradient(45deg, transparent 75%, #555 75%), 
                    linear-gradient(-45deg, transparent 75%, #555 75%);
  background-size: 10px 10px;
  background-position: 0 0, 0 5px, 5px -5px, -5px 0px;
  background-color: #333;
  position: relative;
  height: 8px;
  align-self: center;
  border: 1px solid rgba(255,255,255,0.1);
}
.alpha-track-wrap::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 4px;
  background: linear-gradient(to right, transparent, rgb(var(--rgb)));
  pointer-events: none;
}
.a-slider::-webkit-slider-runnable-track { background: transparent; border: none; }
.a-slider::-moz-range-track { background: transparent; border: none; }

.custom-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  height: 20px;
  width: 20px;
  border-radius: 50%;
  background: #ffffff;
  border: 2px solid #ddd;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  cursor: grab;
  margin-top: -6px;
  transition: transform 0.1s;
}

.custom-slider::-webkit-slider-thumb:active {
  cursor: grabbing;
  transform: scale(1.15);
}

.custom-slider::-moz-range-thumb {
  height: 16px;
  width: 16px;
  border-radius: 50%;
  background: #ffffff;
  border: 2px solid #ddd;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  cursor: grab;
  transition: transform 0.1s;
}
.custom-slider::-moz-range-thumb:active {
  cursor: grabbing;
  transform: scale(1.15);
}

.num-input {
  width: 64px;
  padding: 8px;
  text-align: center;
  -moz-appearance: textfield;
}
.num-input::-webkit-outer-spin-button,
.num-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

/* Formats List - Grid Layout */
.formats-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 0 8px;
}

.format-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  transition: border-color 0.2s, transform 0.2s;
}

.format-item:hover {
  border-color: var(--primary);
  transform: translateY(-1px);
}

.format-label {
  font-weight: 600;
  color: var(--text-secondary);
  width: 50px;
  font-size: 13px;
  letter-spacing: 0.5px;
}

.format-val {
  flex: 1;
  font-family: var(--font-mono, monospace);
  color: var(--text-primary);
  font-size: 14px;
}

.icon-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.icon-btn:hover {
  color: var(--text-primary);
  background: var(--bg-surface-hover);
  transform: scale(1.05);
}
</style>

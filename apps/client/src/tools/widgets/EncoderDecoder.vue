<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Copy, ArrowDownUp, Upload, Image as ImageIcon, Trash2 } from '@lucide/vue';
import { useToast } from '../../composables/useToast';

const { t } = useI18n();
const { showToast } = useToast();

type Mode = 'Text Base64' | 'Image Base64' | 'URL';
const modes: Mode[] = ['Text Base64', 'Image Base64', 'URL'];
const currentMode = ref<Mode>('Text Base64');

// Text/URL state
const inputStr = ref('');
const outputStr = ref('');
const errorMsg = ref('');

// Image state (Unified)
const imageBase64 = ref<string>('');
const fileInput = ref<HTMLInputElement | null>(null);

function copy(text: string) {
  if (!text) return;
  navigator.clipboard.writeText(text);
  showToast(t('toolbox.encoderDecoder.copied'));
}

function encode() {
  errorMsg.value = '';
  if (!inputStr.value) {
    outputStr.value = '';
    return;
  }
  try {
    if (currentMode.value === 'Text Base64') {
      outputStr.value = btoa(unescape(encodeURIComponent(inputStr.value)));
    } else {
      outputStr.value = encodeURIComponent(inputStr.value);
    }
  } catch (e) {
    errorMsg.value = t('toolbox.encoderDecoder.encodeFailed');
  }
}

function decode() {
  errorMsg.value = '';
  if (!inputStr.value) {
    outputStr.value = '';
    return;
  }
  try {
    if (currentMode.value === 'Text Base64') {
      outputStr.value = decodeURIComponent(escape(atob(inputStr.value)));
    } else {
      outputStr.value = decodeURIComponent(inputStr.value);
    }
  } catch (e) {
    errorMsg.value = t('toolbox.encoderDecoder.decodeFailed');
  }
}

function swap() {
  inputStr.value = outputStr.value;
  outputStr.value = '';
}

function clearImage() {
  imageBase64.value = '';
  if (fileInput.value) fileInput.value.value = '';
}

// Image handling
function triggerUpload() {
  fileInput.value?.click();
}

function onFileChange(e: Event) {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    processImageFile(target.files[0]);
  }
}

function onDrop(e: DragEvent) {
  if (e.dataTransfer && e.dataTransfer.files.length > 0) {
    processImageFile(e.dataTransfer.files[0]);
  }
}

function processImageFile(file: File) {
  if (!file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    imageBase64.value = e.target?.result as string;
  };
  reader.readAsDataURL(file);
}

const imageSrc = computed(() => {
  if (!imageBase64.value) return '';
  let val = imageBase64.value.trim();
  if (val.startsWith('data:image/')) return val;
  return 'data:image/png;base64,' + val;
});

function getModeLabel(mode: Mode) {
  if (mode === 'Text Base64') return t('toolbox.encoderDecoder.textMode');
  if (mode === 'Image Base64') return t('toolbox.encoderDecoder.imageMode');
  return 'URL';
}
</script>

<template>
  <div class="encoder-tool">
    <div class="mode-tabs-wrapper">
      <div class="mode-tabs">
        <button 
          v-for="mode in modes" 
          :key="mode"
          class="mode-btn"
          :class="{ active: currentMode === mode }"
          @click="currentMode = mode"
        >
          {{ getModeLabel(mode) }}
        </button>
      </div>
    </div>

    <!-- Text / URL Mode -->
    <div v-if="currentMode === 'Text Base64' || currentMode === 'URL'" class="unified-section">
      <div class="io-box">
        <div class="io-header">
          <span>{{ t('toolbox.encoderDecoder.input') }}</span>
        </div>
        <textarea 
          v-model="inputStr" 
          class="io-textarea" 
          :placeholder="t('toolbox.encoderDecoder.inputPlaceholder')"
        ></textarea>
      </div>

      <div class="actions">
        <button class="action-btn primary" @click="encode">{{ t('toolbox.encoderDecoder.encode') }}</button>
        <button class="action-btn icon-only" @click="swap" :title="t('toolbox.encoderDecoder.swap')">
          <ArrowDownUp :size="18" />
        </button>
        <button class="action-btn secondary" @click="decode">{{ t('toolbox.encoderDecoder.decode') }}</button>
      </div>

      <div class="io-box">
        <div class="io-header">
          <span>{{ t('toolbox.encoderDecoder.output') }}</span>
          <button class="icon-btn" @click="copy(outputStr)" v-if="outputStr">
            <Copy :size="16" />
          </button>
        </div>
        <textarea 
          v-model="outputStr" 
          class="io-textarea output" 
          readonly
          :placeholder="t('toolbox.encoderDecoder.outputPlaceholder')"
        ></textarea>
        <div class="error-msg" v-if="errorMsg">{{ errorMsg }}</div>
      </div>
    </div>

    <!-- Image Base64 Mode -->
    <div v-if="currentMode === 'Image Base64'" class="unified-section">
      <div 
        class="drop-zone" 
        :class="{ 'has-image': imageBase64 }"
        @click="triggerUpload" 
        @drop.prevent="onDrop" 
        @dragover.prevent
      >
        <input type="file" ref="fileInput" @change="onFileChange" accept="image/*" hidden />
        
        <template v-if="imageBase64">
           <img :src="imageSrc" class="preview-img" />
           <div class="drop-zone-overlay">
              <Upload :size="24" class="mb-2" />
              <span>{{ t('toolbox.encoderDecoder.changeImage') }}</span>
           </div>
           <button class="clear-img-btn" @click.stop="clearImage" title="Clear">
             <Trash2 :size="16" />
           </button>
        </template>
        <template v-else>
           <div class="drop-zone-empty">
             <div class="icon-wrapper">
               <ImageIcon :size="40" class="empty-icon" />
             </div>
             <span class="empty-title">{{ t('toolbox.encoderDecoder.uploadHint') }}</span>
             <span class="empty-sub">{{ t('toolbox.encoderDecoder.pasteBase64Hint') }}</span>
           </div>
        </template>
      </div>

      <div class="io-box">
        <div class="io-header">
          <span>Base64</span>
          <button class="icon-btn" @click="copy(imageBase64)" v-if="imageBase64">
            <Copy :size="16" />
          </button>
        </div>
        <textarea 
          v-model="imageBase64" 
          class="io-textarea output" 
          :placeholder="t('toolbox.encoderDecoder.pasteBase64Hint')"
        ></textarea>
      </div>
    </div>
  </div>
</template>

<style scoped>
.encoder-tool {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}

.mode-tabs-wrapper {
  display: flex;
  justify-content: center;
}

.mode-tabs {
  display: inline-flex;
  gap: 4px;
  padding: 6px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.mode-btn {
  padding: 8px 20px;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.mode-btn:hover {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.05);
}

.mode-btn.active {
  background: var(--bg-panel);
  color: var(--text-primary);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255,255,255,0.05);
}

.unified-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

.io-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.io-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  padding: 0 4px;
  letter-spacing: 0.5px;
}

.icon-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 6px;
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

.io-textarea {
  width: 100%;
  min-height: 100px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  padding: 12px 16px;
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.5;
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Consolas, monospace);
  resize: vertical;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
}

.io-textarea:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15), inset 0 2px 4px rgba(0,0,0,0.02);
}

.io-textarea.output {
  color: var(--accent-primary);
  background: var(--bg-panel);
}

.actions {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  letter-spacing: 0.5px;
}

.action-btn.primary {
  background: var(--accent-primary);
  color: white;
  border: none;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.action-btn.primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
}

.action-btn.secondary {
  background: var(--bg-surface);
  color: var(--text-primary);
  border: 1px solid var(--border-subtle);
}

.action-btn.secondary:hover {
  background: var(--bg-panel);
  border-color: var(--text-secondary);
}

.action-btn.icon-only {
  padding: 8px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 50%;
  color: var(--text-secondary);
}
.action-btn.icon-only:hover {
  color: var(--text-primary);
  transform: rotate(180deg);
}

.error-msg {
  color: #ef4444;
  font-size: 13px;
  padding: 0 4px;
  font-weight: 500;
}

/* Image Mode Drop Zone */
.drop-zone {
  width: 100%;
  height: 160px;
  border: 2px dashed var(--border-subtle);
  border-radius: 16px;
  background: var(--bg-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
  position: relative;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.drop-zone:hover {
  border-color: var(--primary);
  background: rgba(59, 130, 246, 0.02);
}

.drop-zone.has-image {
  border-style: solid;
  border-color: transparent;
  background: var(--bg-panel);
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
}

.drop-zone-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  pointer-events: none;
}

.icon-wrapper {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--bg-panel);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  margin-bottom: 4px;
  transition: transform 0.3s;
}

.drop-zone:hover .icon-wrapper {
  transform: scale(1.05) translateY(-5px);
  color: var(--primary);
}

.empty-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.empty-sub {
  font-size: 13px;
  color: var(--text-secondary);
}

.preview-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background-image: linear-gradient(45deg, #eee 25%, transparent 25%), 
                    linear-gradient(-45deg, #eee 25%, transparent 25%), 
                    linear-gradient(45deg, transparent 75%, #eee 75%), 
                    linear-gradient(-45deg, transparent 75%, #eee 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
  background-color: #fff;
  transition: transform 0.3s;
}

.drop-zone-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
  font-size: 15px;
  font-weight: 500;
}

.drop-zone:hover .drop-zone-overlay {
  opacity: 1;
}

.drop-zone:hover .preview-img {
  transform: scale(1.02);
}

.clear-img-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(0,0,0,0.5);
  border: none;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: all 0.2s;
  z-index: 10;
}

.drop-zone:hover .clear-img-btn {
  opacity: 1;
}

.clear-img-btn:hover {
  background: #ef4444;
  transform: scale(1.1);
}

.mb-2 { margin-bottom: 8px; }
</style>

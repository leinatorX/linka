<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';
import { X } from '@lucide/vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
  imageUrl: string;
  isOpen: boolean;
}>();

const emit = defineEmits<{
  crop: [dataUrl: string];
  cancel: [];
}>();

const { t } = useI18n();
const imageRef = ref<HTMLImageElement | null>(null);
let cropper: Cropper | null = null;

const initCropper = () => {
  if (cropper) {
    cropper.destroy();
  }
  if (imageRef.value) {
    cropper = new Cropper(imageRef.value, {
      aspectRatio: 1, // Square crop for avatar
      viewMode: 1,    // Restrict crop box to not exceed canvas
      dragMode: 'move',
      autoCropArea: 0.8,
      restore: false,
      guides: true,
      center: true,
      highlight: false,
      cropBoxMovable: true,
      cropBoxResizable: true,
      toggleDragModeOnDblclick: false,
    });
  }
};

watch(() => props.isOpen, async (newVal) => {
  if (newVal) {
    await nextTick();
    initCropper();
  } else {
    if (cropper) {
      cropper.destroy();
      cropper = null;
    }
  }
});

onUnmounted(() => {
  if (cropper) {
    cropper.destroy();
  }
});

const handleConfirm = () => {
  if (cropper) {
    const canvas = cropper.getCroppedCanvas({
      maxWidth: 512,
      maxHeight: 512,
      fillColor: '#fff',
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
    });
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    emit('crop', dataUrl);
  }
};
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="cropper-modal-overlay">
      <div class="cropper-modal-container">
        <div class="cropper-modal-header">
          <h3>裁剪头像</h3>
          <button type="button" class="btn-close" @click="$emit('cancel')" title="取消">
            <X :size="18" />
          </button>
        </div>
        <div class="cropper-modal-body">
          <div class="cropper-wrapper">
            <img ref="imageRef" :src="imageUrl" alt="Crop target" />
          </div>
        </div>
        <div class="cropper-modal-footer">
          <button type="button" class="btn-secondary" @click="$emit('cancel')">取消</button>
          <button type="button" class="btn-primary" @click="handleConfirm">确认裁剪</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.cropper-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cropper-modal-container {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  width: 90vw;
  max-width: 500px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.cropper-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-subtle);
}

.cropper-modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.btn-close {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.btn-close:hover {
  background: var(--bg-surface-hover);
  color: var(--text-primary);
}

.cropper-modal-body {
  padding: 20px;
  background: var(--bg-body);
}

.cropper-wrapper {
  height: 300px;
  width: 100%;
  background: rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: var(--radius-sm);
}

.cropper-wrapper img {
  display: block;
  max-width: 100%;
}

.cropper-modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-subtle);
}
</style>

<script setup lang="ts">
import { X } from "@lucide/vue";

export type SettingsTab = "categories" | "manage_bookmarks" | "ai" | "account";

const settingsTab = defineModel<SettingsTab>("settingsTab", { required: true });

defineEmits<{
  openGuide: [];
  closeSettings: [];
}>();
</script>

<template>
  <section class="settings-page" aria-label="Linka 设置">
    <Teleport to="body">
      <div class="settings-grand-layout">
        <button class="btn-guide" title="GitHub" @click="$emit('openGuide')">
          <svg class="github-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.09.68-.22.68-.49 0-.24-.01-1.04-.01-1.88-2.78.62-3.37-1.21-3.37-1.21-.45-1.19-1.11-1.51-1.11-1.51-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.89 1.57 2.34 1.12 2.91.86.09-.66.35-1.12.63-1.37-2.22-.26-4.56-1.14-4.56-5.08 0-1.12.39-2.04 1.03-2.76-.1-.26-.45-1.31.1-2.72 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 6.96c.85 0 1.7.12 2.5.35 1.9-1.33 2.74-1.05 2.74-1.05.55 1.41.2 2.46.1 2.72.64.72 1.03 1.64 1.03 2.76 0 3.95-2.34 4.82-4.57 5.08.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.59.69.49A10.1 10.1 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z"
              fill="currentColor"
            />
          </svg>
          <span>GitHub</span>
        </button>
        <button class="btn-close-settings" title="返回首页" @click="$emit('closeSettings')">
          <X :size="24" />
        </button>

        <nav class="settings-tabs-grand" aria-label="设置选项">
          <button :class="{ active: settingsTab === 'account' }" @click="settingsTab = 'account'">账号安全</button>
          <button :class="{ active: settingsTab === 'categories' }" @click="settingsTab = 'categories'">分类管理</button>
          <button :class="{ active: settingsTab === 'manage_bookmarks' }" @click="settingsTab = 'manage_bookmarks'">书签管理</button>
          <button :class="{ active: settingsTab === 'ai' }" @click="settingsTab = 'ai'">智能体配置</button>
        </nav>

        <div class="settings-section-grand">
          <slot />
        </div>
      </div>
    </Teleport>
  </section>
</template>

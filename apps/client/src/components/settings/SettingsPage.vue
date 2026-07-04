<script setup lang="ts">
import { BookOpen, X } from "@lucide/vue";

export type SettingsTab = "categories" | "manage_bookmarks" | "ai";

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
        <button class="btn-guide" title="使用指南" @click="$emit('openGuide')">
          <BookOpen :size="16" />
          <span>使用指南</span>
        </button>
        <button class="btn-close-settings" title="返回首页" @click="$emit('closeSettings')">
          <X :size="24" />
        </button>

        <nav class="settings-tabs-grand" aria-label="设置选项">
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

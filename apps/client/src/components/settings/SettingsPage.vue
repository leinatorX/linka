<script setup lang="ts">
import { User, FolderOpen, Bookmark, Sparkles, X, ChevronRight, ChevronLeft, Settings } from "@lucide/vue";
import { computed } from "vue";
import { useI18n } from "vue-i18n";

export type SettingsTab = "general" | "categories" | "manage_bookmarks" | "ai" | "account" | "";

const settingsTab = defineModel<SettingsTab>("settingsTab", { required: true });

defineEmits<{
  openGuide: [];
  closeSettings: [];
}>();

const { t } = useI18n();

const tabLabel = computed(() => {
  if (settingsTab.value === "general") return t('settings.tabs.general');
  if (settingsTab.value === "account") return t('settings.tabs.account');
  if (settingsTab.value === "categories") return t('settings.tabs.categories');
  if (settingsTab.value === "manage_bookmarks") return t('settings.tabs.bookmarks');
  if (settingsTab.value === "ai") return t('settings.tabs.ai');
  return "";
});

function clearTabMobile() {
  settingsTab.value = "";
}
</script>

<template>
  <section class="settings-page" aria-label="Linka 设置">
    <Teleport to="body">
      <div class="settings-grand-layout" :class="{ 'has-active-tab': !!settingsTab }">
        
        <!-- 左侧 macOS 风格侧边栏 -->
        <aside class="settings-sidebar">
          <div class="sidebar-header">
            <button class="btn-sidebar-back" :title="t('settings.backToHome')" @click="$emit('closeSettings')">
              <X :size="18" />
            </button>
            <h2>{{ t('settings.title') }}</h2>
          </div>

          <nav class="settings-sidebar-nav" :aria-label="t('settings.title')">
            <button class="nav-item" :class="{ active: settingsTab === 'general' }" @click="settingsTab = 'general'">
              <div class="icon-wrap general-icon">
                <Settings :size="15" />
              </div>
              <span class="nav-label">{{ t('settings.tabs.general') }}</span>
              <ChevronRight class="chevron" :size="14" />
            </button>
            <button class="nav-item" :class="{ active: settingsTab === 'account' }" @click="settingsTab = 'account'">
              <div class="icon-wrap account-icon">
                <User :size="15" />
              </div>
              <span class="nav-label">{{ t('settings.tabs.account') }}</span>
              <ChevronRight class="chevron" :size="14" />
            </button>
            <button class="nav-item" :class="{ active: settingsTab === 'categories' }" @click="settingsTab = 'categories'">
              <div class="icon-wrap category-icon">
                <FolderOpen :size="15" />
              </div>
              <span class="nav-label">{{ t('settings.tabs.categories') }}</span>
              <ChevronRight class="chevron" :size="14" />
            </button>
            <button class="nav-item" :class="{ active: settingsTab === 'manage_bookmarks' }" @click="settingsTab = 'manage_bookmarks'">
              <div class="icon-wrap bookmark-icon">
                <Bookmark :size="15" />
              </div>
              <span class="nav-label">{{ t('settings.tabs.bookmarks') }}</span>
              <ChevronRight class="chevron" :size="14" />
            </button>
            <button class="nav-item" :class="{ active: settingsTab === 'ai' }" @click="settingsTab = 'ai'">
              <div class="icon-wrap ai-icon">
                <Sparkles :size="15" />
              </div>
              <span class="nav-label">{{ t('settings.tabs.ai') }}</span>
              <ChevronRight class="chevron" :size="14" />
            </button>
          </nav>

          <div class="sidebar-footer">
            <button class="btn-guide-mac" title="GitHub" @click="$emit('openGuide')">
              <svg class="github-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.09.68-.22.68-.49 0-.24-.01-1.04-.01-1.88-2.78.62-3.37-1.21-3.37-1.21-.45-1.19-1.11-1.51-1.11-1.51-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.89 1.57 2.34 1.12 2.91.86.09-.66.35-1.12.63-1.37-2.22-.26-4.56-1.14-4.56-5.08 0-1.12.39-2.04 1.03-2.76-.1-.26-.45-1.31.1-2.72 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 6.96c.85 0 1.7.12 2.5.35 1.9-1.33 2.74-1.05 2.74-1.05.55 1.41.2 2.46.1 2.72.64.72 1.03 1.64 1.03 2.76 0 3.95-2.34 4.82-4.57 5.08.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.59.69.49A10.1 10.1 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z"
                  fill="currentColor"
                />
              </svg>
              <span>GitHub</span>
            </button>
          </div>
        </aside>

        <!-- 右侧主配置区域 -->
        <main class="settings-main-content">
          <div class="settings-mobile-header" v-if="settingsTab">
            <button class="btn-mobile-back" @click="clearTabMobile">
              <ChevronLeft :size="20" />
              <span>{{ t('settings.title') }}</span>
            </button>
            <h3>{{ tabLabel }}</h3>
          </div>
          <div class="settings-content-wrapper">
            <slot />
          </div>
        </main>
      </div>
    </Teleport>
  </section>
</template>


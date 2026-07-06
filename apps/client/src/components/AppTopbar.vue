<script setup lang="ts">
import { Archive, Moon, Search, Sun } from "@lucide/vue";
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { useI18n } from "vue-i18n";
import type { AuthUser, Category } from "../types";
import type { ThemeMode } from "../composables/useTheme";

const props = defineProps<{
  showArchived: boolean;
  isSettingsPage: boolean;
  currentUser: AuthUser;
  theme: ThemeMode;
  categories: Category[];
  selectedCategory: string;
}>();

const searchInput = defineModel<string>("searchInput", { required: true });

const emit = defineEmits<{
  search: [];
  toggleArchived: [];
  openSettings: [];
  changeTheme: [theme: ThemeMode];
}>();

const { t } = useI18n();

const themeTitle = computed(() => {
  if (props.theme === "light") return t('topbar.themeLight');
  return t('topbar.themeDark');
});

function cycleTheme() {
  emit("changeTheme", props.theme === "light" ? "dark" : "light");
}

function handleFilterWheel(event: WheelEvent) {
  const rail = event.currentTarget as HTMLElement | null;
  const group = rail?.querySelector<HTMLElement>(".filter-group");
  if (!group || group.scrollWidth <= group.clientWidth) return;

  const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
  const maxScrollLeft = group.scrollWidth - group.clientWidth;
  const nextScrollLeft = Math.min(maxScrollLeft, Math.max(0, group.scrollLeft + delta));
  if (nextScrollLeft === group.scrollLeft) return;

  event.preventDefault();
  group.scrollLeft = nextScrollLeft;
}
</script>

<template>
  <header class="topbar" v-if="!isSettingsPage">
    <!-- 左侧：品牌图标及名称 -->
    <a class="brand" href="/" aria-label="Linka 首页">
      <div class="brand-icon">
        <img class="brand-logo" src="/logo.svg" alt="" />
      </div>
      <div class="brand-text">
        <strong>Linka</strong>
      </div>
    </a>

    <!-- 中间：分类导航（iOS分段控制器） -->
    <nav class="filter-rail" aria-label="收藏筛选" @wheel="handleFilterWheel">
      <div class="filter-group">
        <RouterLink class="filter-btn" :class="{ active: selectedCategory === '首页' }" to="/">
          {{ t('topbar.home') }}
        </RouterLink>
        <RouterLink v-for="category in categories" :key="category.id" class="filter-btn"
          :class="{ active: selectedCategory === category.name }"
          :to="{ name: 'category', params: { slug: category.slug } }">
          {{ category.name }}
        </RouterLink>
      </div>
    </nav>

    <!-- 右侧：搜索框及快捷操作 -->
    <div class="topbar-right-controls">
      <div class="global-search">
        <Search :size="14" />
        <input v-model="searchInput" :placeholder="t('topbar.searchPlaceholder')" @keyup.enter="$emit('search')" />
      </div>

      <div class="top-actions">
        <button class="top-icon theme-toggle-btn" :title="themeTitle" @click="cycleTheme">
          <Sun v-if="theme === 'light'" :size="18" />
          <Moon v-else :size="18" />
        </button>

        <button class="top-icon" :class="{ active: showArchived }" :title="showArchived ? t('topbar.viewCurrent') : t('topbar.viewArchived')"
          @click="$emit('toggleArchived')">
          <Archive :size="18" />
        </button>
        <button class="user-avatar" :title="`${t('topbar.settingsPrefix')}${currentUser.username}`" aria-label="打开设置" @click="$emit('openSettings')">
          <img v-if="currentUser.avatarUrl" :src="currentUser.avatarUrl" alt="" />
          <span v-else>{{ currentUser.username.slice(0, 1).toUpperCase() }}</span>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { Archive, Moon, Search, Sun, LayoutGrid } from "@lucide/vue";
import { computed, ref, onMounted, onUnmounted } from "vue";
import { RouterLink } from "vue-router";
import { useI18n } from "vue-i18n";
import type { AuthUser, Category } from "../types";
import type { ThemeMode } from "../composables/useTheme";
import { getWeatherSettings, getCurrentWeather } from "../api";

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
  toggleToolbox: [];
}>();

const { t, locale } = useI18n();
const weather = ref<{ temp_c: number, condition: { text: string, icon: string } } | null>(null);
const showDateConfig = ref(false);
const dateFormatConfig = ref('full');
const currentTime = ref(new Date());
let timeInterval: number;

onMounted(async () => {
  timeInterval = window.setInterval(() => {
    currentTime.value = new Date();
  }, 1000);

  if (props.isSettingsPage) return;
  try {
    const { settings } = await getWeatherSettings();
    showDateConfig.value = settings.showDate;
    dateFormatConfig.value = settings.dateFormat || 'full';
    if (settings.enabled && settings.apiKey) {
      const data = await getCurrentWeather();
      weather.value = data.current;
    }
  } catch (e) {
    console.error("Failed to fetch weather:", e);
  }
});

onUnmounted(() => {
  window.clearInterval(timeInterval);
});

const formattedDatetime = computed(() => {
  const d = currentTime.value;
  if (dateFormatConfig.value === 'time') {
    return new Intl.DateTimeFormat(locale.value, { hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  }
  if (dateFormatConfig.value === 'short') {
    return new Intl.DateTimeFormat(locale.value, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  }
  if (dateFormatConfig.value === 'long') {
    return new Intl.DateTimeFormat(locale.value, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  }
  // full
  return new Intl.DateTimeFormat(locale.value, { year: 'numeric', month: 'short', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
});

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
        <RouterLink class="filter-btn" :class="{ active: !showArchived && selectedCategory === '首页' }" to="/">
          {{ t('topbar.home') }}
        </RouterLink>
        <RouterLink v-for="category in categories" :key="category.id" class="filter-btn"
          :class="{ active: !showArchived && selectedCategory === category.name }"
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
        <div v-if="showDateConfig || weather" class="weather-widget">
          <template v-if="showDateConfig">
            <span class="datetime">{{ formattedDatetime }}</span>
            <div v-if="weather" class="weather-divider"></div>
          </template>
          <template v-if="weather">
            <img :src="weather.condition.icon" :title="weather.condition.text" alt="weather" />
            <span :title="weather.condition.text">{{ weather.temp_c }}°C</span>
          </template>
        </div>

        <button class="top-icon theme-toggle-btn" :title="themeTitle" @click="cycleTheme">
          <Sun v-if="theme === 'light'" :size="18" />
          <Moon v-else :size="18" />
        </button>

        <button class="top-icon" title="工具箱" @click="$emit('toggleToolbox')">
          <LayoutGrid :size="18" />
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

<style scoped>
.weather-widget {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  padding: 0 8px;
  height: 32px;
  border-radius: 8px;
  background-color: var(--bg-secondary);
  user-select: none;
}
.weather-widget img {
  width: 24px;
  height: 24px;
  object-fit: contain;
}
.weather-divider {
  width: 1px;
  height: 12px;
  background: var(--border-subtle);
  margin: 0 4px;
}
.datetime {
  font-variant-numeric: tabular-nums;
  display: flex;
  gap: 4px;
  align-items: center;
}
</style>

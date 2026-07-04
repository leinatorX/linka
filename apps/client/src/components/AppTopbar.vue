<script setup lang="ts">
import { Archive, ChevronDown, Search, Settings } from "@lucide/vue";

defineProps<{
  showArchived: boolean;
  isSettingsPage: boolean;
}>();

const searchInput = defineModel<string>("searchInput", { required: true });

defineEmits<{
  search: [];
  toggleArchived: [];
  openSettings: [];
}>();
</script>

<template>
  <header class="topbar" v-if="!isSettingsPage">
    <a class="brand" href="/" aria-label="Linka 首页">
      <div class="brand-icon">
        <img class="brand-logo" src="/logo.svg" alt="" />
      </div>
      <div class="brand-text">
        <strong>Linka</strong>
        <span>只管收藏，AI 自动归档。</span>
      </div>
    </a>

    <div class="global-search">
      <Search :size="18" />
      <input v-model="searchInput" placeholder="搜索书签或向 AI 提问..." @keyup.enter="$emit('search')" />
    </div>

    <div class="top-actions">
      <button class="top-icon" :class="{ active: showArchived }" :title="showArchived ? '查看当前书签' : '查看归档'"
        @click="$emit('toggleArchived')">
        <Archive :size="20" />
      </button>
      <button class="top-icon" :class="{ active: isSettingsPage }" title="设置" @click="$emit('openSettings')">
        <Settings :size="20" />
      </button>
      <button class="user-pill" title="当前用户">
        <span>Hongli</span>
        <ChevronDown :size="16" />
      </button>
    </div>
  </header>
</template>

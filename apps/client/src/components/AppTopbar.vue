<script setup lang="ts">
import { Archive, Search } from "@lucide/vue";
import type { AuthUser } from "../types";

defineProps<{
  showArchived: boolean;
  isSettingsPage: boolean;
  currentUser: AuthUser;
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
      <input v-model="searchInput" placeholder="搜索书签..." @keyup.enter="$emit('search')" />
    </div>

    <div class="top-actions">
      <button class="top-icon" :class="{ active: showArchived }" :title="showArchived ? '查看当前书签' : '查看归档'"
        @click="$emit('toggleArchived')">
        <Archive :size="20" />
      </button>
      <button class="user-avatar" :title="`设置：${currentUser.username}`" aria-label="打开设置" @click="$emit('openSettings')">
        <img v-if="currentUser.avatarUrl" :src="currentUser.avatarUrl" alt="" />
        <span v-else>{{ currentUser.username.slice(0, 1).toUpperCase() }}</span>
      </button>
    </div>
  </header>
</template>

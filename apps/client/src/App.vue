<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import AppTopbar from "./components/AppTopbar.vue";
import LoginPage from "./components/auth/LoginPage.vue";
import AssistantPanel from "./components/assistant/AssistantPanel.vue";
import BookmarkLibrary from "./components/bookmarks/BookmarkLibrary.vue";
import ToastContainer from "./components/common/ToastContainer.vue";
import AccountSettings from "./components/settings/AccountSettings.vue";
import AddBookmarkModal from "./components/settings/AddBookmarkModal.vue";
import AiModelModal from "./components/settings/AiModelModal.vue";
import AiProviderSettings from "./components/settings/AiProviderSettings.vue";
import BookmarkSettings from "./components/settings/BookmarkSettings.vue";
import CategorySettings from "./components/settings/CategorySettings.vue";
import DeleteProviderModal from "./components/settings/DeleteProviderModal.vue";
import EditBookmarkModal from "./components/settings/EditBookmarkModal.vue";
import SettingsPage from "./components/settings/SettingsPage.vue";
import { useAiSettings } from "./composables/useAiSettings";
import { useAssistant } from "./composables/useAssistant";
import { useAuth } from "./composables/useAuth";
import { useBookmarks } from "./composables/useBookmarks";
import { useCategories } from "./composables/useCategories";
import { useToast } from "./composables/useToast";
import { useTheme } from "./composables/useTheme";

type SettingsTab = "categories" | "manage_bookmarks" | "ai" | "account";
const HOME_CATEGORY = "首页";

const route = useRoute();
const router = useRouter();
const settingsTab = ref<SettingsTab>("account");
const isSettingsPage = computed(() => route.path === "/settings");

const { toasts, showToast } = useToast();
const { theme, applyTheme } = useTheme();

const {
  authLoading,
  authUser,
  loginUsername,
  loginPassword,
  rememberUsername,
  autoLogin,
  loginMessage,
  isLoginSaving,
  accountUsername,
  accountAvatarUrl,
  accountCurrentPassword,
  accountNewPassword,
  accountConfirmPassword,
  accountMessage,
  avatarMessage,
  isAccountSaving,
  isAvatarSaving,
  loadCurrentUser,
  signIn,
  signOut,
  saveAvatar,
  saveAccount
} = useAuth();

let addAssistantNotice: (message: string) => void = () => {};
let reloadCategoriesFromAssistant: () => Promise<void> = async () => {};

const {
  bookmarks,
  searchInput,
  selectedCategory,
  showArchived,
  showAddBookmarkModal,
  settingsBookmarkUrl,
  settingsBookmarkTitle,
  settingsBookmarkCategory,
  settingsBookmarkFaviconUrl,
  settingsBookmarkShowOnHome,
  settingsMessage,
  isSettingsSaving,
  editingBookmarkId,
  editBookmarkData,
  failedIconIds,
  visibleBookmarks,
  markIconFailed,
  loadBookmarks,
  addBookmarkFromSettings,
  togglePinned,
  toggleArchived,
  removeBookmark,
  startEditingBookmark,
  saveEditedBookmark,
  search,
  toggleArchivedView
} = useBookmarks({
  loadAllBookmarks: () => isSettingsPage.value,
  onAssistantNotice(message) {
    addAssistantNotice(message);
  }
});

const {
  assistantInput,
  assistantOpen,
  assistantModel,
  assistantEffort,
  assistantEffortOptions,
  modelSelectOpen,
  effortSelectOpen,
  assistantHistoryOpen,
  assistantHistoryManage,
  activeConversationId,
  selectedConversationIds,
  historySearchInput,
  assistantMessages,
  assistantAttachments,
  isAssistantLoading,
  activeConversation,
  filteredAssistantConversations,
  addAssistantNotice: appendAssistantNotice,
  toggleModelSelect,
  toggleEffortSelect,
  closeDropdowns,
  loadAssistantConversations,
  openAssistantConversation,
  startNewAssistantConversation,
  toggleAssistantHistory,
  toggleConversationSelected,
  removeSelectedConversations,
  attachAssistantFiles,
  removeAssistantAttachment,
  askAssistant,
  toggleReasoningCollapsed
} = useAssistant({
  loadBookmarks,
  loadCategories: () => reloadCategoriesFromAssistant(),
  getActiveCategory: () => selectedCategory.value
});

addAssistantNotice = appendAssistantNotice;

const {
  aiSettingsMessage,
  isAiSettingsSaving,
  showAiModelModal,
  editingAiModel,
  aiModelFormData,
  aiSettingsForm,
  editingProviderId,
  showApiKey,
  revealedApiKeys,
  revealingApiKeyProviderIds,
  testStatus,
  testMessage,
  showDeleteConfirmModal,
  testingModelId,
  modelTestResults,
  lastSavedTime,
  activeAiProvider,
  availableModels,
  isApiKeyRevealed,
  toggleRevealApiKey,
  copyApiKeyValue,
  testProviderConnection,
  selectAiProvider,
  onModelDragStart,
  onModelDragEnter,
  onModelDragEnd,
  testModel,
  loadAiSettings,
  addAiProvider,
  removeAiProvider,
  cancelDeleteProvider,
  confirmDeleteProvider,
  openAddAiModelModal,
  openEditAiModelModal,
  saveAiModelModal,
  removeAiModel,
  saveAiSettings,
  reorderProviders
} = useAiSettings({
  assistantModel,
  showToast
});

const {
  categories,
  editingCategoryNames,
  newCategoryName,
  loadCategories,
  addCategory,
  saveCategory,
  removeCategory,
  reorderCategories
} = useCategories({
  selectedCategory,
  loadBookmarks
});

reloadCategoriesFromAssistant = loadCategories;

async function initializeAppData() {
  await loadCategories();
  await syncBookmarksFromRoute();
  await loadAiSettings();
  await loadAssistantConversations({ openFirst: true });
}

async function syncBookmarksFromRoute() {
  if (!authUser.value) {
    return;
  }

  if (isSettingsPage.value) {
    await loadBookmarks({ all: true });
    return;
  }

  if (route.name === "category") {
    const slug = typeof route.params.slug === "string" ? route.params.slug : "";
    const category = categories.value.find((item) => item.slug === slug);
    if (!category) {
      if (categories.value.length > 0) {
        selectedCategory.value = HOME_CATEGORY;
        await router.replace("/");
      }
      return;
    }
    selectedCategory.value = category.name;
  } else {
    selectedCategory.value = HOME_CATEGORY;
  }

  await loadBookmarks();
}

function openSettings() {
  router.push("/settings");
}

function closeSettings() {
  router.push("/");
}

function openGuide() {
  window.open("https://github.com/leinatorX/linka", "_blank");
}

function clearModelTestResult(modelId: string) {
  delete modelTestResults.value[modelId];
}

async function handleLogin() {
  const user = await signIn();
  if (user) {
    await initializeAppData();
  }
}

async function handleLogout() {
  await signOut();
  await router.push("/");
}

onMounted(async () => {
  await loadCurrentUser();
  if (authUser.value) {
    await initializeAppData();
  }
  document.addEventListener("click", closeDropdowns);
});

watch(
  [
    () => route.name,
    () => route.params.slug,
    () => categories.value.map((category) => `${category.slug}:${category.name}`).join("|")
  ],
  () => {
    syncBookmarksFromRoute();
  }
);

onUnmounted(() => {
  document.removeEventListener("click", closeDropdowns);
});
</script>

<template>
  <div v-if="authLoading" class="auth-loading">
    <img src="/logo.svg" alt="" />
    <span>正在检查登录状态...</span>
  </div>

  <LoginPage
    v-else-if="!authUser"
    v-model:username="loginUsername"
    v-model:password="loginPassword"
    v-model:remember-username="rememberUsername"
    v-model:auto-login="autoLogin"
    :message="loginMessage"
    :is-saving="isLoginSaving"
    @submit="handleLogin"
  />

  <div v-else class="app-container">
    <AppTopbar
      v-model:search-input="searchInput"
      :show-archived="showArchived"
      :is-settings-page="isSettingsPage"
      :current-user="authUser"
      :theme="theme"
      :categories="categories"
      :selected-category="selectedCategory"
      @change-theme="applyTheme"
      @search="search"
      @toggle-archived="toggleArchivedView"
      @open-settings="openSettings"
    />

    <main class="app-shell" :class="{ 'settings-route': isSettingsPage }">
      <BookmarkLibrary
        v-if="!isSettingsPage"
        :bookmarks="visibleBookmarks"
        :categories="categories"
        :selected-category="selectedCategory"
        :show-archived="showArchived"
        :failed-icon-ids="failedIconIds"
        @toggle-pinned="togglePinned"
        @toggle-archived="toggleArchived"
        @remove-bookmark="removeBookmark"
        @mark-icon-failed="markIconFailed"
        @edit-bookmark="startEditingBookmark"
      />

      <SettingsPage
        v-else
        v-model:settings-tab="settingsTab"
        @open-guide="openGuide"
        @close-settings="closeSettings"
      >
        <CategorySettings
          v-if="settingsTab === 'categories'"
          v-model:new-category-name="newCategoryName"
          :categories="categories"
          :editing-category-names="editingCategoryNames"
          @add-category="addCategory"
          @save-category="saveCategory"
          @remove-category="removeCategory"
          @reorder-categories="reorderCategories"
        />

        <AiProviderSettings
          v-else-if="settingsTab === 'ai'"
          v-model:show-api-key="showApiKey"
          :ai-settings-form="aiSettingsForm"
          :active-ai-provider="activeAiProvider"
          :editing-provider-id="editingProviderId"
          :is-ai-settings-saving="isAiSettingsSaving"
          :revealed-api-keys="revealedApiKeys"
          :revealing-api-key-provider-ids="revealingApiKeyProviderIds"
          :testing-model-id="testingModelId"
          :model-test-results="modelTestResults"
          :last-saved-time="lastSavedTime"
          :is-api-key-revealed="isApiKeyRevealed"
          @select-ai-provider="selectAiProvider"
          @add-ai-provider="addAiProvider"
          @remove-ai-provider="removeAiProvider"
          @toggle-reveal-api-key="toggleRevealApiKey"
          @copy-api-key-value="copyApiKeyValue"
          @open-add-ai-model-modal="openAddAiModelModal"
          @open-edit-ai-model-modal="openEditAiModelModal"
          @remove-ai-model="removeAiModel"
          @model-drag-start="onModelDragStart"
          @model-drag-enter="onModelDragEnter"
          @model-drag-end="onModelDragEnd"
          @test-model="testModel"
          @clear-model-test-result="clearModelTestResult"
          @load-ai-settings="loadAiSettings"
          @save-ai-settings="saveAiSettings"
          @reorder-providers="reorderProviders"
        />

        <AccountSettings
          v-else-if="settingsTab === 'account'"
          v-model:username="accountUsername"
          v-model:avatar-url="accountAvatarUrl"
          v-model:current-password="accountCurrentPassword"
          v-model:new-password="accountNewPassword"
          v-model:confirm-password="accountConfirmPassword"
          :user="authUser"
          :message="accountMessage"
          :avatar-message="avatarMessage"
          :is-saving="isAccountSaving"
          :is-avatar-saving="isAvatarSaving"
          @save-avatar="saveAvatar"
          @save="saveAccount"
          @logout="handleLogout"
        />

        <BookmarkSettings
          v-else
          :bookmarks="bookmarks"
          @show-add-bookmark="showAddBookmarkModal = true"
          @start-editing-bookmark="startEditingBookmark"
        />
      </SettingsPage>
    </main>

    <AssistantPanel
      v-model:assistant-open="assistantOpen"
      v-model:assistant-history-open="assistantHistoryOpen"
      v-model:assistant-history-manage="assistantHistoryManage"
      v-model:history-search-input="historySearchInput"
      v-model:assistant-input="assistantInput"
      v-model:assistant-model="assistantModel"
      v-model:assistant-effort="assistantEffort"
      v-model:model-select-open="modelSelectOpen"
      v-model:effort-select-open="effortSelectOpen"
      :is-settings-page="isSettingsPage"
      :active-conversation="activeConversation"
      :filtered-conversations="filteredAssistantConversations"
      :active-conversation-id="activeConversationId"
      :selected-conversation-ids="selectedConversationIds"
      :assistant-messages="assistantMessages"
      :assistant-attachments="assistantAttachments"
      :is-assistant-loading="isAssistantLoading"
      :assistant-effort-options="assistantEffortOptions"
      :available-models="availableModels"
      @ask-assistant="askAssistant"
      @toggle-assistant-history="toggleAssistantHistory"
      @start-new-assistant-conversation="startNewAssistantConversation"
      @toggle-conversation-selected="toggleConversationSelected"
      @open-assistant-conversation="openAssistantConversation"
      @remove-selected-conversations="removeSelectedConversations"
      @attach-assistant-files="attachAssistantFiles"
      @remove-assistant-attachment="removeAssistantAttachment"
      @toggle-model-select="toggleModelSelect"
      @toggle-effort-select="toggleEffortSelect"
      @toggle-reasoning-collapsed="toggleReasoningCollapsed"
    />
  </div>

  <AddBookmarkModal
    v-model:visible="showAddBookmarkModal"
    v-model:url="settingsBookmarkUrl"
    v-model:title="settingsBookmarkTitle"
    v-model:category="settingsBookmarkCategory"
    v-model:favicon-url="settingsBookmarkFaviconUrl"
    v-model:show-on-home="settingsBookmarkShowOnHome"
    :categories="categories"
    :is-saving="isSettingsSaving"
    :message="settingsMessage"
    @submit="addBookmarkFromSettings"
  />

  <EditBookmarkModal
    v-model:editing-bookmark-id="editingBookmarkId"
    :categories="categories"
    :edit-data="editBookmarkData"
    @submit="saveEditedBookmark"
  />

  <AiModelModal
    v-model:visible="showAiModelModal"
    :editing-ai-model="editingAiModel"
    :active-provider="activeAiProvider"
    :form-data="aiModelFormData"
    @save="saveAiModelModal"
  />

  <DeleteProviderModal
    v-model:visible="showDeleteConfirmModal"
    @confirm="confirmDeleteProvider"
    @cancel="cancelDeleteProvider"
  />

  <ToastContainer :toasts="toasts" />
</template>

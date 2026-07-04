<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import AppTopbar from "./components/AppTopbar.vue";
import AssistantPanel from "./components/assistant/AssistantPanel.vue";
import BookmarkLibrary from "./components/bookmarks/BookmarkLibrary.vue";
import ToastContainer from "./components/common/ToastContainer.vue";
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
import { useBookmarks } from "./composables/useBookmarks";
import { useCategories } from "./composables/useCategories";
import { useToast } from "./composables/useToast";

type SettingsTab = "categories" | "manage_bookmarks" | "ai";

const route = useRoute();
const router = useRouter();
const settingsTab = ref<SettingsTab>("manage_bookmarks");
const isSettingsPage = computed(() => route.path === "/settings");

const { toasts, showToast } = useToast();

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
  setCategory,
  search,
  toggleArchivedView
} = useBookmarks({
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
  askAssistant,
  toggleReasoningCollapsed
} = useAssistant({
  loadBookmarks,
  loadCategories: () => reloadCategoriesFromAssistant()
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

onMounted(() => {
  loadCategories();
  loadBookmarks();
  loadAiSettings();
  loadAssistantConversations({ openFirst: true });
  document.addEventListener("click", closeDropdowns);
});

onUnmounted(() => {
  document.removeEventListener("click", closeDropdowns);
});
</script>

<template>
  <main class="app-shell" :class="{ 'settings-route': isSettingsPage }">
    <AppTopbar
      v-model:search-input="searchInput"
      :show-archived="showArchived"
      :is-settings-page="isSettingsPage"
      @search="search"
      @toggle-archived="toggleArchivedView"
      @open-settings="openSettings"
    />

    <BookmarkLibrary
      v-if="!isSettingsPage"
      :bookmarks="visibleBookmarks"
      :categories="categories"
      :selected-category="selectedCategory"
      :show-archived="showArchived"
      :failed-icon-ids="failedIconIds"
      @set-category="setCategory"
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

      <BookmarkSettings
        v-else
        :bookmarks="bookmarks"
        @show-add-bookmark="showAddBookmarkModal = true"
        @start-editing-bookmark="startEditingBookmark"
      />
    </SettingsPage>

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
      :is-assistant-loading="isAssistantLoading"
      :assistant-effort-options="assistantEffortOptions"
      :available-models="availableModels"
      @ask-assistant="askAssistant"
      @toggle-assistant-history="toggleAssistantHistory"
      @start-new-assistant-conversation="startNewAssistantConversation"
      @toggle-conversation-selected="toggleConversationSelected"
      @open-assistant-conversation="openAssistantConversation"
      @remove-selected-conversations="removeSelectedConversations"
      @toggle-model-select="toggleModelSelect"
      @toggle-effort-select="toggleEffortSelect"
      @toggle-reasoning-collapsed="toggleReasoningCollapsed"
    />
  </main>

  <AddBookmarkModal
    v-model:visible="showAddBookmarkModal"
    v-model:url="settingsBookmarkUrl"
    v-model:title="settingsBookmarkTitle"
    v-model:category="settingsBookmarkCategory"
    v-model:favicon-url="settingsBookmarkFaviconUrl"
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

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  Archive, ChevronDown, ExternalLink, Link2, Loader2,
  Pin, Plus, Search, Send, Settings, Trash2, X, Bot, Edit2, List, Mic, History, ArrowLeft, GripVertical
} from "@lucide/vue";
import { createAssistantConversation, createBookmark, createCategory, deleteAssistantConversations, deleteBookmark, deleteCategory, getAiSettings as fetchAiSettings, getAssistantConversation, listAssistantConversations, listBookmarks, listCategories, saveAiSettings as updateAiSettings, streamAssistantMessage, updateBookmark, updateCategory } from "./api";
import type { AiApiFormat, AiProviderConfig, AssistantConversation, Bookmark, Category } from "./types";

const bookmarks = ref<Bookmark[]>([]);
const urlInput = ref("");
const searchInput = ref("");
const selectedCategory = ref("全部");
const showArchived = ref(false);
const assistantInput = ref("");
const assistantOpen = ref(false);
const assistantModel = ref("");
const assistantEffort = ref("默认");
const assistantEffortOptions = ["关闭", "默认", "低", "中", "高", "最大"];
const modelSelectOpen = ref(false);
const effortSelectOpen = ref(false);
const assistantConversations = ref<AssistantConversation[]>([]);
const activeConversationId = ref<string | null>(null);
const assistantHistoryOpen = ref(false);
const assistantHistoryManage = ref(false);
const selectedConversationIds = ref<Set<string>>(new Set());
const historySearchInput = ref("");

function toggleModelSelect(e: Event) {
  e.stopPropagation();
  modelSelectOpen.value = !modelSelectOpen.value;
  effortSelectOpen.value = false;
}

function toggleEffortSelect(e: Event) {
  e.stopPropagation();
  effortSelectOpen.value = !effortSelectOpen.value;
  modelSelectOpen.value = false;
}

function closeDropdowns() {
  modelSelectOpen.value = false;
  effortSelectOpen.value = false;
}
const settingsTab = ref<"categories" | "manage_bookmarks" | "ai">("manage_bookmarks");
const showAddBookmarkModal = ref(false);
const newCategoryName = ref("");
const settingsBookmarkUrl = ref("");
const settingsBookmarkTitle = ref("");
const settingsBookmarkCategory = ref("");
const settingsMessage = ref("");
const isSettingsSaving = ref(false);
const aiSettingsMessage = ref("");
const isAiSettingsSaving = ref(false);
const newAiProviderName = ref("");
const showAiModelModal = ref(false);
const editingAiModel = ref<any>(null);
const aiModelFormData = ref({ name: "", maxTokens: 1000 });
const aiSettingsForm = ref({
  activeProviderId: "openai",
  providers: [] as AiProviderConfig[]
});
const newAiModelName = ref("");
const newAiModelMaxTokens = ref(1000);

const draggedModelIndex = ref<number | null>(null);

function onModelDragStart(index: number) {
  draggedModelIndex.value = index;
}

function onModelDragEnter(index: number) {
  if (draggedModelIndex.value === null || draggedModelIndex.value === index) return;
  const provider = activeAiProvider.value;
  if (!provider) return;
  const draggedItem = provider.models.splice(draggedModelIndex.value, 1)[0];
  provider.models.splice(index, 0, draggedItem);
  draggedModelIndex.value = index;
}

function onModelDragEnd() {
  draggedModelIndex.value = null;
}
const editingCategoryNames = ref<Record<string, string>>({});
const editingBookmarkId = ref<string | null>(null);
const editBookmarkData = ref({
  title: "",
  url: "",
  faviconUrl: "",
  category: ""
});

function startEditingBookmark(bookmark: Bookmark) {
  editingBookmarkId.value = bookmark.id;
  editBookmarkData.value = {
    title: bookmark.title,
    url: bookmark.url,
    faviconUrl: bookmark.faviconUrl || "",
    category: bookmark.category || ""
  };
}

async function saveEditedBookmark() {
  if (!editingBookmarkId.value) return;
  await updateBookmark(editingBookmarkId.value, {
    title: editBookmarkData.value.title.trim() || undefined,
    url: editBookmarkData.value.url.trim() || undefined,
    faviconUrl: editBookmarkData.value.faviconUrl.trim() || undefined,
    category: editBookmarkData.value.category || undefined
  });
  editingBookmarkId.value = null;
  await loadBookmarks();
}

const failedIconIds = ref<Set<string>>(new Set());
const assistantMessages = ref<Array<{ role: "user" | "assistant"; text: string; reasoning?: string; reasoningCollapsed?: boolean; results?: Bookmark[]; streaming?: boolean }>>([
  {
    role: "assistant",
    text: "把链接发给我，我会帮你收藏、摘要和归档。也可以直接问我之前收藏过什么。"
  }
]);
const isLoading = ref(false);
const isAssistantLoading = ref(false);
const errorMessage = ref("");
const route = useRoute();
const router = useRouter();

const categories = ref<Category[]>([]);
const visibleBookmarks = computed(() => bookmarks.value);
const isSettingsPage = computed(() => route.path === "/settings");
const activeAiProvider = computed(() => aiSettingsForm.value.providers.find((provider) => provider.id === aiSettingsForm.value.activeProviderId) ?? aiSettingsForm.value.providers[0]);
const activeConversation = computed(() => assistantConversations.value.find((conversation) => conversation.id === activeConversationId.value));
const filteredAssistantConversations = computed(() => {
  const keyword = historySearchInput.value.trim().toLowerCase();
  if (!keyword) {
    return assistantConversations.value;
  }

  return assistantConversations.value.filter((conversation) => conversation.title.toLowerCase().includes(keyword));
});

function getFallbackIconText(bookmark: Bookmark) {
  return (bookmark.domain || bookmark.title || "?").slice(0, 1).toUpperCase();
}

function markIconFailed(bookmarkId: string) {
  failedIconIds.value = new Set([...failedIconIds.value, bookmarkId]);
}

async function loadCategories() {
  const result = await listCategories();
  categories.value = result.categories;
  editingCategoryNames.value = Object.fromEntries(result.categories.map((category) => [category.id, category.name]));
}

async function loadBookmarks() {
  const params = new URLSearchParams();
  if (searchInput.value.trim()) {
    params.set("q", searchInput.value.trim());
  }
  if (selectedCategory.value !== "全部") {
    params.set("category", selectedCategory.value);
  }
  if (showArchived.value) {
    params.set("archived", "true");
  }

  const result = await listBookmarks(params);
  bookmarks.value = result.bookmarks;
}

const activeProvider = computed(() => {
  return aiSettingsForm.value.providers.find(p => p.id === aiSettingsForm.value.activeProviderId);
});

const availableModels = computed(() => {
  return aiSettingsForm.value.providers
    .filter(p => p.enabled)
    .flatMap(p => p.models)
    .filter(m => m.enabled);
});

async function loadAiSettings() {
  const result = await fetchAiSettings();
  aiSettingsForm.value = result.settings;
  if (availableModels.value.length > 0 && !assistantModel.value) {
    assistantModel.value = availableModels.value[0].name;
  }
}

async function loadAssistantConversations(options: { openFirst?: boolean } = {}) {
  const result = await listAssistantConversations();
  assistantConversations.value = result.conversations;

  if (options.openFirst && !activeConversationId.value && result.conversations.length) {
    await openAssistantConversation(result.conversations[0].id);
  }
}

async function openAssistantConversation(conversationId: string) {
  const result = await getAssistantConversation(conversationId);
  activeConversationId.value = result.conversation.id;
  assistantHistoryOpen.value = false;
  assistantHistoryManage.value = false;
  assistantMessages.value = result.messages.length
    ? [...result.messages].reverse().map((message) => ({
      role: message.role,
      text: message.content
    }))
    : [{
      role: "assistant",
      text: "这是一个新对话。你可以继续提问，或直接发链接让我收藏。"
    }];
}

async function startNewAssistantConversation() {
  const result = await createAssistantConversation();
  activeConversationId.value = result.conversation.id;
  assistantConversations.value = [result.conversation, ...assistantConversations.value];
  assistantHistoryOpen.value = false;
  assistantHistoryManage.value = false;
  assistantMessages.value = [{
    role: "assistant",
    text: "新对话已创建。"
  }];
  assistantOpen.value = true;
}

function toggleAssistantHistory() {
  assistantHistoryOpen.value = !assistantHistoryOpen.value;
  assistantHistoryManage.value = false;
  selectedConversationIds.value = new Set();
  historySearchInput.value = "";
}

function toggleConversationSelected(conversationId: string) {
  const next = new Set(selectedConversationIds.value);
  if (next.has(conversationId)) {
    next.delete(conversationId);
  } else {
    next.add(conversationId);
  }
  selectedConversationIds.value = next;
}

async function removeSelectedConversations() {
  const ids = [...selectedConversationIds.value];
  if (!ids.length) {
    return;
  }

  await deleteAssistantConversations(ids);
  selectedConversationIds.value = new Set();
  await loadAssistantConversations();

  if (activeConversationId.value && ids.includes(activeConversationId.value)) {
    activeConversationId.value = null;
    assistantMessages.value = [{
      role: "assistant",
      text: "历史记录已删除，可以开始新的对话。"
    }];
  }
}

function createLocalId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createAiProvider(name: string, apiFormat: AiApiFormat = "anthropic"): AiProviderConfig {
  const modelName = apiFormat === "anthropic" ? "MiniMax-M3" : "gpt-4.1-mini";
  return {
    id: createLocalId("provider"),
    name,
    apiFormat,
    baseUrl: apiFormat === "anthropic" ? "https://api.anthropic.com" : "https://api.openai.com/v1",
    apiKey: "",
    enabled: true,
    temperature: 0.2,
    activeModelId: createLocalId("model"),
    models: [],
    apiKeySet: false,
    apiKeyPreview: ""
  };
}

function selectAiProvider(providerId: string) {
  aiSettingsForm.value.activeProviderId = providerId;
  aiSettingsMessage.value = "";
}

function addAiProvider() {
  const provider = createAiProvider(newAiProviderName.value.trim() || "自定义供应商");
  provider.models = [
    {
      id: provider.activeModelId,
      name: "MiniMax-M3",
      maxTokens: 1000,
      enabled: true
    }
  ];
  aiSettingsForm.value.providers.push(provider);
  aiSettingsForm.value.activeProviderId = provider.id;
  newAiProviderName.value = "";
}

function removeAiProvider(providerId: string) {
  if (aiSettingsForm.value.providers.length <= 1) {
    aiSettingsMessage.value = "至少保留一个供应商。";
    return;
  }

  aiSettingsForm.value.providers = aiSettingsForm.value.providers.filter((provider) => provider.id !== providerId);

  if (aiSettingsForm.value.activeProviderId === providerId) {
    aiSettingsForm.value.activeProviderId = aiSettingsForm.value.providers[0].id;
  }
}

function openAddAiModelModal() {
  editingAiModel.value = null;
  aiModelFormData.value = { name: "", maxTokens: 1000 };
  showAiModelModal.value = true;
}

function openEditAiModelModal(model: any) {
  editingAiModel.value = model;
  aiModelFormData.value = { name: model.name, maxTokens: model.maxTokens };
  showAiModelModal.value = true;
}

function saveAiModelModal(provider: AiProviderConfig) {
  const name = aiModelFormData.value.name.trim();
  if (!name) {
    aiSettingsMessage.value = "请输入模型名称。";
    return;
  }

  if (editingAiModel.value) {
    editingAiModel.value.name = name;
    editingAiModel.value.maxTokens = Number(aiModelFormData.value.maxTokens) || 1000;
  } else {
    const model = {
      id: createLocalId("model"),
      name,
      maxTokens: Number(aiModelFormData.value.maxTokens) || 1000,
      enabled: true
    };
    provider.models.push(model);
    provider.activeModelId = model.id;
  }
  showAiModelModal.value = false;
  aiSettingsMessage.value = "";
}

function removeAiModel(provider: AiProviderConfig, modelId: string) {
  if (provider.models.length <= 1) {
    aiSettingsMessage.value = "每个供应商至少保留一个模型。";
    return;
  }

  provider.models = provider.models.filter((model) => model.id !== modelId);

  if (provider.activeModelId === modelId) {
    provider.activeModelId = provider.models[0].id;
  }
}

async function saveAiSettings() {
  isAiSettingsSaving.value = true;
  aiSettingsMessage.value = "";

  aiSettingsForm.value.providers.forEach(p => {
    p.models.forEach(m => m.enabled = true);
    if (p.models.length > 0) {
      p.activeModelId = p.models[0].id;
    }
  });

  try {
    const result = await updateAiSettings(aiSettingsForm.value);

    aiSettingsForm.value = result.settings;
    aiSettingsMessage.value = "AI 配置已保存。";
  } catch (error) {
    aiSettingsMessage.value = error instanceof Error ? error.message : "AI 配置保存失败";
  } finally {
    isAiSettingsSaving.value = false;
  }
}

async function addBookmark() {
  const url = urlInput.value.trim();
  if (!url) {
    return;
  }

  isLoading.value = true;
  errorMessage.value = "";

  try {
    const result = await createBookmark({ url, source: "web" });
    urlInput.value = "";
    await loadBookmarks();
    assistantMessages.value.unshift({
      role: "assistant",
      text: result.status === "exists" ? "这个链接已经收藏过了。" : `已收藏「${result.bookmark.title}」，归类到「${result.bookmark.category}」。`
    });
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "添加失败";
  } finally {
    isLoading.value = false;
  }
}

async function addBookmarkFromSettings() {
  const url = settingsBookmarkUrl.value.trim();
  if (!url) {
    settingsMessage.value = "请输入要收藏的网页链接。";
    return;
  }

  isSettingsSaving.value = true;
  settingsMessage.value = "";

  try {
    const result = await createBookmark({
      url,
      title: settingsBookmarkTitle.value.trim() || undefined,
      category: settingsBookmarkCategory.value || undefined,
      source: "settings"
    });
    settingsBookmarkUrl.value = "";
    settingsBookmarkTitle.value = "";
    settingsBookmarkCategory.value = "";
    settingsMessage.value = result.status === "exists" ? "这个链接已经收藏过了。" : `已添加，并归类到「${result.bookmark.category}」。`;
    await loadBookmarks();
    if (result.status !== "exists") {
      showAddBookmarkModal.value = false;
    }
  } catch (error) {
    settingsMessage.value = error instanceof Error ? error.message : "添加失败";
  } finally {
    isSettingsSaving.value = false;
  }
}

async function togglePinned(bookmark: Bookmark) {
  await updateBookmark(bookmark.id, { pinned: !bookmark.pinned });
  await loadBookmarks();
}

async function toggleArchived(bookmark: Bookmark) {
  await updateBookmark(bookmark.id, { archived: !showArchived.value });
  await loadBookmarks();
}

async function removeBookmark(bookmark: Bookmark) {
  await deleteBookmark(bookmark.id);
  await loadBookmarks();
}

async function askAssistant() {
  const message = assistantInput.value.trim();
  if (!message) {
    return;
  }

  assistantMessages.value.unshift({ role: "user", text: message });
  assistantMessages.value.unshift({ role: "assistant", text: "", reasoningCollapsed: false, streaming: true });
  assistantInput.value = "";
  assistantOpen.value = true;
  isAssistantLoading.value = true;

  try {
    const assistantMessage = assistantMessages.value[0];
    await streamAssistantMessage({
      conversationId: activeConversationId.value ?? undefined,
      message,
      model: assistantModel.value || undefined,
      effort: assistantEffort.value
    }, {
      onMeta(data) {
        activeConversationId.value = data.conversation.id;
        if (!assistantConversations.value.some((conversation) => conversation.id === data.conversation.id)) {
          assistantConversations.value.unshift(data.conversation);
        }
      },
      onReasoning(data) {
        assistantMessage.reasoningCollapsed = false;
        assistantMessage.reasoning = `${assistantMessage.reasoning ?? ""}${data.text}`;
      },
      onDelta(data) {
        assistantMessage.text += data.text;
      },
      onDone(response) {
        assistantMessage.streaming = false;
        assistantMessage.reasoningCollapsed = Boolean(assistantMessage.reasoning);
        assistantMessage.text = response.message || assistantMessage.text;
        assistantMessage.results = response.results ?? (response.bookmark ? [response.bookmark] : undefined);
        if (response.conversation) {
          assistantConversations.value = [
            response.conversation,
            ...assistantConversations.value.filter((conversation) => conversation.id !== response.conversation?.id)
          ];
        }
        if (response.type === "bookmark_saved") {
          loadBookmarks();
        }
      },
      onError(message) {
        assistantMessage.streaming = false;
        assistantMessage.reasoningCollapsed = Boolean(assistantMessage.reasoning);
        assistantMessage.text = message;
      }
    });
    await loadAssistantConversations();
  } catch (error) {
    assistantMessages.value[0] = {
      role: "assistant",
      text: error instanceof Error ? error.message : "助手暂时不可用"
    };
  } finally {
    assistantMessages.value[0].streaming = false;
    assistantMessages.value[0].reasoningCollapsed = Boolean(assistantMessages.value[0].reasoning);
    isAssistantLoading.value = false;
  }
}

function setCategory(category: string) {
  selectedCategory.value = category;
  loadBookmarks();
}

function search() {
  loadBookmarks();
}

function toggleArchivedView() {
  showArchived.value = !showArchived.value;
  loadBookmarks();
}

function openSettings() {
  router.push("/settings");
}

function closeSettings() {
  router.push("/");
}

async function addCategory() {
  const name = newCategoryName.value.trim();
  if (!name) {
    return;
  }

  await createCategory(name);
  newCategoryName.value = "";
  await loadCategories();
}

async function saveCategory(category: Category) {
  const name = editingCategoryNames.value[category.id]?.trim();
  if (!name || name === category.name) {
    return;
  }

  await updateCategory(category.id, name);
  if (selectedCategory.value === category.name) {
    selectedCategory.value = name;
  }
  await loadCategories();
  await loadBookmarks();
}

async function removeCategory(category: Category) {
  await deleteCategory(category.id);
  if (selectedCategory.value === category.name) {
    selectedCategory.value = "全部";
  }
  await loadCategories();
  await loadBookmarks();
}

onMounted(() => {
  loadCategories();
  loadBookmarks();
  loadAiSettings();
  loadAssistantConversations({ openFirst: true });
  document.addEventListener('click', closeDropdowns);
});

onUnmounted(() => {
  document.removeEventListener('click', closeDropdowns);
});
</script>

<template>
  <main class="app-shell" :class="{ 'settings-route': isSettingsPage }">
    <header class="topbar" v-if="!isSettingsPage">
      <a class="brand" href="/" aria-label="Linka 首页">
        <div class="brand-icon">
          <Link2 :size="24" :stroke-width="2.5" />
        </div>
        <div class="brand-text">
          <strong>Linka</strong>
          <span>AI Bookmarks</span>
        </div>
      </a>

      <div class="global-search">
        <Search :size="18" />
        <input v-model="searchInput" placeholder="搜索书签或向 AI 提问..." @keyup.enter="search" />
      </div>

      <div class="top-actions">
        <button class="top-icon" :class="{ active: showArchived }" :title="showArchived ? '查看当前书签' : '查看归档'"
          @click="toggleArchivedView">
          <Archive :size="20" />
        </button>
        <button class="top-icon" :class="{ active: isSettingsPage }" title="设置" @click="openSettings">
          <Settings :size="20" />
        </button>
        <button class="user-pill" title="当前用户">
          <span>Hongli</span>
          <ChevronDown :size="16" />
        </button>
      </div>
    </header>



    <template v-if="!isSettingsPage">
      <nav class="filter-rail" aria-label="收藏筛选">
        <div class="filter-group">
          <span class="filter-label">分类</span>
          <button class="filter-btn" :class="{ active: selectedCategory === '全部' }" @click="setCategory('全部')">
            全部
          </button>
          <button v-for="category in categories" :key="category.id" class="filter-btn"
            :class="{ active: selectedCategory === category.name }" @click="setCategory(category.name)">
            {{ category.name }}
          </button>
        </div>


      </nav>

      <section class="library">
        <transition-group name="fade" tag="div" class="card-grid" v-if="visibleBookmarks.length">
          <article v-for="bookmark in visibleBookmarks" :key="bookmark.id" class="bookmark-card">
            <div class="card-header">
              <div class="site-icon"
                :style="{ backgroundImage: bookmark.coverImageUrl ? `url(${bookmark.coverImageUrl})` : '' }">
                <img v-if="bookmark.faviconUrl && !failedIconIds.has(bookmark.id)" :src="bookmark.faviconUrl" alt=""
                  @error="markIconFailed(bookmark.id)" />
                <span v-else>{{ getFallbackIconText(bookmark) }}</span>
              </div>
              <div class="card-title-wrap">
                <h2>{{ bookmark.title }}</h2>
                <div class="domain-line">
                  <span>{{ bookmark.domain }}</span>
                  <span v-if="bookmark.category" class="category-badge">{{ bookmark.category }}</span>
                </div>
              </div>
            </div>

            <p class="card-summary">{{ bookmark.summary || bookmark.description || "暂无摘要" }}</p>



            <div class="card-actions-overlay">
              <a class="icon-action" :href="bookmark.url" target="_blank" rel="noreferrer" title="打开链接">
                <ExternalLink :size="16" />
              </a>
              <button class="icon-action secondary-action" :class="{ selected: bookmark.pinned }" title="置顶"
                @click="togglePinned(bookmark)">
                <Pin :size="16" />
              </button>
              <button class="icon-action secondary-action" :title="showArchived ? '恢复' : '归档'"
                @click="toggleArchived(bookmark)">
                <Archive :size="16" />
              </button>
              <button class="icon-action secondary-action danger" title="删除" @click="removeBookmark(bookmark)">
                <Trash2 :size="16" />
              </button>
            </div>
          </article>
        </transition-group>

        <div v-else class="empty-state">
          <Bot :size="48" color="var(--text-tertiary)" style="margin-bottom: 16px" />
          <h2>你的数字大脑空空如也</h2>
          <p>在上方粘贴链接开始收集，AI 会为你搞定剩下的一切。</p>
        </div>
      </section>
    </template>

    <section v-else class="settings-page" aria-label="Linka 设置">
      <Teleport to="body">
        <div class="settings-grand-layout">
          <header class="settings-hero">
            <div class="hero-content">
              <h2>设置中心</h2>
              <p>统一管理分类、书签与 AI 配置，享受全景沉浸式体验。</p>
            </div>
            <button class="btn-close-settings" title="返回首页" @click="closeSettings">
              <X :size="32" />
            </button>
          </header>

          <nav class="settings-tabs-grand" aria-label="设置选项">
            <button :class="{ active: settingsTab === 'categories' }" @click="settingsTab = 'categories'">分类管理</button>
            <button :class="{ active: settingsTab === 'manage_bookmarks' }"
              @click="settingsTab = 'manage_bookmarks'">书签管理</button>
            <button :class="{ active: settingsTab === 'ai' }" @click="settingsTab = 'ai'">智能体配置</button>

          </nav>

          <div class="settings-section-grand">
            <section v-if="settingsTab === 'categories'">
              <div class="grand-panel">
                <div class="section-title">
                  <h3>分类管理</h3>
                  <p>AI 会优先从这些分类中选择。删除分类后，相关书签会归入“未分类”。</p>
                </div>

                <div class="category-create settings-form">
                  <input v-model="newCategoryName" placeholder="新分类名称" @keyup.enter="addCategory" />
                  <button class="btn-primary compact icon-btn" title="添加" @click="addCategory"><Plus /></button>
                </div>

                <div class="category-list">
                  <div v-for="category in categories" :key="category.id" class="category-item">
                    <input class="settings-inline-input" v-model="editingCategoryNames[category.id]"
                      :disabled="category.name === '未分类'" @keyup.enter="saveCategory(category)" />
                    <div class="category-item-actions">
                      <button class="mini-button" :disabled="category.name === '未分类'"
                        @click="saveCategory(category)">保存</button>
                      <button class="mini-button danger" :disabled="category.name === '未分类'"
                        @click="removeCategory(category)">删除</button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section v-else-if="settingsTab === 'ai'">
              <div class="ai-provider-layout" style="max-width: 1000px; margin: 0 auto; grid-template-columns: 220px 1fr;">
                <div class="ai-provider-sidebar">
                  <div class="section-title" style="margin-bottom: 24px;">
                    <h3>模型设置</h3>
                    <p style="font-size: 13px;">管理自定义模型供应商。启用的供应商和模型会用于收藏摘要、自动分类和 AI 助手。</p>
                  </div>
                  <div class="ai-provider-segments" style="background: transparent; border: none; padding: 0;">
                    <button v-for="provider in aiSettingsForm.providers" :key="provider.id" class="segment-btn"
                      :class="{ active: aiSettingsForm.activeProviderId === provider.id }"
                      @click="selectAiProvider(provider.id)">
                      <span class="segment-name">{{ provider.name }}</span>
                      <span class="status-dot" :class="{ enabled: provider.enabled }"></span>
                    </button>
                    <button class="segment-btn add-btn" title="添加服务商" @click="addAiProvider" style="justify-content: center; margin-top: 8px;">
                      <Plus :size="16" style="margin-right: 4px;" />
                      <span>添加服务商</span>
                    </button>
                  </div>
                </div>

                <div class="grand-panel ai-provider-detail settings-form" v-if="activeAiProvider" style="padding: 32px;">
                    <div class="ai-detail-title">
                      <div>
                        <h4>{{ activeAiProvider.name }}</h4>
                        <p>{{ activeAiProvider.enabled ? '已启用' : '已禁用' }}</p>
                      </div>
                      <button class="mini-button danger" @click="removeAiProvider(activeAiProvider.id)">
                        <Trash2 :size="14" />
                        删除
                      </button>
                    </div>

                    <label>
                      <span>供应商名称</span>
                      <input v-model="activeAiProvider.name" />
                    </label>

                    <div class="form-grid-two">
                      <label>
                        <span>API 格式</span>
                        <select v-model="activeAiProvider.apiFormat">
                          <option value="openai">OpenAI Chat Completions</option>
                          <option value="anthropic">Anthropic Messages</option>
                        </select>
                      </label>
                      <label>
                        <span>Temperature</span>
                        <input v-model.number="activeAiProvider.temperature" type="number" min="0" max="2" step="0.1" />
                      </label>
                    </div>

                    <label>
                      <span>Base URL</span>
                      <input v-model="activeAiProvider.baseUrl"
                        :placeholder="activeAiProvider.apiFormat === 'anthropic' ? 'https://api.anthropic.com' : 'https://api.openai.com/v1'" />
                    </label>

                    <label>
                      <span>API Key</span>
                      <input v-model="activeAiProvider.apiKey" type="password"
                        :placeholder="activeAiProvider.apiKeySet ? `留空保留 ${activeAiProvider.apiKeyPreview}` : '请输入 API Key'"
                        autocomplete="off" />
                    </label>

                    <label class="ai-toggle-row">
                      <input v-model="activeAiProvider.enabled" type="checkbox" />
                      <span>启用该供应商</span>
                    </label>

                    <div class="ai-model-panel">
                      <div class="ai-model-panel-header">
                        <div>
                          <h4>模型列表</h4>
                          <p>拖拽排序模型列表，排在第一位的将作为该供应商的默认模型使用。</p>
                        </div>
                      </div>

                      <div class="ai-model-list">
                        <div v-for="(model, index) in activeAiProvider.models" :key="model.id" class="ai-model-row"
                          :class="{ active: index === 0 }"
                          draggable="true"
                          @dragstart="onModelDragStart(index)"
                          @dragenter="onModelDragEnter(index)"
                          @dragend="onModelDragEnd"
                          @dragover.prevent>
                          <div class="ai-model-info" style="flex-direction: row; align-items: center; gap: 12px;">
                            <div style="cursor: grab; display: flex; align-items: center; color: var(--text-secondary);">
                              <GripVertical :size="16" />
                            </div>
                            <div style="display: flex; flex-direction: column;">
                              <span class="ai-model-name">{{ model.name }}</span>
                              <span class="ai-model-tokens">{{ model.maxTokens }} tokens</span>
                            </div>
                          </div>
                          <div class="ai-model-actions">
                            <span v-if="index === 0" style="font-size: 12px; color: var(--accent-primary); margin-right: 8px;">默认</span>
                            <button class="mini-button" @click="openEditAiModelModal(model)">
                              <Edit2 :size="14" />
                            </button>
                            <button class="mini-button danger" @click="removeAiModel(activeAiProvider, model.id)">
                              <Trash2 :size="14" />
                            </button>
                          </div>
                        </div>
                      </div>

                      <button class="ai-model-add-btn icon-btn" title="添加模型" @click="openAddAiModelModal">
                        <Plus :size="20" />
                      </button>
                    </div>

                    <div class="ai-settings-status">
                      <span :class="{ active: activeAiProvider.apiKeySet }">{{ activeAiProvider.apiKeySet ? '已配置 API Key' : '尚未配置 API Key' }}</span>
                      <span>{{ activeAiProvider.apiFormat === 'anthropic' ? 'Anthropic Messages API' : 'OpenAI Chat Completions' }}</span>
                      <span>当前模型：{{ activeAiProvider.models[0]?.name || '未选择' }}</span>
                    </div>

                    <button class="btn-primary settings-submit" :disabled="isAiSettingsSaving" @click="saveAiSettings">
                      <Loader2 v-if="isAiSettingsSaving" class="spin" :size="18" />
                      <Settings v-else :size="18" />
                      <span>保存模型设置</span>
                    </button>

                    <p v-if="aiSettingsMessage" class="settings-message">{{ aiSettingsMessage }}</p>
                  </div>
                </div>
            </section>

            <section v-else-if="settingsTab === 'manage_bookmarks'">
              <div class="grand-panel">
                <div class="section-title"
                  style="display: flex; justify-content: space-between; align-items: flex-start;">
                  <div>
                    <h3>书签管理</h3>
                    <p>在此修改已收藏书签的名称、地址、图标和分类。</p>
                  </div>
                    <button class="btn-primary icon-btn" title="添加书签" style="margin-bottom: 24px;"
                      @click="showAddBookmarkModal = true">
                      <Plus :size="20" />
                    </button>
                </div>

                <div class="bookmark-manage-list">
                  <div v-for="bookmark in bookmarks" :key="bookmark.id" class="bookmark-manage-item">
                    <div class="bookmark-manage-info">
                      <img v-if="bookmark.faviconUrl" :src="bookmark.faviconUrl" alt=""
                        class="bookmark-manage-icon" />
                      <div v-else class="bookmark-manage-icon-placeholder">
                        <Link2 :size="16" />
                      </div>
                      <div class="bookmark-manage-texts">
                        <h4>{{ bookmark.title || bookmark.domain }}</h4>
                        <p>{{ bookmark.url }}</p>
                      </div>
                      <span class="bookmark-manage-category" v-if="bookmark.category">{{ bookmark.category }}</span>
                    </div>
                    <button class="mini-button icon-only" title="编辑" @click="startEditingBookmark(bookmark)">
                      <Edit2 :size="16" />
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </Teleport>

      <!-- Add Bookmark Modal -->
      <transition name="fade">
        <div class="modal-overlay" v-if="showAddBookmarkModal" @click.self="showAddBookmarkModal = false">
          <div class="modal-card">
            <header class="modal-header">
              <h3>添加书签</h3>
              <button class="btn-close" @click="showAddBookmarkModal = false">
                <X :size="20" />
              </button>
            </header>
            <div class="modal-body settings-form">
              <label>
                <span>网页链接</span>
                <input v-model="settingsBookmarkUrl" placeholder="https://example.com"
                  @keyup.enter="addBookmarkFromSettings" />
              </label>
              <label>
                <span>标题</span>
                <input v-model="settingsBookmarkTitle" placeholder="可选，不填则自动抓取"
                  @keyup.enter="addBookmarkFromSettings" />
              </label>
              <label>
                <span>分类</span>
                <select v-model="settingsBookmarkCategory">
                  <option value="">AI 自动选择</option>
                  <option v-for="category in categories" :key="category.id" :value="category.name">
                    {{ category.name }}
                  </option>
                </select>
              </label>
              <button class="btn-primary settings-submit" style="margin-top: 16px;" :disabled="isSettingsSaving"
                @click="addBookmarkFromSettings">
                <Loader2 v-if="isSettingsSaving" class="spin" :size="18" />
                <Plus v-else :size="18" />
                <span>添加到 Linka</span>
              </button>
              <p v-if="settingsMessage" class="settings-message">{{ settingsMessage }}</p>
            </div>
          </div>
        </div>
      </transition>

      <!-- Edit Bookmark Modal -->
      <transition name="fade">
        <div class="modal-overlay" v-if="editingBookmarkId" @click.self="editingBookmarkId = null">
          <div class="modal-card">
            <header class="modal-header">
              <h3>编辑书签</h3>
              <button class="btn-close" @click="editingBookmarkId = null">
                <X :size="20" />
              </button>
            </header>
            <div class="modal-body settings-form">
              <label>
                <span>网页链接</span>
                <input v-model="editBookmarkData.url" placeholder="https://example.com"
                  @keyup.enter="saveEditedBookmark" />
              </label>
              <label>
                <span>标题</span>
                <input v-model="editBookmarkData.title" placeholder="可选，不填则自动抓取"
                  @keyup.enter="saveEditedBookmark" />
              </label>
              <label>
                <span>图标链接</span>
                <input v-model="editBookmarkData.faviconUrl" placeholder="可选"
                  @keyup.enter="saveEditedBookmark" />
              </label>
              <label>
                <span>分类</span>
                <select v-model="editBookmarkData.category">
                  <option value="全部">全部 / 未分类</option>
                  <option v-for="category in categories" :key="category.id" :value="category.name">
                    {{ category.name }}
                  </option>
                </select>
              </label>
              <div style="display: flex; gap: 12px; margin-top: 16px;">
                <button class="btn-secondary" style="flex: 1;" @click="editingBookmarkId = null">取消</button>
                <button class="btn-primary" style="flex: 1;" @click="saveEditedBookmark">
                  <span>保存修改</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </section>

    <!-- AI Assistant -->
    <button class="assistant-fab" title="唤起 AI 助手" @click="assistantOpen = true"
      v-show="!assistantOpen && !isSettingsPage">
      <Bot />
    </button>

    <transition name="fade">
      <aside v-if="assistantOpen && !isSettingsPage" class="assistant-panel">
        <div class="assistant-header">
          <div class="brand-icon" style="width: 36px; height: 36px; border-radius: 10px;">
            <Bot :size="20" />
          </div>
          <div class="assistant-header-text">
            <h2>AI 助手</h2>
            <p>{{ activeConversation?.title || '随时为你整理和检索' }}</p>
          </div>
          <button class="tool-btn" title="历史记录" :class="{ active: assistantHistoryOpen }"
            @click="toggleAssistantHistory">
            <History :size="18" />
          </button>
          <button class="tool-btn" title="新建对话" @click="startNewAssistantConversation">
            <Plus :size="18" />
          </button>
          <button class="btn-close" title="关闭" @click="assistantOpen = false">
            <X :size="20" />
          </button>
        </div>

        <div v-if="assistantHistoryOpen" class="assistant-history-page">
          <div class="history-search">
            <Search :size="16" />
            <input v-model="historySearchInput" placeholder="搜索历史记录..." />
          </div>
          <div class="history-actions">
            <span>历史记录</span>
            <button class="mini-button" @click="assistantHistoryManage = !assistantHistoryManage">
              {{ assistantHistoryManage ? '完成' : '管理' }}
            </button>
          </div>
          <div class="history-list">
            <button v-for="conversation in filteredAssistantConversations" :key="conversation.id" class="history-item"
              :class="{ active: activeConversationId === conversation.id }"
              @click="assistantHistoryManage ? toggleConversationSelected(conversation.id) : openAssistantConversation(conversation.id)">
              <input v-if="assistantHistoryManage" type="checkbox"
                :checked="selectedConversationIds.has(conversation.id)"
                @click.stop="toggleConversationSelected(conversation.id)" />
              <div>
                <strong>{{ conversation.title }}</strong>
                <span>{{ new Date(conversation.updatedAt).toLocaleString() }}</span>
              </div>
            </button>
            <div v-if="filteredAssistantConversations.length === 0" class="history-empty">
              {{ assistantConversations.length ? '没有匹配的历史记录' : '暂无历史记录' }}
            </div>
          </div>
          <div class="history-manage-bar" v-if="assistantHistoryManage">
            <span>已选择 {{ selectedConversationIds.size }} 条</span>
            <button class="mini-button danger" :disabled="selectedConversationIds.size === 0"
              @click="removeSelectedConversations">
              批量删除
            </button>
          </div>
        </div>

        <div v-else class="message-list">
          <div v-for="(message, index) in assistantMessages" :key="index" class="message" :class="message.role">
            <div v-if="message.reasoning" class="message-reasoning" :class="{ collapsed: message.reasoningCollapsed }">
              <button class="message-reasoning-toggle" type="button"
                @click="message.reasoningCollapsed = !message.reasoningCollapsed">
                <span>{{ message.streaming ? '思考中' : '思考完成' }}</span>
                <ChevronDown :size="14" />
              </button>
              <p v-if="!message.reasoningCollapsed">{{ message.reasoning }}<span
                  v-if="message.streaming && !message.text" class="stream-cursor"></span></p>
            </div>
            <p v-if="message.text || !message.reasoning">{{ message.text }}<span v-if="message.streaming"
                class="stream-cursor"></span></p>
            <div v-if="message.results?.length" class="result-list">
              <a v-for="result in message.results" :key="result.id" :href="result.url" target="_blank" rel="noreferrer">
                {{ result.title }}
                <span>{{ result.category }}</span>
              </a>
            </div>
          </div>
        </div>

        <div class="assistant-input-wrapper" v-if="!assistantHistoryOpen">
          <textarea v-model="assistantInput" placeholder="向 AI 提问，或输入 / 触发技能，@ 引用上下文"
            @keydown.enter.exact.prevent="askAssistant"></textarea>
          <div class="input-toolbar">
            <div class="toolbar-left">
              <button class="tool-btn" title="上传附件">
                <Plus :size="18" />
              </button>
              <div class="custom-select" :class="{ open: modelSelectOpen }">
                <div class="select-trigger" @click="toggleModelSelect">
                  <span>{{ assistantModel || '默认模型' }}</span>
                  <ChevronDown :size="14" class="select-icon" />
                </div>
                <transition name="fade">
                  <div class="select-dropdown" v-if="modelSelectOpen" @click.stop>
                    <div class="select-option" v-for="model in availableModels" :key="model.id"
                      @click="assistantModel = model.name; modelSelectOpen = false"
                      :class="{ active: assistantModel === model.name }">
                      {{ model.name }}
                    </div>
                    <div class="select-option" v-if="availableModels.length === 0"
                      @click="assistantModel = '默认模型'; modelSelectOpen = false">
                      默认模型
                    </div>
                  </div>
                </transition>
              </div>

              <div class="custom-select" :class="{ open: effortSelectOpen }">
                <div class="select-trigger" @click="toggleEffortSelect">
                  <span>{{ assistantEffort }}</span>
                  <ChevronDown :size="14" class="select-icon" />
                </div>
                <transition name="fade">
                  <div class="select-dropdown" v-if="effortSelectOpen" @click.stop>
                    <div class="select-option" v-for="effort in assistantEffortOptions" :key="effort"
                      @click="assistantEffort = effort; effortSelectOpen = false"
                      :class="{ active: assistantEffort === effort }">
                      {{ effort }}
                    </div>
                  </div>
                </transition>
              </div>
            </div>
            <div class="toolbar-right">
              <button class="tool-btn" title="语音输入">
                <Mic :size="18" />
              </button>
              <button class="btn-send" title="发送 (Enter)" :disabled="isAssistantLoading" @click="askAssistant">
                <Loader2 v-if="isAssistantLoading" class="spin" :size="16" />
                <Send v-else :size="16" />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </transition>
  </main>

  <!-- AI Model Edit Modal -->
  <div v-if="showAiModelModal" class="modal-overlay" @click.self="showAiModelModal = false">
    <div class="modal-card">
      <header class="modal-header">
        <h3>{{ editingAiModel ? '编辑模型' : '添加模型' }}</h3>
        <button class="btn-close" @click="showAiModelModal = false">
          <X :size="20" />
        </button>
      </header>
      <div class="modal-body settings-form">
        <label>
          <span>模型名称</span>
          <input v-model="aiModelFormData.name" placeholder="例如 deepseek-v4-flash"
            @keyup.enter="saveAiModelModal(activeAiProvider!)" />
        </label>
        <label>
          <span>最大 Token</span>
          <input v-model.number="aiModelFormData.maxTokens" type="number" min="64" max="2000000" step="64"
            @keyup.enter="saveAiModelModal(activeAiProvider!)" />
        </label>
      </div>
      <footer class="modal-footer">
        <button class="btn-secondary" @click="showAiModelModal = false">取消</button>
        <button class="btn-primary" @click="saveAiModelModal(activeAiProvider!)">保存</button>
      </footer>
    </div>
  </div>

</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  Archive, ChevronDown, ExternalLink, Link2, Loader2,
  Pin, Plus, Search, Send, Settings, Trash2, X, Bot, Edit2, List, Mic, History, ArrowLeft, GripVertical, Zap,
  Copy, Eye, EyeOff, Star, RefreshCw, Check, AlertCircle,
  BookOpen, Key, Sparkles, Cpu, Info, RotateCcw, Save, Activity
} from "@lucide/vue";
import { createAssistantConversation, createBookmark, createCategory, deleteAssistantConversations, deleteBookmark, deleteCategory, getAiSettings as fetchAiSettings, getAssistantConversation, listAssistantConversations, listBookmarks, listCategories, revealApiKey, saveAiSettings as updateAiSettings, streamAssistantMessage, updateBookmark, updateCategory, testAiConnection } from "./api";
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

const editingProviderId = ref("openai");
const showApiKey = ref(false);
const revealedApiKeyProviderIds = ref<Set<string>>(new Set());
const revealedApiKeys = ref<Record<string, string>>({});
const revealingApiKeyProviderIds = ref<Set<string>>(new Set());
const testStatus = ref<'idle' | 'testing' | 'success' | 'failed'>('idle');
const testMessage = ref('');

const showDeleteConfirmModal = ref(false);
const providerIdToDelete = ref<string | null>(null);

interface Toast {
  id: number;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

const toasts = ref<Toast[]>([]);
let nextToastId = 0;

function showToast(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', duration = 3000) {
  const id = nextToastId++;
  toasts.value.push({ id, message, type });
  setTimeout(() => {
    toasts.value = toasts.value.filter(t => t.id !== id);
  }, duration);
}

function isApiKeyRevealed(providerId: string): boolean {
  return revealedApiKeyProviderIds.value.has(providerId);
}

async function toggleRevealApiKey(providerId: string) {
  if (revealedApiKeyProviderIds.value.has(providerId)) {
    revealedApiKeyProviderIds.value.delete(providerId);
    delete revealedApiKeys.value[providerId];
    return;
  }

  revealedApiKeyProviderIds.value.add(providerId);
  showApiKey.value = false;

  if (revealedApiKeys.value[providerId] !== undefined) {
    return;
  }

  revealingApiKeyProviderIds.value.add(providerId);
  try {
    const res = await revealApiKey(providerId);
    revealedApiKeys.value[providerId] = res.apiKey;
  } catch (error: any) {
    revealedApiKeyProviderIds.value.delete(providerId);
    showToast("无法获取 API Key：" + (error.message || String(error)), "error");
  } finally {
    revealingApiKeyProviderIds.value.delete(providerId);
  }
}

function copyApiKeyValue(provider: any) {
  const revealed = revealedApiKeys.value[provider.id];
  const value = revealed && revealed.length > 0
    ? revealed
    : (provider.apiKey && provider.apiKey.length > 0 ? provider.apiKey : provider.apiKeyPreview);
  if (!value) {
    showToast("API Key 为空", "warning");
    return;
  }
  const isFull = !!revealed;
  navigator.clipboard.writeText(value)
    .then(() => showToast(isFull ? "API Key 已复制到剪贴板" : "已复制脱敏预览：" + value, "success"))
    .catch(err => showToast("复制失败: " + err, "error"));
}


async function testProviderConnection() {
  const provider = activeAiProvider.value;
  if (!provider) return;
  const defaultModel = provider.models[0];
  if (!defaultModel) {
    testStatus.value = 'failed';
    testMessage.value = '测试失败：该供应商下没有模型';
    return;
  }

  testStatus.value = 'testing';
  try {
    const res = await testAiConnection({
      provider: {
        id: provider.id,
        name: provider.name,
        apiFormat: provider.apiFormat,
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        temperature: provider.temperature
      },
      model: {
        id: defaultModel.id,
        name: defaultModel.name,
        maxTokens: defaultModel.maxTokens
      }
    });
    testStatus.value = 'success';
    testMessage.value = '连接正常';
  } catch (error: any) {
    testStatus.value = 'failed';
    testMessage.value = error.message || '连接失败';
  }
}

function selectAiProvider(id: string) {
  editingProviderId.value = id;
  testStatus.value = 'idle';
  testMessage.value = '';
}

const lastSavedTime = ref(localStorage.getItem('ai_last_saved') || '暂无保存记录');

function formatDate(date: Date) {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function getAvatarStyle(provider: { id: string; name: string }) {
  const gradients: Record<string, string> = {
    openai: 'background: linear-gradient(135deg, #10b981 0%, #059669 100%);',
    anthropic: 'background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);',
    minimax: 'background: linear-gradient(135deg, #a855f7 0%, #7e22ce 100%);',
    deepseek: 'background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);',
    moonshot: 'background: linear-gradient(135deg, #18181b 0%, #3f3f46 100%);',
    kimi: 'background: linear-gradient(135deg, #18181b 0%, #3f3f46 100%);',
    zhipu: 'background: linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%);',
    glm: 'background: linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%);',
    xiaomi: 'background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);',
    mimo: 'background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);',
    qwen: 'background: linear-gradient(135deg, #615ced 0%, #4338ca 100%);',
    doubao: 'background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);',
    wenxin: 'background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);',
    gemini: 'background: linear-gradient(135deg, #4285f4 0%, #9b72cb 50%, #d96570 100%);',
    mistral: 'background: linear-gradient(135deg, #facc15 0%, #ca8a04 100%);',
    cohere: 'background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);',
    meta: 'background: linear-gradient(135deg, #0866ff 0%, #0050cc 100%);',
    grok: 'background: linear-gradient(135deg, #111827 0%, #1f2937 100%);',
    perplexity: 'background: linear-gradient(135deg, #20b2aa 0%, #0f766e 100%);'
  };
  // 优先按供应商名称匹配（大小写不敏感）；回退按 ID 匹配
  return gradients[provider.name.trim().toLowerCase()] ?? gradients[provider.id] ?? 'background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);';
}

// 品牌名 → 图标文件名的映射表（apps/client/public/provider-icons/）
// 图标全部来自 lobe-icons 仓库（MIT 协议），本地化以避免 CDN 拦截与加载失败
// provider.name 大小写不敏感匹配，优先级高于 provider.id
const BRAND_ICON_MAP: Record<string, string> = {
  minimax: "minimax",
  deepseek: "deepseek",
  openai: "openai",
  anthropic: "anthropic",
  moonshot: "moonshot",
  kimi: "kimi",
  zhipu: "zhipu",
  qwen: "qwen",
  doubao: "doubao",
  wenxin: "wenxin",
  gemini: "gemini",
  mistral: "mistral",
  cohere: "cohere",
  meta: "meta",
  grok: "grok",
  perplexity: "perplexity",
  cursor: "cursor"
};

// 加载失败的供应商 ID 集合：用来回退到首字母头像
const failedProviderIconIds = ref<Set<string>>(new Set());

function resolveBrandSlug(provider: { id: string; name: string }): string | null {
  // 优先按供应商名称匹配（大小写不敏感）
  const nameKey = provider.name.trim().toLowerCase();
  if (nameKey && BRAND_ICON_MAP[nameKey] !== undefined) {
    return BRAND_ICON_MAP[nameKey];
  }
  // 回退按 ID 匹配
  if (provider.id && BRAND_ICON_MAP[provider.id] !== undefined) {
    return BRAND_ICON_MAP[provider.id];
  }
  return null;
}

function getProviderIconUrl(provider: { id: string; name: string }): string | null {
  const slug = resolveBrandSlug(provider);
  if (!slug) {
    return null;
  }
  return `/provider-icons/${slug}.svg`;
}

function showProviderIcon(provider: { id: string; name: string }): boolean {
  if (failedProviderIconIds.value.has(provider.id)) {
    return false;
  }
  return Boolean(getProviderIconUrl(provider));
}

function onProviderIconError(provider: { id: string; name: string }) {
  failedProviderIconIds.value.add(provider.id);
}

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

const testingModelId = ref<string | null>(null);
const modelTestResults = ref<Record<string, { status: 'success' | 'failed'; message: string }>>({});

async function testModel(provider: any, model: any) {
  testingModelId.value = model.id;
  try {
    const res = await testAiConnection({
      provider: {
        id: provider.id,
        name: provider.name,
        apiFormat: provider.apiFormat,
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        temperature: provider.temperature
      },
      model: {
        id: model.id,
        name: model.name,
        maxTokens: model.maxTokens
      }
    });
    modelTestResults.value[model.id] = {
      status: 'success',
      message: `连接成功 · ${res.response ?? '正常返回'}`
    };
  } catch (error: any) {
    modelTestResults.value[model.id] = {
      status: 'failed',
      message: `连接失败 · ${error.message || String(error)}`
    };
  } finally {
    testingModelId.value = null;
  }
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
const activeAiProvider = computed(() => aiSettingsForm.value.providers.find((provider) => provider.id === editingProviderId.value) ?? aiSettingsForm.value.providers[0]);
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
  editingProviderId.value = result.settings.activeProviderId || result.settings.providers[0]?.id || "openai";
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
  editingProviderId.value = provider.id;
  newAiProviderName.value = "";
}

function removeAiProvider(providerId: string) {
  if (aiSettingsForm.value.providers.length <= 1) {
    showToast("至少保留一个供应商。", "warning");
    return;
  }
  providerIdToDelete.value = providerId;
  showDeleteConfirmModal.value = true;
}

async function confirmDeleteProvider() {
  const providerId = providerIdToDelete.value;
  if (!providerId) return;

  aiSettingsForm.value.providers = aiSettingsForm.value.providers.filter((provider) => provider.id !== providerId);

  if (aiSettingsForm.value.activeProviderId === providerId) {
    aiSettingsForm.value.activeProviderId = aiSettingsForm.value.providers[0].id;
  }
  if (editingProviderId.value === providerId) {
    editingProviderId.value = aiSettingsForm.value.providers[0].id;
  }

  showDeleteConfirmModal.value = false;
  providerIdToDelete.value = null;

  // 立即保存配置到数据库
  await saveAiSettings();
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
    const overridden = revealedApiKeys.value[p.id];
    if (typeof overridden === "string" && overridden.length > 0) {
      p.apiKey = overridden;
    }
  });

  try {
    const result = await updateAiSettings(aiSettingsForm.value);

    aiSettingsForm.value = result.settings;
    aiSettingsMessage.value = "AI 配置已保存。";
    showToast("AI 配置已保存。", "success");
    const nowStr = formatDate(new Date());
    localStorage.setItem('ai_last_saved', nowStr);
    lastSavedTime.value = nowStr;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "AI 配置保存失败";
    aiSettingsMessage.value = errMsg;
    showToast(errMsg, "error");
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

function openGuide() {
  // 打开官方项目主页/使用指南说明
  window.open("https://github.com/leinatorX/linka", "_blank");
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
          <button class="btn-guide" title="使用指南" @click="openGuide">
            <BookOpen :size="16" />
            <span>使用指南</span>
          </button>
          <button class="btn-close-settings" title="返回首页" @click="closeSettings">
            <X :size="24" />
          </button>


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
                  <button class="btn-primary compact icon-btn" title="添加" @click="addCategory">
                    <Plus />
                  </button>
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
              <div class="ai-provider-layout"
                style="width: 100%; display: grid; grid-template-columns: 280px 1fr; gap: 32px; align-items: start;">

                <!-- Left Sidebar: Provider Management -->
                <div class="ai-provider-sidebar" style="display: flex; flex-direction: column; gap: 20px;">
                  <div class="sidebar-header" style="margin-bottom: 4px;">
                    <h3 style="font-size: 18px; font-weight: 600; color: var(--text-primary); margin: 0 0 4px 0;">供应商管理
                    </h3>
                    <p style="font-size: 13px; color: var(--text-secondary); margin: 0;">管理您的 AI 服务商</p>
                  </div>

                  <div class="ai-provider-cards" style="display: flex; flex-direction: column; gap: 12px;">
                    <div v-for="provider in aiSettingsForm.providers" :key="provider.id" class="provider-card"
                      :class="{ active: editingProviderId === provider.id, default: aiSettingsForm.activeProviderId === provider.id }"
                      @click="selectAiProvider(provider.id)"
                      style="display: flex; align-items: center; justify-content: space-between; padding: 16px; border-radius: var(--radius-lg); background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); cursor: pointer; transition: all 0.2s;"
                      :style="editingProviderId === provider.id ? 'border-color: var(--accent-primary); box-shadow: 0 0 0 1px var(--accent-primary); background: rgba(255,255,255,0.04);' : ''">

                      <div style="display: flex; align-items: center; gap: 12px;">
                        <div class="provider-avatar" :style="getAvatarStyle(provider)"
                          style="width: 36px; height: 36px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px; color: white; overflow: hidden;">
                          <img v-if="showProviderIcon(provider)" :src="getProviderIconUrl(provider) ?? ''"
                            :alt="provider.name" @error="onProviderIconError(provider)"
                            style="width: 22px; height: 22px; object-fit: contain; filter: brightness(0) invert(1);" />
                          <span v-else>{{ provider.name[0] }}</span>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 2px;">
                          <span style="font-size: 14px; font-weight: 600; color: var(--text-primary);">{{ provider.name
                          }}</span>
                          <span style="font-size: 12px; color: var(--text-secondary);">{{ provider.models.length }}
                            个模型</span>
                        </div>
                      </div>

                      <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="status-badge" :class="{ active: provider.enabled }"
                          style="font-size: 11px; padding: 2px 6px; border-radius: 4px; display: flex; align-items: center; gap: 4px;"
                          :style="provider.enabled ? 'background: rgba(16,185,129,0.1); color: var(--success);' : 'background: rgba(255,255,255,0.05); color: var(--text-secondary);'">
                          {{ provider.enabled ? '已启用' : '已禁用' }}
                          <span style="width: 6px; height: 6px; border-radius: 50%; display: inline-block;"
                            :style="provider.enabled ? 'background: var(--success);' : 'background: var(--text-secondary);'"></span>
                        </span>
                      </div>
                    </div>

                    <button class="add-provider-btn" @click="addAiProvider"
                      style="display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; height: 40px; border-radius: var(--radius-md); border: 1px dashed rgba(255,255,255,0.15); background: transparent; color: var(--text-primary); font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
                      <Plus :size="16" />
                      <span>添加供应商</span>
                    </button>
                  </div>
                </div>

                <!-- Right Detail Column -->
                <div class="ai-provider-detail-container" v-if="activeAiProvider"
                  style="display: flex; flex-direction: column; gap: 24px; min-width: 0;">
                  <!-- Top Header Panel -->
                  <div class="grand-panel"
                    style="padding: 24px; display: flex; align-items: center; justify-content: space-between; position: relative;">
                    <div style="display: flex; align-items: center; gap: 16px;">
                      <div class="provider-avatar large" :style="getAvatarStyle(activeAiProvider)"
                        style="width: 48px; height: 48px; border-radius: var(--radius-lg); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 22px; color: white; overflow: hidden;">
                        <img v-if="showProviderIcon(activeAiProvider)" :src="getProviderIconUrl(activeAiProvider) ?? ''"
                          :alt="activeAiProvider.name" @error="onProviderIconError(activeAiProvider)"
                          style="width: 30px; height: 30px; object-fit: contain; filter: brightness(0) invert(1);" />
                        <span v-else>{{ activeAiProvider.name[0] }}</span>
                      </div>
                      <div style="display: flex; flex-direction: column; gap: 6px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                          <h4 style="font-size: 18px; font-weight: 600; color: var(--text-primary); margin: 0;">{{
                            activeAiProvider.name }}</h4>
                          <span class="status-badge" :class="{ active: activeAiProvider.enabled }"
                            style="font-size: 11px; padding: 2px 6px; border-radius: 4px;"
                            :style="activeAiProvider.enabled ? 'background: rgba(16,185,129,0.1); color: var(--success);' : 'background: rgba(255,255,255,0.05); color: var(--text-secondary);'">
                            {{ activeAiProvider.enabled ? '已启用' : '已禁用' }}
                          </span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                          <span class="meta-pill"
                            style="font-size: 11px; padding: 4px 10px; border-radius: 9999px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: var(--text-secondary); display: inline-flex; align-items: center; gap: 6px;">
                            <Cpu :size="12" />
                            <span>{{ activeAiProvider.apiFormat === 'anthropic' ? 'Anthropic Messages API' :
                              'OpenAIChatCompletions' }}</span>
                          </span>
                          <span class="meta-pill"
                            style="font-size: 11px; padding: 4px 10px; border-radius: 9999px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: var(--text-secondary); display: inline-flex; align-items: center; gap: 6px;">
                            <Key :size="12" />
                            <span>{{ activeAiProvider.apiKeySet ? '已配置 API Key' : '未配置 API Key' }}</span>
                          </span>
                          <span class="meta-pill"
                            style="font-size: 11px; padding: 4px 10px; border-radius: 9999px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: var(--text-secondary); display: inline-flex; align-items: center; gap: 6px;">
                            <Sparkles :size="12" />
                            <span>默认模型: {{ activeAiProvider.models[0]?.name || '无' }}</span>
                          </span>
                          <span v-if="aiSettingsForm.activeProviderId === activeAiProvider.id" class="meta-pill"
                            style="font-size: 11px; padding: 4px 10px; border-radius: 9999px; background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.2); color: #818cf8; font-weight: 500; display: inline-flex; align-items: center; gap: 6px;">
                            <Star :size="12" />
                            <span>默认服务商</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <!-- Delete Button -->
                    <button class="provider-more-btn" @click.stop="removeAiProvider(activeAiProvider.id)" title="删除供应商"
                      style="width: 36px; height: 36px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12); color: var(--danger); cursor: pointer; transition: all 0.2s;">
                      <Trash2 :size="16" />
                    </button>
                  </div>

                  <!-- Provider Form Fields Panel -->
                  <div class="grand-panel settings-form"
                    style="padding: 32px; display: flex; flex-direction: column; gap: 24px;">
                    <!-- 基础信息 -->
                    <div style="display: flex; flex-direction: column; gap: 16px;">
                      <h4
                        style="font-size: 15px; font-weight: 600; color: var(--text-primary); border-left: 3px solid var(--accent-primary); padding-left: 8px; margin: 0;">
                        基础信息</h4>

                      <div style="display: grid; grid-template-columns: 1fr 120px; gap: 24px; align-items: end;">
                        <label style="display: flex; flex-direction: column; gap: 8px; margin: 0;">
                          <span style="font-size: 13px; color: var(--text-secondary); font-weight: 500;">供应商名称</span>
                          <input v-model="activeAiProvider.name"
                            style="width: 100%; height: 40px; border-radius: var(--radius-md); background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.08); color: var(--text-primary); padding: 0 12px; font-size: 14px;" />
                        </label>

                        <label
                          style="display: flex; flex-direction: column; gap: 8px; margin: 0; align-items: flex-start;">
                          <span style="font-size: 13px; color: var(--text-secondary); font-weight: 500;">启用状态</span>
                          <div style="display: flex; align-items: center; height: 40px;">
                            <!-- Styled Switch Toggle -->
                            <div class="switch-toggle" @click="activeAiProvider.enabled = !activeAiProvider.enabled"
                              style="width: 48px; height: 26px; border-radius: 999px; padding: 2px; cursor: pointer; transition: background 0.2s; display: flex; align-items: center;"
                              :style="activeAiProvider.enabled ? 'background: var(--accent-primary); justify-content: flex-end;' : 'background: rgba(255,255,255,0.1); justify-content: flex-start;'">
                              <div
                                style="width: 22px; height: 22px; border-radius: 50%; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.2); transition: all 0.2s;">
                              </div>
                            </div>
                          </div>
                        </label>
                      </div>
                    </div>

                    <!-- API 配置 -->
                    <div style="display: flex; flex-direction: column; gap: 16px;">
                      <h4
                        style="font-size: 15px; font-weight: 600; color: var(--text-primary); border-left: 3px solid var(--accent-primary); padding-left: 8px; margin: 0;">
                        API 配置</h4>

                      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
                        <label style="display: flex; flex-direction: column; gap: 8px; margin: 0;">
                          <span style="font-size: 13px; color: var(--text-secondary); font-weight: 500;">API 格式</span>
                          <div style="position: relative; display: flex; align-items: center; width: 100%;">
                            <select v-model="activeAiProvider.apiFormat"
                              style="width: 100%; height: 40px; border-radius: var(--radius-md); background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.08); color: var(--text-primary); padding: 0 36px 0 12px; font-size: 14px; appearance: none; -webkit-appearance: none; cursor: pointer;">
                              <option value="openai">OpenAI Chat Completions</option>
                              <option value="anthropic">Anthropic Messages</option>
                            </select>
                            <div
                              style="position: absolute; right: 12px; color: var(--text-secondary); pointer-events: none; display: flex; align-items: center;">
                              <ChevronDown :size="16" />
                            </div>
                          </div>
                        </label>

                        <label style="display: flex; flex-direction: column; gap: 8px; margin: 0;">
                          <div style="display: flex; align-items: center; gap: 6px;">
                            <span
                              style="font-size: 13px; color: var(--text-secondary); font-weight: 500;">Temperature</span>
                            <span class="info-tooltip" title="控制模型生成文本的随机性。值越高越有创意，值越低越精确稳定。"
                              style="color: var(--text-secondary); cursor: pointer; display: flex; align-items: center;">
                              <Info :size="14" />
                            </span>
                          </div>
                          <div style="display: flex; align-items: center; gap: 16px; height: 40px;">
                            <!-- Number Input -->
                            <input type="number" v-model.number="activeAiProvider.temperature" min="0" max="2"
                              step="0.1"
                              style="width: 70px; height: 40px; text-align: center; border-radius: var(--radius-md); background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.08); color: var(--text-primary); font-size: 14px; font-weight: 500;" />

                            <!-- Range Slider and Marks -->
                            <div
                              style="flex: 1; display: flex; flex-direction: column; gap: 4px; justify-content: center; position: relative; padding-bottom: 12px; height: 100%;">
                              <input v-model.number="activeAiProvider.temperature" type="range" min="0" max="2"
                                step="0.1"
                                style="width: 100%; accent-color: var(--accent-primary); height: 4px; background: rgba(255,255,255,0.1); border-radius: 99px; appearance: none; cursor: pointer; margin: 0;" />
                              <div
                                style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-secondary); position: absolute; bottom: -6px; left: 0; right: 0;">
                                <span>0</span>
                                <span>2</span>
                              </div>
                            </div>
                          </div>
                        </label>
                      </div>

                      <label style="display: flex; flex-direction: column; gap: 8px; margin: 0;">
                        <span style="font-size: 13px; color: var(--text-secondary); font-weight: 500;">Base URL</span>
                        <input v-model="activeAiProvider.baseUrl"
                          :placeholder="activeAiProvider.apiFormat === 'anthropic' ? 'https://api.anthropic.com' : 'https://api.openai.com/v1'"
                          style="width: 100%; height: 40px; border-radius: var(--radius-md); background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.08); color: var(--text-primary); padding: 0 12px; font-size: 14px;" />
                      </label>

                      <label style="display: flex; flex-direction: column; gap: 8px; margin: 0;">
                        <span style="font-size: 13px; color: var(--text-secondary); font-weight: 500;">API Key</span>
                        <div style="position: relative; display: flex; align-items: center;">
                          <input v-if="activeAiProvider.apiKeySet && !isApiKeyRevealed(activeAiProvider.id)"
                            type="text" :value="'•'.repeat(Math.max(activeAiProvider.apiKeyPreview.length || 12, 12))"
                            readonly tabindex="-1"
                            style="width: 100%; height: 40px; border-radius: var(--radius-md); background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.08); color: var(--text-primary); padding: 0 80px 0 12px; font-size: 18px; letter-spacing: 2px; cursor: default;" />
                          <input v-else-if="revealingApiKeyProviderIds.has(activeAiProvider.id)"
                            type="text" value="正在加载…" readonly tabindex="-1"
                            style="width: 100%; height: 40px; border-radius: var(--radius-md); background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.08); color: var(--text-secondary); padding: 0 80px 0 12px; font-size: 14px;" />
                          <input v-else-if="isApiKeyRevealed(activeAiProvider.id)"
                            type="text" v-model="revealedApiKeys[activeAiProvider.id]"
                            placeholder="请输入新的 API Key 覆盖现有值" autocomplete="off"
                            style="width: 100%; height: 40px; border-radius: var(--radius-md); background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.08); color: var(--text-primary); padding: 0 80px 0 12px; font-size: 14px;" />
                          <input v-else :type="showApiKey ? 'text' : 'password'" v-model="activeAiProvider.apiKey"
                            placeholder="请输入 API Key" autocomplete="off"
                            style="width: 100%; height: 40px; border-radius: var(--radius-md); background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.08); color: var(--text-primary); padding: 0 80px 0 12px; font-size: 14px;" />
                          <div style="position: absolute; right: 8px; display: flex; gap: 4px;">
                            <button v-if="activeAiProvider.apiKeySet && !isApiKeyRevealed(activeAiProvider.id)"
                              type="button" :disabled="revealingApiKeyProviderIds.has(activeAiProvider.id)"
                              @click="toggleRevealApiKey(activeAiProvider.id)" title="解锁查看/修改"
                              style="background: transparent; border: none; color: var(--text-secondary); width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 4px;">
                              <Loader2 v-if="revealingApiKeyProviderIds.has(activeAiProvider.id)" class="spin" :size="14" />
                              <Eye v-else :size="16" />
                            </button>
                            <button v-else-if="activeAiProvider.apiKeySet" type="button"
                              @click="toggleRevealApiKey(activeAiProvider.id)" title="锁定"
                              style="background: transparent; border: none; color: var(--text-secondary); width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 4px;">
                              <EyeOff :size="16" />
                            </button>
                            <button v-else type="button" @click="showApiKey = !showApiKey"
                              style="background: transparent; border: none; color: var(--text-secondary); width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 4px;">
                              <Eye v-if="!showApiKey" :size="16" />
                              <EyeOff v-else :size="16" />
                            </button>
                            <button type="button" @click="copyApiKeyValue(activeAiProvider)" title="复制"
                              style="background: transparent; border: none; color: var(--text-secondary); width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 4px;">
                              <Copy :size="16" />
                            </button>
                          </div>
                        </div>
                      </label>


                    </div>

                    <!-- 模型列表 -->
                    <div style="display: flex; flex-direction: column; gap: 16px;">
                      <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;">
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                          <h4
                            style="font-size: 15px; font-weight: 600; color: var(--text-primary); border-left: 3px solid var(--accent-primary); padding-left: 8px; margin: 0;">
                            模型列表</h4>
                          <p style="font-size: 12px; color: var(--text-secondary); margin: 0 0 0 11px;">
                            拖动模型调整优先级，排在第一位的模型作为默认模型使用。</p>
                        </div>
                        <button type="button" class="outline-btn" @click="openAddAiModelModal"
                          style="display: flex; align-items: center; justify-content: center; gap: 6px; padding: 0 14px; height: 32px; border-radius: var(--radius-md); border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04); color: var(--text-primary); font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; white-space: nowrap;">
                          <Plus :size="14" />
                          <span>添加模型</span>
                        </button>
                      </div>

                      <div class="ai-model-list" style="display: flex; flex-direction: column; gap: 12px;">
                        <div v-for="(model, index) in activeAiProvider.models" :key="model.id" class="ai-model-row"
                          :class="{ active: index === 0 }" draggable="true" @dragstart="onModelDragStart(index)"
                          @dragenter="onModelDragEnter(index)" @dragend="onModelDragEnd" @dragover.prevent
                          style="display: flex; flex-direction: column; align-items: stretch; gap: 8px; padding: 12px 16px; border-radius: var(--radius-md); background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.04); cursor: default; transition: all 0.2s;"
                          :style="index === 0 ? 'border-color: rgba(99,102,241,0.2); background: rgba(99,102,241,0.02);' : ''">

                          <div style="display: flex; align-items: center; gap: 12px;">
                            <div
                              style="cursor: grab; display: flex; align-items: center; color: var(--text-secondary); flex-shrink: 0;">
                              <GripVertical :size="16" />
                            </div>
                            <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px;">
                              <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 14px; font-weight: 600; color: var(--text-primary);">{{
                                  model.name
                                }}</span>
                                <span v-if="index === 0"
                                  style="font-size: 11px; padding: 1px 6px; border-radius: 4px; background: rgba(99,102,241,0.1); color: #818cf8; font-weight: 500;">默认</span>
                              </div>
                              <div
                                style="display: flex; align-items: center; gap: 12px; font-size: 12px; color: var(--text-secondary); flex-wrap: wrap;">
                                <span>Context: {{ model.maxTokens.toLocaleString() }} tokens</span>
                                <span>模型 ID: {{ model.id }}</span>
                              </div>
                            </div>

                            <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                              <button type="button" class="btn-model-icon" title="测试连接"
                                :disabled="testingModelId === model.id" @click="testModel(activeAiProvider, model)">
                                <Loader2 v-if="testingModelId === model.id" class="spin" :size="14" />
                                <Activity v-else :size="14" />
                              </button>
                              <button type="button" class="btn-model-icon" title="编辑"
                                @click="openEditAiModelModal(model)">
                                <Edit2 :size="14" />
                              </button>
                              <button type="button" class="btn-model-icon btn-model-icon-danger" title="删除"
                                @click="removeAiModel(activeAiProvider, model.id)">
                                <Trash2 :size="14" />
                              </button>
                            </div>
                          </div>

                          <div v-if="modelTestResults[model.id]" class="model-test-result"
                            :class="['model-test-result-' + modelTestResults[model.id].status]"
                            style="display: flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 6px; font-size: 12px; line-height: 1.4;">
                            <Check v-if="modelTestResults[model.id].status === 'success'" :size="14" />
                            <X v-else :size="14" />
                            <span style="flex: 1;">{{ modelTestResults[model.id].message }}</span>
                            <button type="button" @click="delete modelTestResults[model.id]"
                              style="background: transparent; border: none; color: inherit; cursor: pointer; display: inline-flex; align-items: center; padding: 0; opacity: 0.7;"
                              title="关闭">
                              <X :size="12" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- Bottom Actions Bar -->
                    <div
                      style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 24px; margin-top: 8px;">
                      <span style="font-size: 13px; color: var(--text-secondary);">上次保存：{{ lastSavedTime }}</span>

                      <div style="display: flex; align-items: center; gap: 12px;">
                        <button type="button" @click="loadAiSettings"
                          style="display: flex; align-items: center; gap: 6px; padding: 0 16px; height: 40px; border-radius: var(--radius-md); border: 1px solid rgba(255,255,255,0.1); background: transparent; color: var(--text-primary); font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
                          <RotateCcw :size="14" />
                          <span>重置修改</span>
                        </button>
                        <button type="button" :disabled="isAiSettingsSaving" @click="saveAiSettings"
                          style="display: flex; align-items: center; gap: 8px; padding: 0 20px; height: 40px; border-radius: var(--radius-md); background: var(--accent-primary); border: none; color: white; font-weight: 600; font-size: 14px; cursor: pointer; transition: all 0.2s; box-shadow: var(--shadow-sm);">
                          <Loader2 v-if="isAiSettingsSaving" class="spin" :size="16" />
                          <Save v-else :size="16" />
                          <span>保存默认设置</span>
                        </button>
                      </div>
                    </div>
                  </div>
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
                      <img v-if="bookmark.faviconUrl" :src="bookmark.faviconUrl" alt="" class="bookmark-manage-icon" />
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
                <input v-model="editBookmarkData.title" placeholder="可选，不填则自动抓取" @keyup.enter="saveEditedBookmark" />
              </label>
              <label>
                <span>图标链接</span>
                <input v-model="editBookmarkData.faviconUrl" placeholder="可选" @keyup.enter="saveEditedBookmark" />
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

  <!-- Delete Provider Confirm Modal -->
  <div v-if="showDeleteConfirmModal" class="modal-overlay" @click.self="showDeleteConfirmModal = false">
    <div class="modal-card" style="max-width: 400px;">
      <header class="modal-header">
        <h3>确认删除</h3>
        <button class="btn-close" @click="showDeleteConfirmModal = false">
          <X :size="20" />
        </button>
      </header>
      <div class="modal-body">
        <p style="color: var(--text-secondary); font-size: 14px; margin: 0; line-height: 1.5;">
          确定要删除该供应商吗？删除后所有相关的模型配置和 API Key 将被清除，此操作无法撤销。
        </p>
      </div>
      <footer class="modal-footer">
        <button class="btn-secondary" @click="showDeleteConfirmModal = false">取消</button>
        <button class="btn-primary" style="background: var(--danger); box-shadow: 0 0 12px rgba(239, 68, 68, 0.4);" @click="confirmDeleteProvider">确认删除</button>
      </footer>
    </div>
  </div>

  <!-- Toast Notifications -->
  <div class="toast-container">
    <TransitionGroup name="toast">
      <div v-for="toast in toasts" :key="toast.id" :class="['toast-item', toast.type]">
        <Check v-if="toast.type === 'success'" :size="16" />
        <AlertCircle v-else-if="toast.type === 'error' || toast.type === 'warning'" :size="16" />
        <Info v-else :size="16" />
        <span>{{ toast.message }}</span>
      </div>
    </TransitionGroup>
  </div>

</template>

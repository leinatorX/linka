import { computed, ref, type Ref } from "vue";
import {
  getAiSettings as fetchAiSettings,
  revealApiKey,
  reorderAiProviders as apiReorderAiProviders,
  saveAiSettings as updateAiSettings,
  testAiConnection
} from "../api";
import type { AiApiFormat, AiModelConfig, AiProviderConfig } from "../types";
import type { ToastType } from "./useToast";

interface UseAiSettingsOptions {
  assistantModel?: Ref<string>;
  showToast: (message: string, type?: ToastType, duration?: number) => void;
}

export type ModelTestResult = {
  status: "success" | "failed";
  message: string;
};

function createLocalId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatDate(date: Date) {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function createAiProvider(name: string, apiFormat: AiApiFormat = "anthropic"): AiProviderConfig {
  const activeModelId = createLocalId("model");
  return {
    id: createLocalId("provider"),
    name,
    apiFormat,
    baseUrl: apiFormat === "anthropic" ? "https://api.anthropic.com" : "https://api.openai.com/v1",
    apiKey: "",
    enabled: true,
    temperature: 0.2,
    activeModelId,
    models: [],
    apiKeySet: false,
    apiKeyPreview: ""
  };
}

export function useAiSettings(options: UseAiSettingsOptions) {
  const aiSettingsMessage = ref("");
  const isAiSettingsSaving = ref(false);
  const newAiProviderName = ref("");
  const showAiModelModal = ref(false);
  const editingAiModel = ref<AiModelConfig | null>(null);
  const aiModelFormData = ref({ name: "", maxTokens: 1000, supportsVision: false });
  const aiSettingsForm = ref({
    activeProviderId: "openai",
    providers: [] as AiProviderConfig[]
  });
  const editingProviderId = ref("openai");
  const showApiKey = ref(false);
  const revealedApiKeyProviderIds = ref<Set<string>>(new Set());
  const revealedApiKeys = ref<Record<string, string>>({});
  const revealingApiKeyProviderIds = ref<Set<string>>(new Set());
  const testStatus = ref<"idle" | "testing" | "success" | "failed">("idle");
  const testMessage = ref("");
  const showDeleteConfirmModal = ref(false);
  const providerIdToDelete = ref<string | null>(null);
  const draggedModelIndex = ref<number | null>(null);
  const testingModelId = ref<string | null>(null);
  const modelTestResults = ref<Record<string, ModelTestResult>>({});
  const lastSavedTime = ref(localStorage.getItem("ai_last_saved") || "暂无保存记录");

  const activeAiProvider = computed(() => aiSettingsForm.value.providers.find((provider) => provider.id === editingProviderId.value) ?? aiSettingsForm.value.providers[0]);
  const availableModels = computed(() => aiSettingsForm.value.providers
    .filter((provider) => provider.enabled)
    .flatMap((provider) => provider.models)
    .filter((model) => model.enabled));

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
    } catch (error) {
      revealedApiKeyProviderIds.value.delete(providerId);
      options.showToast("无法获取接口密钥：" + (error instanceof Error ? error.message : String(error)), "error");
    } finally {
      revealingApiKeyProviderIds.value.delete(providerId);
    }
  }

  function copyApiKeyValue(provider: AiProviderConfig) {
    const revealed = revealedApiKeys.value[provider.id];
    const value = revealed && revealed.length > 0
      ? revealed
      : (provider.apiKey && provider.apiKey.length > 0 ? provider.apiKey : provider.apiKeyPreview);
    if (!value) {
      options.showToast("接口密钥为空", "warning");
      return;
    }
    const isFull = Boolean(revealed);
    navigator.clipboard.writeText(value)
      .then(() => options.showToast(isFull ? "接口密钥已复制到剪贴板" : "已复制脱敏预览：" + value, "success"))
      .catch((error) => options.showToast("复制失败: " + error, "error"));
  }

  async function testProviderConnection() {
    const provider = activeAiProvider.value;
    if (!provider) return;
    const defaultModel = provider.models[0];
    if (!defaultModel) {
      testStatus.value = "failed";
      testMessage.value = "测试失败：该供应商下没有模型";
      return;
    }

    testStatus.value = "testing";
    try {
      await testAiConnection({
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
      testStatus.value = "success";
      testMessage.value = "连接正常";
    } catch (error) {
      testStatus.value = "failed";
      testMessage.value = error instanceof Error ? error.message : "连接失败";
    }
  }

  function selectAiProvider(id: string) {
    editingProviderId.value = id;
    testStatus.value = "idle";
    testMessage.value = "";
  }

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

  async function testModel(provider: AiProviderConfig, model: AiModelConfig) {
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
        status: "success",
        message: `连接成功 · ${res.response ?? "正常返回"}`
      };
    } catch (error) {
      modelTestResults.value[model.id] = {
        status: "failed",
        message: `连接失败 · ${error instanceof Error ? error.message : String(error)}`
      };
    } finally {
      testingModelId.value = null;
    }
  }

  async function loadAiSettings() {
    const result = await fetchAiSettings();
    aiSettingsForm.value = result.settings;
    editingProviderId.value = result.settings.providers[0]?.id || "openai";
    if (availableModels.value.length > 0 && options.assistantModel && !options.assistantModel.value) {
      options.assistantModel.value = availableModels.value[0].name;
    }
  }

  function addAiProvider() {
    const provider = createAiProvider(newAiProviderName.value.trim() || "自定义供应商");
    provider.models = [
      {
        id: provider.activeModelId,
        name: "MiniMax-M3",
        maxTokens: 1000,
        enabled: true,
        supportsVision: true
      }
    ];
    aiSettingsForm.value.providers.push(provider);
    editingProviderId.value = provider.id;
    newAiProviderName.value = "";
  }

  function removeAiProvider(providerId: string) {
    if (aiSettingsForm.value.providers.length <= 1) {
      options.showToast("至少保留一个供应商。", "warning");
      return;
    }
    providerIdToDelete.value = providerId;
    showDeleteConfirmModal.value = true;
  }

  function cancelDeleteProvider() {
    showDeleteConfirmModal.value = false;
    providerIdToDelete.value = null;
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

    cancelDeleteProvider();
    await saveAiSettings();
  }

  function openAddAiModelModal() {
    editingAiModel.value = null;
    aiModelFormData.value = { name: "", maxTokens: 1000, supportsVision: false };
    showAiModelModal.value = true;
  }

  function openEditAiModelModal(model: AiModelConfig) {
    editingAiModel.value = model;
    aiModelFormData.value = { name: model.name, maxTokens: model.maxTokens, supportsVision: model.supportsVision };
    showAiModelModal.value = true;
  }

  function closeAiModelModal() {
    showAiModelModal.value = false;
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
      editingAiModel.value.supportsVision = Boolean(aiModelFormData.value.supportsVision);
    } else {
      const model = {
        id: createLocalId("model"),
        name,
        maxTokens: Number(aiModelFormData.value.maxTokens) || 1000,
        enabled: true,
        supportsVision: Boolean(aiModelFormData.value.supportsVision)
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

    aiSettingsForm.value.providers.forEach((provider) => {
      provider.models.forEach((model) => {
        model.enabled = true;
      });
      if (provider.models.length > 0) {
        provider.activeModelId = provider.models[0].id;
      }
      const overridden = revealedApiKeys.value[provider.id];
      if (typeof overridden === "string" && overridden.length > 0) {
        provider.apiKey = overridden;
      }
    });

    try {
      const result = await updateAiSettings(aiSettingsForm.value);

      aiSettingsForm.value = result.settings;
      aiSettingsMessage.value = "AI 配置已保存。";
      options.showToast("AI 配置已保存。", "success");
      const nowStr = formatDate(new Date());
      localStorage.setItem("ai_last_saved", nowStr);
      lastSavedTime.value = nowStr;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "AI 配置保存失败";
      aiSettingsMessage.value = errMsg;
      options.showToast(errMsg, "error");
    } finally {
      isAiSettingsSaving.value = false;
    }
  }

  // 拖拽重排供应商：乐观更新 + 失败回滚。
  async function reorderProviders(orderedIds: string[]) {
    const previous = aiSettingsForm.value.providers.slice();
    const previousActive = aiSettingsForm.value.activeProviderId;
    const known = new Set(previous.map((provider) => provider.id));
    const ids = orderedIds.filter((id, index) => known.has(id) && orderedIds.indexOf(id) === index);
    if (ids.length !== previous.length) {
      // 客户端 id 集合与服务端不一致时拒绝发送，避免脏数据
      options.showToast("排序参数无效，已取消", "warning");
      return false;
    }
    const byId = new Map(previous.map((provider) => [provider.id, provider]));
    aiSettingsForm.value.providers = ids.map((id) => byId.get(id)!).filter(Boolean);

    try {
      const result = await apiReorderAiProviders(orderedIds);
      aiSettingsForm.value = {
        activeProviderId: result.settings.activeProviderId,
        providers: result.settings.providers
      };
      return true;
    } catch (error) {
      aiSettingsForm.value.providers = previous;
      aiSettingsForm.value.activeProviderId = previousActive;
      options.showToast("供应商排序失败：" + (error instanceof Error ? error.message : String(error)), "error");
      throw error;
    }
  }

  return {
    aiSettingsMessage,
    isAiSettingsSaving,
    newAiProviderName,
    showAiModelModal,
    editingAiModel,
    aiModelFormData,
    aiSettingsForm,
    editingProviderId,
    showApiKey,
    revealedApiKeyProviderIds,
    revealedApiKeys,
    revealingApiKeyProviderIds,
    testStatus,
    testMessage,
    showDeleteConfirmModal,
    providerIdToDelete,
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
    closeAiModelModal,
    saveAiModelModal,
    removeAiModel,
    saveAiSettings,
    reorderProviders
  };
}

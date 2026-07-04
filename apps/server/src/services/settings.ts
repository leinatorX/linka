import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import { db } from "../db.js";

export type AiApiFormat = "openai" | "anthropic";

export interface AiModelConfig {
  id: string;
  name: string;
  maxTokens: number;
  enabled: boolean;
}

export interface AiProviderConfig {
  id: string;
  name: string;
  apiFormat: AiApiFormat;
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
  temperature: number;
  activeModelId: string;
  models: AiModelConfig[];
}

export interface AiSettings {
  activeProviderId: string;
  providers: AiProviderConfig[];
}

export interface PublicAiProviderConfig extends Omit<AiProviderConfig, "apiKey"> {
  apiKey: string;
  apiKeySet: boolean;
  apiKeyPreview: string;
}

export interface PublicAiSettings {
  activeProviderId: string;
  providers: PublicAiProviderConfig[];
}

export interface ActiveAiConfig {
  provider: AiProviderConfig;
  model: AiModelConfig;
}

type AiSettingsInput = {
  activeProviderId?: unknown;
  providers?: Array<Partial<AiProviderConfig>>;
};

const SETTINGS_KEY = "ai";
const selectSetting = db.prepare("SELECT value FROM settings WHERE key = ?");
const upsertSetting = db.prepare(`
  INSERT INTO settings (key, value, updated_at)
  VALUES (?, ?, ?)
  ON CONFLICT(key) DO UPDATE SET
    value = excluded.value,
    updated_at = excluded.updated_at
`);

const DEFAULT_OPENAI_MODEL = config.openaiModel || "gpt-4.1-mini";

const DEFAULT_AI_SETTINGS: AiSettings = {
  activeProviderId: "openai",
  providers: [
    {
      id: "openai",
      name: "OpenAI",
      apiFormat: "openai",
      baseUrl: config.openaiBaseUrl,
      apiKey: config.openaiApiKey,
      enabled: true,
      temperature: 0.2,
      activeModelId: DEFAULT_OPENAI_MODEL,
      models: [
        {
          id: DEFAULT_OPENAI_MODEL,
          name: DEFAULT_OPENAI_MODEL,
          maxTokens: 900,
          enabled: true
        }
      ]
    },
    {
      id: "anthropic",
      name: "Anthropic",
      apiFormat: "anthropic",
      baseUrl: "https://api.anthropic.com",
      apiKey: "",
      enabled: false,
      temperature: 0.2,
      activeModelId: "claude-sonnet-4-5",
      models: [
        {
          id: "claude-sonnet-4-5",
          name: "claude-sonnet-4-5",
          maxTokens: 1000,
          enabled: true
        }
      ]
    }
  ]
};

function normalizeApiFormat(value: unknown): AiApiFormat {
  return value === "anthropic" ? "anthropic" : "openai";
}

function normalizeNumber(value: unknown, fallback: number, min: number, max: number) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.min(Math.max(numberValue, min), max);
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeId(value: unknown, fallback: string) {
  const text = String(value || "").trim();
  return text || fallback;
}

function normalizeModel(value: Partial<AiModelConfig>, fallbackName: string): AiModelConfig {
  const name = String(value.name || fallbackName).trim() || fallbackName;

  return {
    // 模型内部标识始终用 UUID，不与模型名绑定（模型名只是展示标签，随时可改）
    id: normalizeId(value.id, randomUUID()),
    name,
    maxTokens: normalizeNumber(value.maxTokens, 1000, 64, 2000000),
    enabled: normalizeBoolean(value.enabled, true)
  };
}

function normalizeProvider(value: Partial<AiProviderConfig>, fallback?: AiProviderConfig): AiProviderConfig {
  const apiFormat = normalizeApiFormat(value.apiFormat ?? fallback?.apiFormat);
  const fallbackBaseUrl = fallback?.baseUrl ?? "";
  const fallbackName = fallback?.name ?? "";
  const rawModels = Array.isArray(value.models) && value.models.length ? value.models : fallback?.models;
  // 模型名兜底：用 fallback 里第一个模型名，实在没有就用空字符串
  const fallbackModelName = fallback?.models?.[0]?.name ?? "";
  const models = (rawModels?.length ? rawModels : [{ name: fallbackModelName }])
    .map((model) => normalizeModel(model, fallbackModelName));
  const activeModelExists = models.some((model) => model.id === value.activeModelId);
  const activeModelId = activeModelExists ? String(value.activeModelId) : models.find((model) => model.enabled)?.id ?? models[0].id;

  return {
    id: normalizeId(value.id, fallback?.id ?? randomUUID()),
    name: String(value.name || fallback?.name || fallbackName).trim(),
    apiFormat,
    baseUrl: String(value.baseUrl || fallback?.baseUrl || fallbackBaseUrl).trim().replace(/\/$/, ""),
    apiKey: String(value.apiKey ?? fallback?.apiKey ?? "").trim(),
    enabled: normalizeBoolean(value.enabled, fallback?.enabled ?? true),
    temperature: normalizeNumber(value.temperature, fallback?.temperature ?? 0.2, 0, 2),
    activeModelId,
    models
  };
}

function migrateLegacySettings(value: Record<string, unknown>): AiSettings | null {
  if (!("provider" in value) && !("model" in value)) {
    return null;
  }

  const apiFormat = normalizeApiFormat(value.provider);
  const fallbackModelName = apiFormat === "anthropic" ? "claude-sonnet-4-5" : DEFAULT_OPENAI_MODEL;
  const modelName = String(value.model || fallbackModelName);
  // 旧版迁移：不再把 apiFormat 当作供应商 id 持久化（防止 MiniMax/DeepSeek 等第三方供应商的 id 被固定为 "anthropic"/"openai"）
  // normalizeProvider / normalizeModel 会自动生成 UUID 作为 id
  const provider = normalizeProvider({
    apiFormat,
    name: apiFormat === "anthropic" ? "Anthropic" : "OpenAI",
    baseUrl: String(value.baseUrl || ""),
    apiKey: String(value.apiKey || ""),
    enabled: true,
    temperature: Number(value.temperature ?? 0.2),
    activeModelId: modelName,
    models: [
      {
        id: "", // normalizeModel 会替换为 UUID
        name: modelName,
        maxTokens: Number(value.maxTokens ?? 1000),
        enabled: true
      }
    ]
  });

  return {
    activeProviderId: provider.id,
    providers: [provider]
  };
}

function normalizeSettings(value: AiSettingsInput): AiSettings {
  const fallbackById = new Map(DEFAULT_AI_SETTINGS.providers.map((provider) => [provider.id, provider]));
  const rawProviders = Array.isArray(value.providers) && value.providers.length ? value.providers : DEFAULT_AI_SETTINGS.providers;
  const providers = rawProviders.map((provider) => normalizeProvider(provider, fallbackById.get(String(provider.id))));
  const activeProviderExists = providers.some((provider) => provider.id === value.activeProviderId);

  return {
    activeProviderId: activeProviderExists ? String(value.activeProviderId) : providers.find((provider) => provider.enabled)?.id ?? providers[0].id,
    providers
  };
}

function maskApiKey(apiKey: string) {
  if (!apiKey) {
    return "";
  }

  if (apiKey.length <= 8) {
    return "********";
  }

  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}

function mergeApiKeys(next: AiSettings, current: AiSettings): AiSettings {
  const currentProviders = new Map(current.providers.map((provider) => [provider.id, provider]));

  return {
    activeProviderId: next.activeProviderId,
    providers: next.providers.map((provider) => {
      const currentProvider = currentProviders.get(provider.id);
      return {
        ...provider,
        apiKey: provider.apiKey || currentProvider?.apiKey || ""
      };
    })
  };
}

export function getAiSettings(): AiSettings {
  const row = selectSetting.get(SETTINGS_KEY) as { value: string } | undefined;

  if (!row) {
    return normalizeSettings(DEFAULT_AI_SETTINGS);
  }

  try {
    const parsed = JSON.parse(row.value) as Partial<AiSettings> & Record<string, unknown>;
    const legacy = migrateLegacySettings(parsed);
    return normalizeSettings(legacy ?? parsed);
  } catch {
    return normalizeSettings(DEFAULT_AI_SETTINGS);
  }
}

export function getPublicAiSettings(): PublicAiSettings {
  const settings = getAiSettings();
  return {
    activeProviderId: settings.activeProviderId,
    providers: settings.providers.map((provider) => ({
      ...provider,
      apiKey: "",
      apiKeySet: Boolean(provider.apiKey),
      apiKeyPreview: maskApiKey(provider.apiKey)
    }))
  };
}

export function saveAiSettings(value: AiSettingsInput): PublicAiSettings {
  const current = getAiSettings();
  const next = mergeApiKeys(normalizeSettings(value), current);

  upsertSetting.run(SETTINGS_KEY, JSON.stringify(next), new Date().toISOString());
  return getPublicAiSettings();
}

// 按 orderedIds 调整供应商的数组顺序，并保持所有 provider 字段不变。
// 缺失或重复的 id 会被忽略，剩余供应商按末尾补齐，保证不丢数据。
export function reorderAiProviders(orderedIds: string[]): PublicAiSettings {
  const current = getAiSettings();
  const known = new Set(current.providers.map((provider) => provider.id));
  const headIds = orderedIds.filter((id, index) => known.has(id) && orderedIds.indexOf(id) === index);
  const byId = new Map(current.providers.map((provider) => [provider.id, provider]));
  const reordered: AiProviderConfig[] = [
    ...headIds.map((id) => byId.get(id)).filter((p): p is AiProviderConfig => Boolean(p)),
    ...current.providers.filter((provider) => !headIds.includes(provider.id))
  ];
  return saveAiSettings({
    activeProviderId: current.activeProviderId,
    providers: reordered
  });
}

export function getActiveAiConfig(modelName?: string): ActiveAiConfig {
  const settings = getAiSettings();
  const providerByModel = modelName
    ? settings.providers.find((item) => item.enabled && item.apiKey && item.baseUrl && item.models.some((model) => model.enabled && (model.name === modelName || model.id === modelName)))
    : undefined;
  if (providerByModel) {
    const model = providerByModel.models.find((item) => item.enabled && (item.name === modelName || item.id === modelName));
    if (model) {
      return { provider: providerByModel, model };
    }
  }

  const provider = settings.providers.find((item) => item.enabled && item.apiKey && item.baseUrl);

  if (!provider) {
    throw new Error("AI 配置不完整");
  }

  const model = provider.models.find((item) => item.id === provider.activeModelId && item.enabled);

  if (!model?.name) {
    throw new Error("AI 模型配置不完整");
  }

  return { provider, model };
}

export function getProviderApiKey(providerId: string): string | undefined {
  const settings = getAiSettings();
  const provider = settings.providers.find((item) => item.id === providerId);
  return provider?.apiKey && provider.apiKey.length > 0 ? provider.apiKey : undefined;
}

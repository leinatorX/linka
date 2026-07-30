import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { config } from "../config.js";
import { generateAssistantConversationTitle, generateAssistantReply, generateAssistantToolResultReply, planAssistantToolCall, streamAssistantReply, testAiConnection, streamGenericChat } from "../services/ai.js";
import type { AssistantAttachment } from "../services/ai.js";
import { addAssistantMessage, buildConversationContext, createAssistantConversation, deleteAssistantConversations, ensureAssistantConversation, getAssistantConversation, listAssistantConversations, updateAssistantConversationAutoTitle, updateAssistantConversationTitle } from "../services/assistant.js";
import { executeAssistantToolPlan, inferAssistantToolPlan, getAssistantNativeOpenAiTools, getAssistantNativeAnthropicTools } from "../services/assistantTools.js";
import { clearSessionCookie, getSessionFromRequest, login, logout, requireAuth, updateAvatar, updateCredentials, verifyUserPassword } from "../services/auth.js";
import { createBookmark, deleteBookmark, getBookmarkById, listBookmarks, updateBookmark } from "../services/bookmarks.js";
import { createCategory, deleteCategory, listCategories, reorderCategories, updateCategory } from "../services/categories.js";
import { getPublicAiSettings, getProviderApiKey, getActiveAiConfig, reorderAiProviders, saveAiSettings } from "../services/settings.js";
import { getPublicWeatherSettings, saveWeatherSettings, fetchCurrentWeather } from "../services/weather.js";
import { getPublicSearchSettings, isSearchEnabled, saveSearchSettings } from "../services/webSearch.js";
import {
  createVaultItem, deleteVaultItem, getVaultItemDetail, getVaultKeyFromToken, getVaultStatus, listVaultItems, lockVault, resetVault, setupVaultMasterPassword, unlockVault, updateVaultItem
} from "../services/vault.js";
import {
  createAgentRule, deleteAgentRule, getAgentRule, getExportFilename, listAgentRules, updateAgentRule
} from "../services/agentRules.js";
import { isValidUrl } from "../utils/url.js";


// 将 Zod 格式 schema 转换为 Fastify 原生 JSON Schema，保证 Swagger 能渲染出请求参数模型
export function zodToJSON(schema: any): any {
  if (!schema) return {};
  if (schema instanceof z.ZodObject) {
    const properties: any = {};
    const required: string[] = [];
    for (const [key, value] of Object.entries(schema.shape)) {
      properties[key] = zodToJSON(value);
      if (!(value instanceof z.ZodOptional)) {
        required.push(key);
      }
    }
    return {
      type: "object",
      properties,
      ...(required.length > 0 ? { required } : {})
    };
  }
  if (schema instanceof z.ZodOptional) {
    return zodToJSON(schema.unwrap());
  }
  if (schema instanceof z.ZodArray) {
    return {
      type: "array",
      items: zodToJSON(schema.element)
    };
  }
  if (schema instanceof z.ZodEnum) {
    return {
      type: "string",
      enum: schema.options
    };
  }
  if (schema instanceof z.ZodString) {
    return { type: "string" };
  }
  if (schema instanceof z.ZodNumber) {
    return { type: "number" };
  }
  if (schema instanceof z.ZodBoolean) {
    return { type: "boolean" };
  }
  return { type: "string" };
}

export const createBookmarkSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  category: z.string().optional(),
  faviconUrl: z.string().optional(),
  showOnHome: z.boolean().optional(),
  source: z.string().optional()
});

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(80),
  password: z.string().min(1).max(200),
  rememberSession: z.boolean().optional()
});

export const updateCredentialsSchema = z.object({
  username: z.string().trim().min(3).max(80),
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8).max(200).optional()
});

export const updateAvatarSchema = z.object({
  avatarUrl: z.string().max(1500000)
});

export const assistantMaxAttachmentSize = 20 * 1024 * 1024;
export const assistantMaxAttachmentDataUrlSize = 30 * 1024 * 1024;

export const assistantAttachmentSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(240),
  mimeType: z.string().max(120),
  size: z.number().int().min(0).max(assistantMaxAttachmentSize),
  dataUrl: z.string().min(1).max(assistantMaxAttachmentDataUrlSize),
  kind: z.enum(["image", "video", "file"])
});

export const assistantSchema = z.object({
  message: z.string().min(1),
  activeCategory: z.string().optional(),
  attachments: z.array(assistantAttachmentSchema).max(6).optional()
});

export const assistantStreamSchema = z.object({
  conversationId: z.string().optional(),
  message: z.string().min(1),
  activeCategory: z.string().optional(),
  attachments: z.array(assistantAttachmentSchema).max(6).optional(),
  model: z.string().optional(),
  effort: z.enum(["关闭", "默认", "低", "中", "高", "最大"]).optional()
});

export const deleteConversationsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1)
});

export const updateConversationTitleSchema = z.object({
  title: z.string().trim().min(1).max(80)
});

export const categorySchema = z.object({
  name: z.string().trim().min(1).max(32)
});

export const reorderCategoriesSchema = z.object({
  orderedIds: z.array(z.string().trim().min(1)).max(500)
});

export const reorderAiProvidersSchema = z.object({
  orderedIds: z.array(z.string().trim().min(1)).max(100)
});

export const aiModelSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1).max(120),
  maxTokens: z.number().int().min(64).max(2000000),
  enabled: z.boolean(),
  supportsVision: z.boolean().optional()
});

export const aiProviderSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1).max(80),
  apiFormat: z.enum(["openai", "anthropic"]),
  baseUrl: z.string().trim().url(),
  apiKey: z.string().optional(),
  enabled: z.boolean(),
  temperature: z.number().min(0).max(2),
  activeModelId: z.string().trim().min(1),
  models: z.array(aiModelSchema).min(1)
});

export const aiSettingsSchema = z.object({
  aiLanguage: z.string().trim().min(1),
  activeProviderId: z.string().trim().min(1),
  providers: z.array(aiProviderSchema).min(1)
});

export const testAiConnectionSchema = z.object({
  provider: z.object({
    id: z.string().trim().min(1),
    name: z.string().trim().min(1),
    apiFormat: z.enum(["openai", "anthropic"]),
    baseUrl: z.string().trim().url(),
    apiKey: z.string().optional(),
    temperature: z.number().min(0).max(2)
  }),
  model: z.object({
    id: z.string().trim().min(1),
    name: z.string().trim().min(1),
    maxTokens: z.number().int().min(64)
  })
});

export async function requireApiToken(request: FastifyRequest, reply: FastifyReply) {
  if (!config.apiToken) {
    return;
  }

  if (getSessionFromRequest(request)) {
    return;
  }

  const auth = request.headers.authorization ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");

  if (token !== config.apiToken) {
    await reply.code(401).send({ message: "缺少有效的 API Token" });
  }
}

export function hasValidApiToken(request: FastifyRequest) {
  if (!config.apiToken) {
    return false;
  }
  const auth = request.headers.authorization ?? "";
  return auth.replace(/^Bearer\s+/i, "") === config.apiToken;
}

export function writeSse(raw: FastifyReply["raw"], event: string, data: unknown) {
  raw.write(`event: ${event}\n`);
  raw.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function assistantModelUnavailableMessage() {
  return "AI 助手暂时不可用，请先在设置里配置可用模型。";
}

export function assistantMultimodalUnavailableMessage() {
  return "图片/视频理解调用失败。请确认当前模型支持多模态输入，或切换到 MiniMax-M3、GPT-4o、Claude 等支持图片理解的模型后重试。";
}

export function assistantWebContextFallbackMessage(webContext: string) {
  return [
    "搜索已完成，但当前 AI 模型在整理搜索结果时失败。先把原始搜索结果给你：",
    "",
    webContext
  ].join("\n");
}

export function assistantErrorMessage(error: unknown, hasAttachments = false) {
  const message = error instanceof Error ? error.message : "";

  if (error instanceof Error && error.message.startsWith("当前模型")) {
    return error.message;
  }

  if (/AI (配置|模型)不完整/.test(message)) {
    return assistantModelUnavailableMessage();
  }

  if (hasAttachments && /new_sensitive|image is sensitive|content.*sensitive|内容安全|安全策略|\(1026\)|1026/i.test(message)) {
    return "这张图片被当前模型服务的内容安全策略拦截了，所以没有进入视觉理解流程。请换一张图片，或改用安全策略不同的视觉模型后重试。";
  }

  if (/new_sensitive|content.*sensitive|内容安全|安全策略|\(1026\)|1026/i.test(message)) {
    return "这次输入被当前 AI 模型服务的内容安全策略拦截了。可以换一个模型，或调整搜索词后重试。";
  }

  if (hasAttachments && /support image input|image input|vision|图片|图像/i.test(message)) {
    return `当前模型或接口端点不支持图片输入：${message}`;
  }

  if (/AI 服务返回|fetch failed|network|timeout|ETIMEDOUT|ECONN|socket|TLS|aborted/i.test(message)) {
    return `AI 服务调用失败：${message}`;
  }

  return hasAttachments ? assistantMultimodalUnavailableMessage() : assistantModelUnavailableMessage();
}

export function isConfirmationOnly(message: string) {
  return /^(确认执行|确认删除|确认操作|确定删除|确定执行)[\s。！!]*$/.test(message.trim());
}

export function isExplicitLocalAssistantSearch(message: string) {
  return /(书签|收藏|收藏夹|分类|Linka|本地|已保存|已收录)/i.test(message);
}

export function extractWebSearchFallbackQuery(message: string, toolPlan: Awaited<ReturnType<typeof planAssistantToolCall>> | ReturnType<typeof inferAssistantToolPlan>) {
  if (!toolPlan || toolPlan.tool !== "list_bookmarks" || !isSearchEnabled() || isExplicitLocalAssistantSearch(message)) {
    return "";
  }

  const args = toolPlan.arguments ?? {};
  const query = typeof args.q === "string" && args.q.trim()
    ? args.q.trim()
    : typeof args.query === "string" && args.query.trim()
      ? args.query.trim()
      : message.trim();

  return query;
}

export function toAssistantBookmarkHint(bookmark: ReturnType<typeof listBookmarks>[number]) {
  return {
    id: bookmark.id,
    title: bookmark.title,
    category: bookmark.category,
    summary: bookmark.summary,
    description: bookmark.description,
    url: bookmark.url,
    domain: bookmark.domain
  };
}

export function findAssistantBookmarkCandidates(message: string) {
  const directMatches = listBookmarks({ q: message }).slice(0, 8);
  const byId = new Map(directMatches.map((bookmark) => [bookmark.id, bookmark]));
  const normalizedMessage = message.toLowerCase();

  for (const bookmark of listBookmarks({ archived: false })) {
    if (byId.has(bookmark.id)) {
      continue;
    }

    const searchableValues = [
      bookmark.title,
      bookmark.domain,
      bookmark.category,
      bookmark.url,
      bookmark.summary,
      bookmark.description
    ].map((value) => value.trim().toLowerCase()).filter((value) => value.length >= 2);

    if (searchableValues.some((value) => normalizedMessage.includes(value))) {
      byId.set(bookmark.id, bookmark);
    }

    if (byId.size >= 8) {
      break;
    }
  }

  return [...byId.values()];
}

export async function renderAssistantToolMessage(message: string, toolResult: Awaited<ReturnType<typeof executeAssistantToolPlan>>) {
  if (!toolResult) {
    return "";
  }

  if (toolResult.type === "message" || toolResult.changed === false) {
    return toolResult.message;
  }

  try {
    return await generateAssistantToolResultReply({
      message,
      resultMessage: toolResult.message,
      type: toolResult.type,
      changed: toolResult.changed,
      categoriesChanged: toolResult.categoriesChanged
    });
  } catch {
    return toolResult.message;
  }
}

export async function maybeExecuteWebSearchFallback(message: string, toolPlan: Awaited<ReturnType<typeof planAssistantToolCall>> | ReturnType<typeof inferAssistantToolPlan>, toolResult: Awaited<ReturnType<typeof executeAssistantToolPlan>>) {
  const query = toolResult?.type === "search_results" && !toolResult.results?.length
    ? extractWebSearchFallbackQuery(message, toolPlan)
    : "";

  if (!query) {
    return null;
  }

  return executeAssistantToolPlan({
    tool: "web_search",
    arguments: { query },
    confidence: 1,
    requiresConfirmation: false,
    reason: "本地书签搜索无结果，自动改为联网搜索。"
  }, message);
}
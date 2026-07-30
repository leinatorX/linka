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
import crypto from "crypto";
import * as shared from "./shared.js";


export async function settingsRoutes(app: FastifyInstance) {
  app.get("/api/settings/ai", {
    schema: {
      description: "获取 AI 接口配置（接口密钥已脱敏）",
      tags: ["AI 设置"]
    }
  }, async () => ({
    settings: getPublicAiSettings()
  }));

  app.post("/api/settings/ai/reveal", {
    schema: {
      description: "获取指定 AI 服务商已保存的明文 API Key",
      tags: ["AI 设置"],
      body: {
        type: "object",
        required: ["providerId"],
        properties: {
          providerId: { type: "string", description: "服务商 ID" }
        }
      }
    }
  }, async (request, reply) => {
    const body = (request.body ?? {}) as { providerId?: string };
    const providerId = typeof body.providerId === "string" ? body.providerId.trim() : "";
    if (!providerId) {
      return reply.code(400).send({ message: "缺少供应商 ID" });
    }

    const apiKey = getProviderApiKey(providerId);
    if (!apiKey) {
      return reply.code(404).send({ message: "该供应商尚未配置 API Key" });
    }

    return { providerId, apiKey };
  });

  app.put("/api/settings/ai", {
    schema: {
      description: "保存/覆写 AI 服务商与模型参数配置",
      tags: ["AI 设置"],
      body: shared.zodToJSON(shared.aiSettingsSchema)
    }
  }, async (request, reply) => {
    const payload = shared.aiSettingsSchema.safeParse(request.body);
    if (!payload.success) {
      return reply.code(400).send({ message: "请输入有效的 AI 配置" });
    }

    const settings = saveAiSettings(payload.data);

    return { settings };
  });

  app.post("/api/settings/ai/reorder", {
    schema: {
      description: "对 AI 供应商列表的渲染顺序进行批量排列",
      tags: ["AI 设置"],
      body: shared.zodToJSON(shared.reorderAiProvidersSchema)
    }
  }, async (request, reply) => {
    const payload = shared.reorderAiProvidersSchema.safeParse(request.body);
    if (!payload.success) {
      return reply.code(400).send({ message: "排序参数无效" });
    }
    const settings = reorderAiProviders(payload.data.orderedIds);
    return { settings };
  });

  app.get("/api/settings/search", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    return { settings: getPublicSearchSettings() };
  });

  app.put("/api/settings/search", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    
    const payload = z.object({
      enabled: z.boolean().optional(),
      engine: z.enum(["tavily", "brave", "searxng"]).optional(),
      apiKey: z.string().optional(),
      baseUrl: z.string().optional(),
      maxResults: z.number().optional()
    }).safeParse(request.body);

    if (!payload.success) {
      return reply.code(400).send({ message: "参数格式错误" });
    }
    const settings = saveSearchSettings(payload.data);
    return { settings };
  });

  app.get("/api/settings/weather", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    return { settings: getPublicWeatherSettings() };
  });

  app.put("/api/settings/weather", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    
    const payload = z.object({
      enabled: z.boolean().optional(),
      apiKey: z.string().optional(),
      location: z.string().optional(),
      showDate: z.boolean().optional(),
      dateFormat: z.string().optional()
    }).safeParse(request.body);

    if (!payload.success) {
      return reply.code(400).send({ message: "参数格式错误" });
    }
    const settings = saveWeatherSettings(payload.data);
    return { settings };
  });

  app.get("/api/weather", async () => {
    return await fetchCurrentWeather();
  });

  app.post("/api/settings/ai/test", {
    schema: {
      description: "测试大模型及服务商接口连通性",
      tags: ["AI 设置"],
      body: shared.zodToJSON(shared.testAiConnectionSchema)
    }
  }, async (request, reply) => {
    const payload = shared.testAiConnectionSchema.safeParse(request.body);
    if (!payload.success) {
      return reply.code(400).send({ message: "请输入有效的测试配置" });
    }

    const incomingKey = payload.data.provider.apiKey?.trim();
    const resolvedKey = incomingKey && incomingKey.length > 0
      ? incomingKey
      : getProviderApiKey(payload.data.provider.id) ?? "";

    if (!resolvedKey) {
      return reply.code(400).send({
        success: false,
        message: "请先填写或保存 API Key 再进行测试"
      });
    }

    try {
      const response = await testAiConnection(
        { ...payload.data.provider, apiKey: resolvedKey },
        payload.data.model
      );
      return { success: true, response };
    } catch (error) {
      return reply.code(502).send({
        success: false,
        message: error instanceof Error ? error.message : "连接失败"
      });
    }
  });

}

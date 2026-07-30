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


export async function vaultRoutes(app: FastifyInstance) {
  app.get("/api/vault/status", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const vaultToken = request.headers["x-vault-token"] as string | undefined;
    return getVaultStatus(vaultToken);
  });

  app.post("/api/vault/setup", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const body = z.object({
      masterPassword: z.string().min(6).max(200)
    }).safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ message: "主密码长度至少为 6 位" });
    }
    try {
      const res = setupVaultMasterPassword(body.data.masterPassword);
      return res;
    } catch (err: any) {
      return reply.code(400).send({ message: err.message || "初始化保险箱失败" });
    }
  });

  app.post("/api/vault/unlock", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const body = z.object({
      masterPassword: z.string().min(1)
    }).safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ message: "请输入主密码" });
    }
    try {
      const res = unlockVault(body.data.masterPassword);
      return res;
    } catch (err: any) {
      return reply.code(401).send({ message: "主密码错误，解锁失败" });
    }
  });

  app.post("/api/vault/lock", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const vaultToken = request.headers["x-vault-token"] as string | undefined;
    lockVault(vaultToken);
    return reply.send({ success: true });
  });

  app.post("/api/vault/reset", async (request, reply) => {
    const user = requireAuth(request, reply);
    if (!user) return;
    const body = (request.body ?? {}) as { password?: string };
    if (!body.password || !verifyUserPassword(user.id, body.password)) {
      return reply.code(401).send({ message: "登录密码不正确，重置失败" });
    }
    resetVault();
    return reply.send({ success: true });
  });

  app.get("/api/vault/items", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const vaultToken = request.headers["x-vault-token"] as string | undefined;
    const vaultKey = getVaultKeyFromToken(vaultToken);
    if (!vaultKey) {
      return reply.code(401).send({ message: "保险箱已锁定，请先解锁" });
    }
    const query = request.query as { search?: string; category?: string };
    const items = listVaultItems(vaultKey, query.search, query.category);
    return { items };
  });

  app.get("/api/vault/items/:id", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const vaultToken = request.headers["x-vault-token"] as string | undefined;
    const vaultKey = getVaultKeyFromToken(vaultToken);
    if (!vaultKey) {
      return reply.code(401).send({ message: "保险箱已锁定，请先解锁" });
    }
    const { id } = request.params as { id: string };
    try {
      const item = getVaultItemDetail(id, vaultKey);
      return { item };
    } catch (err: any) {
      return reply.code(404).send({ message: err.message || "找不到该凭据" });
    }
  });

  app.post("/api/vault/items", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const vaultToken = request.headers["x-vault-token"] as string | undefined;
    const vaultKey = getVaultKeyFromToken(vaultToken);
    if (!vaultKey) {
      return reply.code(401).send({ message: "保险箱已锁定，请先解锁" });
    }
    const bodySchema = z.object({
      category: z.string().optional(),
      serviceName: z.string().min(1),
      title: z.string().min(1),
      credentialType: z.enum(["api_key", "secret_pair", "user_password", "custom"]),
      iconUrl: z.string().optional(),
      tags: z.array(z.string()).optional(),
      payload: z.object({
        apiKey: z.string().optional(),
        secretId: z.string().optional(),
        secretKey: z.string().optional(),
        username: z.string().optional(),
        password: z.string().optional(),
        websiteUrl: z.string().optional(),
        customFields: z.array(z.object({ key: z.string(), value: z.string(), type: z.enum(["text", "password"]).optional() })).optional(),
        notes: z.string().optional()
      })
    });
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: "表单字段不合法" });
    }
    try {
      const item = createVaultItem(parsed.data, vaultKey);
      return { item };
    } catch (err: any) {
      return reply.code(400).send({ message: err.message || "保存凭据失败" });
    }
  });

  app.put("/api/vault/items/:id", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const vaultToken = request.headers["x-vault-token"] as string | undefined;
    const vaultKey = getVaultKeyFromToken(vaultToken);
    if (!vaultKey) {
      return reply.code(401).send({ message: "保险箱已锁定，请先解锁" });
    }
    const { id } = request.params as { id: string };
    const bodySchema = z.object({
      category: z.string().optional(),
      serviceName: z.string().optional(),
      title: z.string().optional(),
      credentialType: z.enum(["api_key", "secret_pair", "user_password", "custom"]).optional(),
      iconUrl: z.string().optional(),
      tags: z.array(z.string()).optional(),
      payload: z.object({
        apiKey: z.string().optional(),
        secretId: z.string().optional(),
        secretKey: z.string().optional(),
        username: z.string().optional(),
        password: z.string().optional(),
        websiteUrl: z.string().optional(),
        customFields: z.array(z.object({ key: z.string(), value: z.string(), type: z.enum(["text", "password"]).optional() })).optional(),
        notes: z.string().optional()
      }).optional()
    });
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: "表单字段不合法" });
    }
    try {
      const item = updateVaultItem(id, parsed.data, vaultKey);
      return { item };
    } catch (err: any) {
      return reply.code(400).send({ message: err.message || "更新凭据失败" });
    }
  });

  app.delete("/api/vault/items/:id", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const vaultToken = request.headers["x-vault-token"] as string | undefined;
    const vaultKey = getVaultKeyFromToken(vaultToken);
    if (!vaultKey) {
      return reply.code(401).send({ message: "保险箱已锁定，请先解锁" });
    }
    const { id } = request.params as { id: string };
    const success = deleteVaultItem(id);
    return { success };
  });

  // Agent Rules Hub Routes
}

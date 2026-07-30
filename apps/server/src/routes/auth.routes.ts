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


export async function authRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    const path = request.url.split("?")[0] ?? request.url;
    const isPublicApi = path === "/api/health"
      || path === "/api/auth/login"
      || path === "/api/auth/logout"
      || path === "/api/auth/me";
    if (!path.startsWith("/api/") || isPublicApi) {
      return;
    }

    if (shared.hasValidApiToken(request)) {
      return;
    }

    if (!requireAuth(request, reply)) {
      return reply;
    }
  });

  app.get("/api/health", {
    schema: {
      description: "健康检查，获取当前服务状态、系统时间等",
      tags: ["系统"]
    }
  }, async () => ({
    status: "ok",
    name: "Linka",
    time: new Date().toISOString()
  }));

  app.post("/api/auth/login", {
    schema: {
      description: "使用本地账号密码登录 Linka",
      tags: ["用户"],
      body: shared.zodToJSON(shared.loginSchema)
    }
  }, async (request, reply) => {
    const payload = shared.loginSchema.safeParse(request.body);
    if (!payload.success) {
      return reply.code(400).send({ message: "请输入用户名和密码" });
    }

    const result = login(payload.data.username, payload.data.password, payload.data.rememberSession ?? true);
    if (!result) {
      return reply.code(401).send({ message: "用户名或密码错误" });
    }

    reply.header("Set-Cookie", result.cookie);
    return { user: result.user };
  });

  app.post("/api/auth/logout", {
    schema: {
      description: "退出当前登录会话",
      tags: ["用户"]
    }
  }, async (request, reply) => {
    logout(request);
    reply.header("Set-Cookie", clearSessionCookie());
    return { status: "ok" };
  });

  app.get("/api/auth/me", {
    schema: {
      description: "获取当前登录状态",
      tags: ["用户"]
    }
  }, async (request) => {
    const session = getSessionFromRequest(request);
    return {
      authenticated: Boolean(session),
      user: session?.user ?? null
    };
  });

  app.put("/api/auth/profile", {
    schema: {
      description: "修改当前本地账号的用户名或密码",
      tags: ["用户"],
      body: shared.zodToJSON(shared.updateCredentialsSchema)
    }
  }, async (request, reply) => {
    const user = requireAuth(request, reply);
    if (!user) {
      return;
    }

    const payload = shared.updateCredentialsSchema.safeParse(request.body);
    if (!payload.success) {
      return reply.code(400).send({ message: "请输入有效的账号信息" });
    }

    const result = updateCredentials(user.id, {
      username: payload.data.username,
      currentPassword: payload.data.currentPassword,
      newPassword: payload.data.newPassword?.trim() || undefined
    });

    if (result.status === "invalid_password") {
      return reply.code(400).send({ message: "当前密码不正确" });
    }
    if (result.status === "not_found") {
      return reply.code(404).send({ message: "用户不存在" });
    }

    return { user: result.user };
  });

  app.put("/api/auth/avatar", {
    bodyLimit: 2 * 1024 * 1024,
    schema: {
      description: "单独修改当前本地账号头像",
      tags: ["用户"],
      body: shared.zodToJSON(shared.updateAvatarSchema)
    }
  }, async (request, reply) => {
    const user = requireAuth(request, reply);
    if (!user) {
      return;
    }

    const payload = shared.updateAvatarSchema.safeParse(request.body);
    if (!payload.success) {
      return reply.code(400).send({ message: "请输入有效的头像数据" });
    }

    const updated = updateAvatar(user.id, payload.data.avatarUrl);
    if (!updated) {
      return reply.code(404).send({ message: "用户不存在" });
    }
    return { user: updated };
  });

  app.post("/api/bookmarks", {
    preHandler: shared.requireApiToken,
    schema: {
      description: "创建书签并由 AI 自动填充元数据和分类，需 Headers 鉴权",
      tags: ["书签"],
      security: [{ apiKeyAuth: [] }],
      body: shared.zodToJSON(shared.createBookmarkSchema)
    }
  }, async (request, reply) => {
    const payload = shared.createBookmarkSchema.safeParse(request.body);
    if (!payload.success || !isValidUrl(payload.data.url)) {
      return reply.code(400).send({ message: "请输入有效的 URL" });
    }

    const result = await createBookmark(payload.data);
    return reply.code(result.status === "exists" ? 200 : 201).send(result);
  });

  // ==========================================
  // 保险箱 (Vault) 关联 API
  // ==========================================
}

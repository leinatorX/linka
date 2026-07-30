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


export async function agentRulesRoutes(app: FastifyInstance) {
  app.get("/api/agent-rules", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const { search, category, ruleType } = request.query as {
      search?: string;
      category?: string;
      ruleType?: string;
    };
    const rules = listAgentRules(search, category, ruleType);
    return { rules };
  });

  app.get("/api/agent-rules/:id", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const { id } = request.params as { id: string };
    try {
      const rule = getAgentRule(id);
      return { rule };
    } catch (err: any) {
      return reply.code(404).send({ message: err.message || "Agent 规则未找到" });
    }
  });

  app.post("/api/agent-rules", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const bodySchema = z.object({
      title: z.string().trim().min(1).max(120),
      ruleType: z.string().optional(),
      category: z.string().optional(),
      description: z.string().optional(),
      content: z.string().default(""),
      tags: z.array(z.string()).optional(),
      isPinned: z.boolean().optional()
    });
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: "表单字段不合法" });
    }
    const rule = createAgentRule(parsed.data);
    return { rule };
  });

  app.put("/api/agent-rules/:id", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const { id } = request.params as { id: string };
    const bodySchema = z.object({
      title: z.string().trim().min(1).max(120).optional(),
      ruleType: z.string().optional(),
      category: z.string().optional(),
      description: z.string().optional(),
      content: z.string().optional(),
      tags: z.array(z.string()).optional(),
      isPinned: z.boolean().optional()
    });
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: "表单字段不合法" });
    }
    try {
      const rule = updateAgentRule(id, parsed.data);
      return { rule };
    } catch (err: any) {
      return reply.code(400).send({ message: err.message || "更新规则失败" });
    }
  });

  app.delete("/api/agent-rules/:id", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const { id } = request.params as { id: string };
    const success = deleteAgentRule(id);
    return { success };
  });

  app.get("/api/agent-rules/:id/download", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const { id } = request.params as { id: string };
    try {
      const rule = getAgentRule(id);
      const filename = getExportFilename(rule);
      reply.header("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
      reply.header("Content-Type", "text/markdown; charset=utf-8");
      return reply.send(rule.content);
    } catch (err: any) {
      return reply.code(404).send({ message: err.message || "规则不存在" });
    }
  });

}

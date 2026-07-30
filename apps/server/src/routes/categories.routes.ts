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


export async function categoriesRoutes(app: FastifyInstance) {
  app.get("/api/categories", {
    schema: {
      description: "获取所有书签分类列表",
      tags: ["分类"]
    }
  }, async () => ({
    categories: listCategories()
  }));

  app.post("/api/categories", {
    schema: {
      description: "创建新的分类",
      tags: ["分类"],
      body: shared.zodToJSON(shared.categorySchema)
    }
  }, async (request, reply) => {
    const payload = shared.categorySchema.safeParse(request.body);
    if (!payload.success) {
      return reply.code(400).send({ message: "请输入有效的分类名称" });
    }

    try {
      return reply.code(201).send({ category: createCategory(payload.data.name) });
    } catch {
      return reply.code(409).send({ message: "分类已存在" });
    }
  });

  app.patch("/api/categories/:id", {
    schema: {
      description: "更新指定分类名称",
      tags: ["分类"],
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string", description: "分类 ID" }
        }
      },
      body: shared.zodToJSON(shared.categorySchema)
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const payload = shared.categorySchema.safeParse(request.body);
    if (!payload.success) {
      return reply.code(400).send({ message: "请输入有效的分类名称" });
    }

    try {
      const category = updateCategory(id, payload.data.name);
      if (!category) {
        return reply.code(404).send({ message: "分类不存在或不可修改" });
      }

      return { category };
    } catch {
      return reply.code(409).send({ message: "分类已存在" });
    }
  });

  app.delete("/api/categories/:id", {
    schema: {
      description: "删除指定分类",
      tags: ["分类"],
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string", description: "分类 ID" }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!deleteCategory(id)) {
      return reply.code(404).send({ message: "分类不存在或不可删除" });
    }

    return { status: "deleted" };
  });

  app.post("/api/categories/reorder", {
    schema: {
      description: "批量重新排列分类顺序",
      tags: ["分类"],
      body: shared.zodToJSON(shared.reorderCategoriesSchema)
    }
  }, async (request, reply) => {
    const payload = shared.reorderCategoriesSchema.safeParse(request.body);
    if (!payload.success) {
      return reply.code(400).send({ message: "排序参数无效" });
    }
    return { categories: reorderCategories(payload.data.orderedIds) };
  });

}

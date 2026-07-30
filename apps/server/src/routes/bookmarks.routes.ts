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


export async function bookmarksRoutes(app: FastifyInstance) {
  app.get("/api/bookmarks", {
    schema: {
      description: "获取书签列表，支持按关键词、分类及归档状态进行查询",
      tags: ["书签"],
      querystring: {
        type: "object",
        properties: {
          q: { type: "string", description: "搜索关键词（标题/摘要/网页原始描述）" },
          category: { type: "string", description: "所属分类名称" },
          home: { type: "string", enum: ["true", "false"], description: "是否只返回首页书签" },
          archived: { type: "string", enum: ["true", "false"], description: "是否已被归档" }
        }
      }
    }
  }, async (request) => {
    const query = request.query as Record<string, string | undefined>;
    return {
      bookmarks: listBookmarks({
        q: query.q,
        category: query.category,
        home: query.home === "true",
        archived: query.archived === undefined ? undefined : query.archived === "true"
      })
    };
  });

  app.patch("/api/bookmarks/:id", {
    schema: {
      description: "部分更新书签信息（如分类、标记置顶/归档等）",
      tags: ["书签"],
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string", description: "书签 ID" }
        }
      },
      body: {
        type: "object",
        properties: {
          title: { type: "string", description: "标题" },
          category: { type: "string", description: "所属分类" },
          summary: { type: "string", description: "摘要" },
          pinned: { type: "boolean", description: "是否置顶" },
          showOnHome: { type: "boolean", description: "是否在首页显示" },
          archived: { type: "boolean", description: "是否归档" }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const bookmark = updateBookmark(id, request.body as Record<string, unknown>);

    if (!bookmark) {
      return reply.code(404).send({ message: "收藏不存在" });
    }

    return { bookmark };
  });

  app.delete("/api/bookmarks/:id", {
    schema: {
      description: "删除指定书签",
      tags: ["书签"],
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string", description: "书签 ID" }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!deleteBookmark(id)) {
      return reply.code(404).send({ message: "收藏不存在" });
    }

    return { status: "deleted" };
  });

  app.get("/api/bookmarks/check", {
    schema: {
      description: "检查某个链接（URL）是否已被收藏",
      tags: ["书签"],
      querystring: {
        type: "object",
        required: ["url"],
        properties: {
          url: { type: "string", description: "待校验的完整 URL 链接" }
        }
      }
    }
  }, async (request) => {
    const query = request.query as Record<string, string | undefined>;
    const found = query.url ? listBookmarks({ archived: true }).find((bookmark) => bookmark.url === query.url || bookmark.normalizedUrl === query.url) : null;

    return {
      exists: Boolean(found),
      bookmark: found ?? null
    };
  });

  app.get("/api/bookmarks/:id", {
    schema: {
      description: "根据 ID 获取单条书签详情",
      tags: ["书签"],
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string", description: "书签 ID" }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const bookmark = getBookmarkById(id);

    if (!bookmark) {
      return reply.code(404).send({ message: "收藏不存在" });
    }

    return { bookmark };
  });

}

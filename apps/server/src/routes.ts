import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { config } from "./config.js";
import { generateAssistantReply, generateAssistantToolResultReply, planAssistantToolCall, streamAssistantReply, testAiConnection } from "./services/ai.js";
import type { AssistantAttachment } from "./services/ai.js";
import { addAssistantMessage, buildConversationContext, createAssistantConversation, deleteAssistantConversations, ensureAssistantConversation, getAssistantConversation, listAssistantConversations } from "./services/assistant.js";
import { executeAssistantToolPlan, inferAssistantToolPlan } from "./services/assistantTools.js";
import { clearSessionCookie, getSessionFromRequest, login, logout, requireAuth, updateAvatar, updateCredentials } from "./services/auth.js";
import { createBookmark, deleteBookmark, getBookmarkById, listBookmarks, updateBookmark } from "./services/bookmarks.js";
import { createCategory, deleteCategory, listCategories, reorderCategories, updateCategory } from "./services/categories.js";
import { getPublicAiSettings, getProviderApiKey, reorderAiProviders, saveAiSettings } from "./services/settings.js";
import { isValidUrl } from "./utils/url.js";

// 将 Zod 格式 schema 转换为 Fastify 原生 JSON Schema，保证 Swagger 能渲染出请求参数模型
function zodToJSON(schema: any): any {
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

const createBookmarkSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  category: z.string().optional(),
  faviconUrl: z.string().optional(),
  showOnHome: z.boolean().optional(),
  source: z.string().optional()
});

const loginSchema = z.object({
  username: z.string().trim().min(1).max(80),
  password: z.string().min(1).max(200),
  rememberSession: z.boolean().optional()
});

const updateCredentialsSchema = z.object({
  username: z.string().trim().min(3).max(80),
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8).max(200).optional()
});

const updateAvatarSchema = z.object({
  avatarUrl: z.string().max(1500000)
});

const assistantMaxAttachmentSize = 20 * 1024 * 1024;
const assistantMaxAttachmentDataUrlSize = 30 * 1024 * 1024;

const assistantAttachmentSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(240),
  mimeType: z.string().max(120),
  size: z.number().int().min(0).max(assistantMaxAttachmentSize),
  dataUrl: z.string().min(1).max(assistantMaxAttachmentDataUrlSize),
  kind: z.enum(["image", "video", "file"])
});

const assistantSchema = z.object({
  message: z.string().min(1),
  activeCategory: z.string().optional(),
  attachments: z.array(assistantAttachmentSchema).max(6).optional()
});

const assistantStreamSchema = z.object({
  conversationId: z.string().optional(),
  message: z.string().min(1),
  activeCategory: z.string().optional(),
  attachments: z.array(assistantAttachmentSchema).max(6).optional(),
  model: z.string().optional(),
  effort: z.enum(["关闭", "默认", "低", "中", "高", "最大"]).optional()
});

const deleteConversationsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1)
});

const categorySchema = z.object({
  name: z.string().trim().min(1).max(32)
});

const reorderCategoriesSchema = z.object({
  orderedIds: z.array(z.string().trim().min(1)).max(500)
});

const reorderAiProvidersSchema = z.object({
  orderedIds: z.array(z.string().trim().min(1)).max(100)
});

const aiModelSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1).max(120),
  maxTokens: z.number().int().min(64).max(2000000),
  enabled: z.boolean(),
  supportsVision: z.boolean().optional()
});

const aiProviderSchema = z.object({
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

const aiSettingsSchema = z.object({
  activeProviderId: z.string().trim().min(1),
  providers: z.array(aiProviderSchema).min(1)
});

const testAiConnectionSchema = z.object({
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

async function requireApiToken(request: FastifyRequest, reply: FastifyReply) {
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

function hasValidApiToken(request: FastifyRequest) {
  if (!config.apiToken) {
    return false;
  }
  const auth = request.headers.authorization ?? "";
  return auth.replace(/^Bearer\s+/i, "") === config.apiToken;
}

function writeSse(raw: FastifyReply["raw"], event: string, data: unknown) {
  raw.write(`event: ${event}\n`);
  raw.write(`data: ${JSON.stringify(data)}\n\n`);
}

function assistantModelUnavailableMessage() {
  return "AI 助手暂时不可用，请先在设置里配置可用模型。";
}

function assistantMultimodalUnavailableMessage() {
  return "图片/视频理解调用失败。请确认当前模型支持多模态输入，或切换到 MiniMax-M3、GPT-4o、Claude 等支持图片理解的模型后重试。";
}

function assistantErrorMessage(error: unknown, hasAttachments = false) {
  const message = error instanceof Error ? error.message : "";

  if (error instanceof Error && error.message.startsWith("当前模型")) {
    return error.message;
  }

  if (hasAttachments && /new_sensitive|image is sensitive|content.*sensitive|内容安全|安全策略|\(1026\)|1026/i.test(message)) {
    return "这张图片被当前模型服务的内容安全策略拦截了，所以没有进入视觉理解流程。请换一张图片，或改用安全策略不同的视觉模型后重试。";
  }

  if (hasAttachments && /support image input|image input|vision|图片|图像/i.test(message)) {
    return `当前模型或接口端点不支持图片输入：${message}`;
  }

  return hasAttachments ? assistantMultimodalUnavailableMessage() : assistantModelUnavailableMessage();
}

function isConfirmationOnly(message: string) {
  return /^(确认执行|确认删除|确认操作|确定删除|确定执行)[\s。！!]*$/.test(message.trim());
}

function toAssistantBookmarkHint(bookmark: ReturnType<typeof listBookmarks>[number]) {
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

function findAssistantBookmarkCandidates(message: string) {
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
      bookmark.url
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

async function renderAssistantToolMessage(message: string, toolResult: Awaited<ReturnType<typeof executeAssistantToolPlan>>) {
  if (!toolResult) {
    return "";
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

export async function registerRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    const path = request.url.split("?")[0] ?? request.url;
    const isPublicApi = path === "/api/health"
      || path === "/api/auth/login"
      || path === "/api/auth/logout"
      || path === "/api/auth/me";
    if (!path.startsWith("/api/") || isPublicApi) {
      return;
    }

    if (hasValidApiToken(request)) {
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
      body: zodToJSON(loginSchema)
    }
  }, async (request, reply) => {
    const payload = loginSchema.safeParse(request.body);
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
      body: zodToJSON(updateCredentialsSchema)
    }
  }, async (request, reply) => {
    const user = requireAuth(request, reply);
    if (!user) {
      return;
    }

    const payload = updateCredentialsSchema.safeParse(request.body);
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
      body: zodToJSON(updateAvatarSchema)
    }
  }, async (request, reply) => {
    const user = requireAuth(request, reply);
    if (!user) {
      return;
    }

    const payload = updateAvatarSchema.safeParse(request.body);
    if (!payload.success) {
      return reply.code(400).send({ message: "请输入有效的头像数据" });
    }

    const updated = updateAvatar(user.id, payload.data.avatarUrl);
    if (!updated) {
      return reply.code(404).send({ message: "用户不存在" });
    }
    return { user: updated };
  });

  app.get("/api/bookmarks", {
    schema: {
      description: "获取书签列表，支持按关键词、分类及归档状态进行查询",
      tags: ["书签"],
      querystring: {
        type: "object",
        properties: {
          q: { type: "string", description: "搜索关键词（标题/描述/内容）" },
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

  app.get("/api/categories", {
    schema: {
      description: "获取所有书签分类列表",
      tags: ["分类"]
    }
  }, async () => ({
    categories: listCategories()
  }));

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
      body: zodToJSON(aiSettingsSchema)
    }
  }, async (request, reply) => {
    const payload = aiSettingsSchema.safeParse(request.body);
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
      body: zodToJSON(reorderAiProvidersSchema)
    }
  }, async (request, reply) => {
    const payload = reorderAiProvidersSchema.safeParse(request.body);
    if (!payload.success) {
      return reply.code(400).send({ message: "排序参数无效" });
    }
    const settings = reorderAiProviders(payload.data.orderedIds);
    return { settings };
  });

  app.post("/api/settings/ai/test", {
    schema: {
      description: "测试大模型及服务商接口连通性",
      tags: ["AI 设置"],
      body: zodToJSON(testAiConnectionSchema)
    }
  }, async (request, reply) => {
    const payload = testAiConnectionSchema.safeParse(request.body);
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

  app.post("/api/categories", {
    schema: {
      description: "创建新的分类",
      tags: ["分类"],
      body: zodToJSON(categorySchema)
    }
  }, async (request, reply) => {
    const payload = categorySchema.safeParse(request.body);
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
      body: zodToJSON(categorySchema)
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const payload = categorySchema.safeParse(request.body);
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
      body: zodToJSON(reorderCategoriesSchema)
    }
  }, async (request, reply) => {
    const payload = reorderCategoriesSchema.safeParse(request.body);
    if (!payload.success) {
      return reply.code(400).send({ message: "排序参数无效" });
    }
    return { categories: reorderCategories(payload.data.orderedIds) };
  });

  app.post("/api/bookmarks", {
    preHandler: requireApiToken,
    schema: {
      description: "创建书签并由 AI 自动填充元数据和分类，需 Headers 鉴权",
      tags: ["书签"],
      security: [{ apiKeyAuth: [] }],
      body: zodToJSON(createBookmarkSchema)
    }
  }, async (request, reply) => {
    const payload = createBookmarkSchema.safeParse(request.body);
    if (!payload.success || !isValidUrl(payload.data.url)) {
      return reply.code(400).send({ message: "请输入有效的 URL" });
    }

    const result = await createBookmark(payload.data);
    return reply.code(result.status === "exists" ? 200 : 201).send(result);
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

  app.get("/api/assistant/conversations", {
    schema: {
      description: "获取大模型助手的历史会话列表",
      tags: ["AI 助手"]
    }
  }, async () => ({
    conversations: listAssistantConversations()
  }));

  app.post("/api/assistant/conversations", {
    schema: {
      description: "新建对话会话",
      tags: ["AI 助手"],
      body: {
        type: "object",
        properties: {
          title: { type: "string", description: "会话标题（非必填）" }
        }
      }
    }
  }, async (request, reply) => {
    const body = request.body as { title?: string } | undefined;
    return reply.code(201).send({
      conversation: createAssistantConversation(body?.title?.trim() || "新对话")
    });
  });

  app.get("/api/assistant/conversations/:id", {
    schema: {
      description: "获取特定对话会话详情及历史聊天记录上下文",
      tags: ["AI 助手"],
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string", description: "会话 ID" }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const conversation = getAssistantConversation(id);

    if (!conversation) {
      return reply.code(404).send({ message: "对话不存在" });
    }

    return conversation;
  });

  app.delete("/api/assistant/conversations/:id", {
    schema: {
      description: "删除单个会话历史",
      tags: ["AI 助手"],
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string", description: "会话 ID" }
        }
      }
    }
  }, async (request) => {
    const { id } = request.params as { id: string };
    return {
      deleted: deleteAssistantConversations([id])
    };
  });

  app.post("/api/assistant/conversations/delete", {
    schema: {
      description: "批量删除指定的对话会话",
      tags: ["AI 助手"],
      body: zodToJSON(deleteConversationsSchema)
    }
  }, async (request, reply) => {
    const payload = deleteConversationsSchema.safeParse(request.body);
    if (!payload.success) {
      return reply.code(400).send({ message: "请选择要删除的历史记录" });
    }

    return {
      deleted: deleteAssistantConversations(payload.data.ids)
    };
  });

  app.post("/api/assistant/chat", {
    schema: {
      description: "发送消息给大模型助手（同步阻塞方式）",
      tags: ["AI 助手"],
      body: zodToJSON(assistantSchema)
    }
  }, async (request, reply) => {
    const payload = assistantSchema.safeParse(request.body);
    if (!payload.success) {
      return reply.code(400).send({ message: "请输入消息内容" });
    }

    const results = findAssistantBookmarkCandidates(payload.data.message);
    const toolContext = { activeCategory: payload.data.activeCategory };
    const toolPlan = inferAssistantToolPlan(payload.data.message, toolContext) ?? await planAssistantToolCall({
      message: payload.data.message,
      categories: listCategories().map((category) => category.name),
      activeCategory: payload.data.activeCategory,
      bookmarkHints: results.map(toAssistantBookmarkHint)
    });
    const toolResult = toolPlan ? await executeAssistantToolPlan(toolPlan, payload.data.message, toolContext) : null;

    if (toolResult) {
      return {
        ...toolResult,
        message: await renderAssistantToolMessage(payload.data.message, toolResult)
      };
    }

    if (isConfirmationOnly(payload.data.message)) {
      return {
        type: "message",
        message: "没有找到可执行的待确认操作。请把要操作的书签或分类名称一起说清楚。"
      };
    }

    try {
      const answer = await generateAssistantReply(payload.data.message, results, payload.data.attachments as AssistantAttachment[] | undefined);
      return {
        type: "message",
        message: answer.message,
        results: results.length ? results : undefined
      };
    } catch (error) {
      request.log.error({ error }, "assistant chat failed");
      return {
        type: "message",
        message: assistantErrorMessage(error, Boolean(payload.data.attachments?.length))
      };
    }
  });

  app.post("/api/assistant/chat/stream", {
    schema: {
      description: "与大模型助手交互（SSE 流式数据传输，支持多轮对话与推理思考流输出）",
      tags: ["AI 助手"],
      body: zodToJSON(assistantStreamSchema)
    }
  }, async (request, reply) => {
    const payload = assistantStreamSchema.safeParse(request.body);
    if (!payload.success) {
      return reply.code(400).send({ message: "请输入消息内容" });
    }

    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });

    const { message, model, effort, conversationId, activeCategory, attachments } = payload.data;
    const conversation = ensureAssistantConversation(conversationId, message);
    const history = buildConversationContext(conversation.id);
    writeSse(reply.raw, "meta", { conversation });
    addAssistantMessage(conversation.id, "user", message, attachments as AssistantAttachment[] | undefined);

    const results = findAssistantBookmarkCandidates(message);
    const toolContext = { activeCategory };
    const toolPlan = inferAssistantToolPlan(message, toolContext) ?? await planAssistantToolCall({
      message,
      categories: listCategories().map((category) => category.name),
      activeCategory,
      history,
      bookmarkHints: results.map(toAssistantBookmarkHint)
    });
    const toolResult = toolPlan ? await executeAssistantToolPlan(toolPlan, message, toolContext) : null;

    if (toolResult) {
      const text = await renderAssistantToolMessage(message, toolResult);
      addAssistantMessage(conversation.id, "assistant", text);
      writeSse(reply.raw, "delta", { text });
      writeSse(reply.raw, "done", { ...toolResult, message: text, conversation });
      reply.raw.end();
      return;
    }

    if (isConfirmationOnly(message)) {
      const text = "没有找到可执行的待确认操作。请把要操作的书签或分类名称一起说清楚。";
      addAssistantMessage(conversation.id, "assistant", text);
      writeSse(reply.raw, "delta", { text });
      writeSse(reply.raw, "done", {
        type: "message",
        message: text,
        conversation
      });
      reply.raw.end();
      return;
    }

    try {
      let fullText = "";
      for await (const chunk of streamAssistantReply({ message, bookmarks: results, history, attachments: attachments as AssistantAttachment[] | undefined, model, effort })) {
        if (chunk.type === "reasoning") {
          writeSse(reply.raw, "reasoning", { text: chunk.text });
          continue;
        }

        fullText += chunk.text;
        writeSse(reply.raw, "delta", { text: chunk.text });
      }

      const finalText = fullText.trim() || "我暂时没有生成有效回复。";
      addAssistantMessage(conversation.id, "assistant", finalText);
      writeSse(reply.raw, "done", {
        type: "message",
        message: finalText,
        results: results.length ? results : undefined,
        conversation
      });
    } catch (error) {
      request.log.error({ error }, "assistant stream failed");
      const text = assistantErrorMessage(error, Boolean(attachments?.length));
      addAssistantMessage(conversation.id, "assistant", text);
      writeSse(reply.raw, "delta", { text });
      writeSse(reply.raw, "done", {
        type: "message",
        message: text,
        conversation
      });
    } finally {
      reply.raw.end();
    }
  });
}

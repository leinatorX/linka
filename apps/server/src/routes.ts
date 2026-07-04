import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { config } from "./config.js";
import { generateAssistantReply, streamAssistantReply, testAiConnection } from "./services/ai.js";
import { addAssistantMessage, buildConversationContext, createAssistantConversation, deleteAssistantConversations, ensureAssistantConversation, getAssistantConversation, listAssistantConversations } from "./services/assistant.js";
import { createBookmark, deleteBookmark, getBookmarkById, listBookmarks, updateBookmark } from "./services/bookmarks.js";
import { createCategory, deleteCategory, listCategories, updateCategory } from "./services/categories.js";
import { getPublicAiSettings, getProviderApiKey, saveAiSettings } from "./services/settings.js";
import { extractFirstUrl, isValidUrl } from "./utils/url.js";

const createBookmarkSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  category: z.string().optional(),
  faviconUrl: z.string().optional(),
  source: z.string().optional()
});

const assistantSchema = z.object({
  message: z.string().min(1)
});

const assistantStreamSchema = z.object({
  conversationId: z.string().optional(),
  message: z.string().min(1),
  model: z.string().optional(),
  effort: z.enum(["关闭", "默认", "低", "中", "高", "最大"]).optional()
});

const deleteConversationsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1)
});

const categorySchema = z.object({
  name: z.string().trim().min(1).max(32)
});

const aiModelSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1).max(120),
  maxTokens: z.number().int().min(64).max(2000000),
  enabled: z.boolean()
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

  const auth = request.headers.authorization ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");

  if (token !== config.apiToken) {
    await reply.code(401).send({ message: "缺少有效的 API Token" });
  }
}

function writeSse(raw: FastifyReply["raw"], event: string, data: unknown) {
  raw.write(`event: ${event}\n`);
  raw.write(`data: ${JSON.stringify(data)}\n\n`);
}

export async function registerRoutes(app: FastifyInstance) {
  app.get("/api/health", async () => ({
    status: "ok",
    name: "Linka",
    time: new Date().toISOString()
  }));

  app.get("/api/bookmarks", async (request) => {
    const query = request.query as Record<string, string | undefined>;
    return {
      bookmarks: listBookmarks({
        q: query.q,
        category: query.category,
        archived: query.archived === undefined ? undefined : query.archived === "true"
      })
    };
  });

  app.get("/api/categories", async () => ({
    categories: listCategories()
  }));

  app.get("/api/settings/ai", async () => ({
    settings: getPublicAiSettings()
  }));

  app.post("/api/settings/ai/reveal", async (request, reply) => {
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

  app.put("/api/settings/ai", async (request, reply) => {
    const payload = aiSettingsSchema.safeParse(request.body);
    if (!payload.success) {
      return reply.code(400).send({ message: "请输入有效的 AI 配置" });
    }

    const settings = saveAiSettings(payload.data);

    return { settings };
  });

  app.post("/api/settings/ai/test", async (request, reply) => {
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

  app.post("/api/categories", async (request, reply) => {
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

  app.patch("/api/categories/:id", async (request, reply) => {
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

  app.delete("/api/categories/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!deleteCategory(id)) {
      return reply.code(404).send({ message: "分类不存在或不可删除" });
    }

    return { status: "deleted" };
  });

  app.post("/api/bookmarks", { preHandler: requireApiToken }, async (request, reply) => {
    const payload = createBookmarkSchema.safeParse(request.body);
    if (!payload.success || !isValidUrl(payload.data.url)) {
      return reply.code(400).send({ message: "请输入有效的 URL" });
    }

    const result = await createBookmark(payload.data);
    return reply.code(result.status === "exists" ? 200 : 201).send(result);
  });

  app.patch("/api/bookmarks/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const bookmark = updateBookmark(id, request.body as Record<string, unknown>);

    if (!bookmark) {
      return reply.code(404).send({ message: "收藏不存在" });
    }

    return { bookmark };
  });

  app.delete("/api/bookmarks/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!deleteBookmark(id)) {
      return reply.code(404).send({ message: "收藏不存在" });
    }

    return { status: "deleted" };
  });

  app.get("/api/bookmarks/check", async (request) => {
    const query = request.query as Record<string, string | undefined>;
    const found = query.url ? listBookmarks({ archived: true }).find((bookmark) => bookmark.url === query.url || bookmark.normalizedUrl === query.url) : null;

    return {
      exists: Boolean(found),
      bookmark: found ?? null
    };
  });

  app.get("/api/bookmarks/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const bookmark = getBookmarkById(id);

    if (!bookmark) {
      return reply.code(404).send({ message: "收藏不存在" });
    }

    return { bookmark };
  });

  app.get("/api/assistant/conversations", async () => ({
    conversations: listAssistantConversations()
  }));

  app.post("/api/assistant/conversations", async (request, reply) => {
    const body = request.body as { title?: string } | undefined;
    return reply.code(201).send({
      conversation: createAssistantConversation(body?.title?.trim() || "新对话")
    });
  });

  app.get("/api/assistant/conversations/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const conversation = getAssistantConversation(id);

    if (!conversation) {
      return reply.code(404).send({ message: "对话不存在" });
    }

    return conversation;
  });

  app.delete("/api/assistant/conversations/:id", async (request) => {
    const { id } = request.params as { id: string };
    return {
      deleted: deleteAssistantConversations([id])
    };
  });

  app.post("/api/assistant/conversations/delete", async (request, reply) => {
    const payload = deleteConversationsSchema.safeParse(request.body);
    if (!payload.success) {
      return reply.code(400).send({ message: "请选择要删除的历史记录" });
    }

    return {
      deleted: deleteAssistantConversations(payload.data.ids)
    };
  });

  app.post("/api/assistant/chat", async (request, reply) => {
    const payload = assistantSchema.safeParse(request.body);
    if (!payload.success) {
      return reply.code(400).send({ message: "请输入消息内容" });
    }

    const url = extractFirstUrl(payload.data.message);
    if (url) {
      const result = await createBookmark({ url, source: "assistant" });
      return {
        type: "bookmark_saved",
        message: result.status === "exists" ? "这个链接已经在收藏夹里。" : `已收藏，并归类到「${result.bookmark.category}」。`,
        bookmark: result.bookmark
      };
    }

    const results = listBookmarks({ q: payload.data.message }).slice(0, 8);

    try {
      const answer = await generateAssistantReply(payload.data.message, results);
      return {
        type: "message",
        message: answer.message,
        results: results.length ? results : undefined
      };
    } catch {
      return {
        type: "search_results",
        message: results.length ? `找到 ${results.length} 条相关收藏。` : "暂时没有找到相关收藏，可以换个关键词试试，或先在设置里配置 AI 服务。",
        results
      };
    }

  });

  app.post("/api/assistant/chat/stream", async (request, reply) => {
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

    const { message, model, effort, conversationId } = payload.data;
    const conversation = ensureAssistantConversation(conversationId, message);
    const history = buildConversationContext(conversation.id);
    writeSse(reply.raw, "meta", { conversation });
    addAssistantMessage(conversation.id, "user", message);

    const url = extractFirstUrl(message);
    if (url) {
      try {
        const result = await createBookmark({ url, source: "assistant" });
        const text = result.status === "exists" ? "这个链接已经在收藏夹里。" : `已收藏，并归类到「${result.bookmark.category}」。`;
        addAssistantMessage(conversation.id, "assistant", text);
        writeSse(reply.raw, "delta", { text });
        writeSse(reply.raw, "done", { type: "bookmark_saved", message: text, bookmark: result.bookmark, conversation });
      } catch (error) {
        const text = error instanceof Error ? error.message : "收藏失败";
        writeSse(reply.raw, "error", { message: text });
      } finally {
        reply.raw.end();
      }
      return;
    }

    const results = listBookmarks({ q: message }).slice(0, 8);

    try {
      let fullText = "";
      for await (const chunk of streamAssistantReply({ message, bookmarks: results, history, model, effort })) {
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
    } catch {
      const fallbackText = results.length ? `找到 ${results.length} 条相关收藏。` : "暂时没有找到相关收藏，可以换个关键词试试，或先在设置里配置 AI 服务。";
      addAssistantMessage(conversation.id, "assistant", fallbackText);
      writeSse(reply.raw, "delta", { text: fallbackText });
      writeSse(reply.raw, "done", {
        type: "search_results",
        message: fallbackText,
        results,
        conversation
      });
    } finally {
      reply.raw.end();
    }
  });
}

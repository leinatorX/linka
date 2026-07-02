import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { config } from "./config.js";
import { createBookmark, deleteBookmark, getBookmarkById, listBookmarks, updateBookmark } from "./services/bookmarks.js";
import { extractFirstUrl, isValidUrl } from "./utils/url.js";

const createBookmarkSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  source: z.string().optional()
});

const assistantSchema = z.object({
  message: z.string().min(1)
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
        tag: query.tag,
        archived: query.archived === undefined ? undefined : query.archived === "true"
      })
    };
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
    return {
      type: "search_results",
      message: results.length ? `找到 ${results.length} 条相关收藏。` : "暂时没有找到相关收藏，可以换个关键词试试。",
      results
    };
  });
}

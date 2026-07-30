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


export async function assistantRoutes(app: FastifyInstance) {
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

  app.patch("/api/assistant/conversations/:id", {
    schema: {
      description: "更新单个对话会话标题",
      tags: ["AI 助手"],
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string", description: "会话 ID" }
        }
      },
      body: shared.zodToJSON(shared.updateConversationTitleSchema)
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const payload = shared.updateConversationTitleSchema.safeParse(request.body);
    if (!payload.success) {
      return reply.code(400).send({ message: "请输入有效的历史记录标题" });
    }

    const conversation = updateAssistantConversationTitle(id, payload.data.title);
    if (!conversation) {
      return reply.code(404).send({ message: "对话不存在" });
    }

    return { conversation };
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
      body: shared.zodToJSON(shared.deleteConversationsSchema)
    }
  }, async (request, reply) => {
    const payload = shared.deleteConversationsSchema.safeParse(request.body);
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
      body: shared.zodToJSON(shared.assistantSchema)
    }
  }, async (request, reply) => {
    const payload = shared.assistantSchema.safeParse(request.body);
    if (!payload.success) {
      return reply.code(400).send({ message: "请输入消息内容" });
    }

    let rawMessage = payload.data.message;
    let effectiveMessage = rawMessage;
    let webContext: string | undefined = undefined;
    let mentionBookmarks: NonNullable<Awaited<ReturnType<typeof getBookmarkById>>>[] = [];

    const mentionRegex = /@\[(.*?)\]\((.*?)\)/g;
    effectiveMessage = effectiveMessage.replace(mentionRegex, (match, title) => `[${title}] `).trim();

    for (const match of rawMessage.matchAll(mentionRegex)) {
      const bm = await getBookmarkById(match[2]);
      if (bm) mentionBookmarks.push(bm);
    }

    if (mentionBookmarks.length > 0) {
      webContext = mentionBookmarks.map(bm => `用户指定了上下文书签：[${bm.title}](${bm.url})\n摘要：${bm.summary}`).join("\n\n") + "\n";
    }

    const catRegex = /\$\[(.*?)\]\((.*?)\)/g;
    effectiveMessage = effectiveMessage.replace(catRegex, (match, name) => `[${name}分类] `).trim();

    const results = shared.findAssistantBookmarkCandidates(effectiveMessage);
    for (const bm of mentionBookmarks) {
      if (!results.some(b => b.id === bm.id)) {
        results.unshift(bm);
      }
    }

    const toolContext = { activeCategory: payload.data.activeCategory };
    const toolPlan = inferAssistantToolPlan(effectiveMessage, toolContext) ?? await planAssistantToolCall({
      message: effectiveMessage,
      categories: listCategories().map((category) => category.name),
      activeCategory: payload.data.activeCategory,
      bookmarkHints: results.map(shared.toAssistantBookmarkHint),
      webSearchEnabled: isSearchEnabled()
    });
    const toolResult = toolPlan ? await executeAssistantToolPlan(toolPlan, effectiveMessage, toolContext) : null;
    const webSearchFallbackResult = await shared.maybeExecuteWebSearchFallback(effectiveMessage, toolPlan, toolResult);
    if (webSearchFallbackResult?.type === "web_context") {
      webContext = (webContext ? webContext + "\n" : "") + webSearchFallbackResult.message;
    } else if (webSearchFallbackResult) {
      return {
        ...webSearchFallbackResult,
        message: await shared.renderAssistantToolMessage(effectiveMessage, webSearchFallbackResult)
      };
    }

    if (toolResult && !webSearchFallbackResult) {
      return {
        ...toolResult,
        message: await shared.renderAssistantToolMessage(effectiveMessage, toolResult)
      };
    }

    if (shared.isConfirmationOnly(effectiveMessage)) {
      return {
        type: "message",
        message: "没有找到可执行的待确认操作。请把要操作的书签或分类名称一起说清楚。"
      };
    }

    try {
      const answer = await generateAssistantReply(effectiveMessage, results, payload.data.attachments as AssistantAttachment[] | undefined, webContext);
      return {
        type: "message",
        message: answer.message,
        results: results.length ? results : undefined
      };
    } catch (error) {
      request.log.error({ error }, "assistant chat failed");
      if (webContext) {
        const fallbackText = shared.assistantWebContextFallbackMessage(webContext);
        return {
          type: "message",
          message: fallbackText,
          results: results.length ? results : undefined
        };
      }
      return {
        type: "message",
        message: shared.assistantErrorMessage(error, Boolean(payload.data.attachments?.length))
      };
    }
  });

  app.post("/api/assistant/chat/stream", {
    schema: {
      description: "与大模型助手交互（SSE 流式数据传输，支持多轮对话与推理思考流输出）",
      tags: ["AI 助手"],
      body: shared.zodToJSON(shared.assistantStreamSchema)
    }
  }, async (request, reply) => {
    const payload = shared.assistantStreamSchema.safeParse(request.body);
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

    const { model, effort, conversationId, activeCategory, attachments } = payload.data;
    let rawMessage = payload.data.message;
    let effectiveMessage = rawMessage;
    let webContext: string | undefined = undefined;
    let mentionBookmarks: NonNullable<Awaited<ReturnType<typeof getBookmarkById>>>[] = [];

    const mentionRegex = /@\[(.*?)\]\((.*?)\)/g;
    effectiveMessage = effectiveMessage.replace(mentionRegex, (match, title) => `[${title}] `).trim();

    for (const match of rawMessage.matchAll(mentionRegex)) {
      const bm = await getBookmarkById(match[2]);
      if (bm) mentionBookmarks.push(bm);
    }

    if (mentionBookmarks.length > 0) {
      webContext = mentionBookmarks.map(bm => `用户指定了上下文书签：[${bm.title}](${bm.url})\n摘要：${bm.summary}`).join("\n\n") + "\n";
    }

    const catRegex = /\$\[(.*?)\]\((.*?)\)/g;
    effectiveMessage = effectiveMessage.replace(catRegex, (match, name) => `[${name}分类] `).trim();

    let conversation = ensureAssistantConversation(conversationId, rawMessage);
    const history = buildConversationContext(conversation.id);
    const shouldGenerateTitle = history.length === 0;
    shared.writeSse(reply.raw, "meta", { conversation });
    addAssistantMessage(conversation.id, "user", rawMessage, attachments as AssistantAttachment[] | undefined);
    shared.writeSse(reply.raw, "status", { text: "正在分析您的意图..." });

    async function refreshConversationTitle(assistantReply: string) {
      if (!shouldGenerateTitle) {
        return;
      }

      const title = await generateAssistantConversationTitle({ userMessage: rawMessage, assistantReply, model });
      if (title) {
        conversation = updateAssistantConversationAutoTitle(conversation.id, rawMessage, title) ?? conversation;
      }
    }

    const results = shared.findAssistantBookmarkCandidates(effectiveMessage);
    for (const bm of mentionBookmarks) {
      if (!results.some(b => b.id === bm.id)) {
        results.unshift(bm);
      }
    }

    const toolContext = { activeCategory, history };
    const fastToolPlan = inferAssistantToolPlan(effectiveMessage, toolContext);

    if (fastToolPlan) {
      shared.writeSse(reply.raw, "status", { text: "正在执行快速指令..." });
      const toolResult = await executeAssistantToolPlan(fastToolPlan, effectiveMessage, toolContext);
      const webSearchFallbackResult = await shared.maybeExecuteWebSearchFallback(effectiveMessage, fastToolPlan, toolResult);
      if (webSearchFallbackResult?.type === "web_context") {
        webContext = (webContext ? webContext + "\n" : "") + webSearchFallbackResult.message;
      } else if (webSearchFallbackResult) {
        const text = await shared.renderAssistantToolMessage(effectiveMessage, webSearchFallbackResult);
        addAssistantMessage(conversation.id, "assistant", text);
        await refreshConversationTitle(text);
        shared.writeSse(reply.raw, "delta", { text });
        shared.writeSse(reply.raw, "done", { ...webSearchFallbackResult, message: text, conversation });
        reply.raw.end();
        return;
      }

      if (toolResult && !webSearchFallbackResult) {
        if (toolResult.type === "web_context") {
          webContext = (webContext ? webContext + "\n" : "") + toolResult.message;
        } else {
          const text = await shared.renderAssistantToolMessage(effectiveMessage, toolResult);
          addAssistantMessage(conversation.id, "assistant", text);
          await refreshConversationTitle(text);
          shared.writeSse(reply.raw, "delta", { text });
          shared.writeSse(reply.raw, "done", { ...toolResult, message: text, conversation });
          reply.raw.end();
          return;
        }
      }
    }

    if (shared.isConfirmationOnly(effectiveMessage)) {
      const text = "没有找到可执行的待确认操作。请把要操作的书签或分类名称一起说清楚。";
      addAssistantMessage(conversation.id, "assistant", text);
      await refreshConversationTitle(text);
      shared.writeSse(reply.raw, "delta", { text });
      shared.writeSse(reply.raw, "done", {
        type: "message",
        message: text,
        conversation
      });
      reply.raw.end();
      return;
    }

    try {
      shared.writeSse(reply.raw, "status", { text: "正在思考与生成回答..." });
      const activeConfig = getActiveAiConfig(model);
      const nativeTools = activeConfig.provider.apiFormat === "anthropic"
        ? getAssistantNativeAnthropicTools({ webSearchEnabled: isSearchEnabled() })
        : getAssistantNativeOpenAiTools({ webSearchEnabled: isSearchEnabled() });

      let fullText = "";
      let executedNativeTool = false;

      for await (const chunk of streamAssistantReply({
        message: effectiveMessage,
        bookmarks: results,
        history,
        attachments: attachments as AssistantAttachment[] | undefined,
        model,
        effort,
        webContext,
        tools: nativeTools
      })) {
        if (chunk.type === "reasoning") {
          shared.writeSse(reply.raw, "reasoning", { text: chunk.text });
          continue;
        }

        if (chunk.type === "tool_call") {
          const nativePlan = chunk.toolCall;
          if (nativePlan && nativePlan.tool !== "none") {
            shared.writeSse(reply.raw, "status", { text: `正在执行操作 [${nativePlan.tool}]...` });
            const toolResult = await executeAssistantToolPlan(nativePlan, effectiveMessage, toolContext);
            if (toolResult) {
              executedNativeTool = true;
              if (toolResult.type === "web_context") {
                webContext = (webContext ? webContext + "\n" : "") + toolResult.message;
              } else {
                const text = await shared.renderAssistantToolMessage(effectiveMessage, toolResult);
                addAssistantMessage(conversation.id, "assistant", text);
                await refreshConversationTitle(text);
                shared.writeSse(reply.raw, "delta", { text });
                shared.writeSse(reply.raw, "done", { ...toolResult, message: text, conversation });
                reply.raw.end();
                return;
              }
            }
          }
          continue;
        }

        fullText += chunk.text;
        shared.writeSse(reply.raw, "delta", { text: chunk.text });
      }

      if (!executedNativeTool) {
        const finalText = fullText.trim() || "我暂时没有生成有效回复。";
        addAssistantMessage(conversation.id, "assistant", finalText);
        await refreshConversationTitle(finalText);
        shared.writeSse(reply.raw, "done", {
          type: "message",
          message: finalText,
          results: results.length ? results : undefined,
          conversation
        });
      }
    } catch (error) {
      request.log.error({ error }, "assistant stream failed");
      const text = webContext
        ? shared.assistantWebContextFallbackMessage(webContext)
        : shared.assistantErrorMessage(error, Boolean(attachments?.length));
      addAssistantMessage(conversation.id, "assistant", text);
      shared.writeSse(reply.raw, "delta", { text });
      shared.writeSse(reply.raw, "done", {
        type: "message",
        message: text,
        conversation
      });
    } finally {
      reply.raw.end();
    }
  });

  app.post("/api/ai/chat/stream", {
    schema: {
      description: "通用无状态大模型流式对话接口，不附带任何上下文，不保存历史",
      tags: ["AI"],
      body: shared.zodToJSON(z.object({
        messages: z.array(z.object({
          role: z.enum(["system", "user", "assistant"]),
          content: z.string()
        })),
        model: z.string().optional()
      }))
    }
  }, async (request, reply) => {
    const payload = z.object({
      messages: z.array(z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string()
      })),
      model: z.string().optional()
    }).safeParse(request.body);
    
    if (!payload.success) {
      return reply.code(400).send({ message: "Invalid request" });
    }

    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });

    try {
      const stream = streamGenericChat({
        messages: payload.data.messages as any,
        model: payload.data.model
      });

      let text = "";
      for await (const chunk of stream) {
        if (chunk.type === "text") {
          text += chunk.text;
          shared.writeSse(reply.raw, "delta", { text: chunk.text });
        } else if (chunk.type === "reasoning") {
          shared.writeSse(reply.raw, "reasoning", { text: chunk.text });
        }
      }

      shared.writeSse(reply.raw, "message", {
        id: crypto.randomUUID(),
        role: "assistant",
        text,
        timestamp: Date.now()
      });
      shared.writeSse(reply.raw, "done", {});
    } catch (error: any) {
      request.log.error({ error }, "generic stream failed");
      shared.writeSse(reply.raw, "error", { message: error.message || "Request failed" });
      shared.writeSse(reply.raw, "done", {});
    } finally {
      reply.raw.end();
    }
  });

}

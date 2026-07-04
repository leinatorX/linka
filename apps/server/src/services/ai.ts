import { toBookmark } from "../db.js";
import type { PageMetadata } from "./metadata.js";
import { getActiveAiConfig } from "./settings.js";
import type { ActiveAiConfig } from "./settings.js";
import {
  ASSISTANT_CHAT_SYSTEM_PROMPT,
  ASSISTANT_TOOL_RESULT_SYSTEM_PROMPT,
  ASSISTANT_TOOL_SYSTEM_PROMPT,
  CLASSIFY_BOOKMARK_SYSTEM_PROMPT,
  buildAssistantToolResultPrompt,
  buildAssistantUserPrompt,
  buildAssistantToolUserPrompt,
  buildClassifyBookmarkUserPrompt
} from "./prompts.js";

export interface AiClassification {
  title: string;
  summary: string;
  category: string;
  confidence: number;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export type ReasoningEffort = "关闭" | "默认" | "低" | "中" | "高" | "最大";

type StreamChunk = {
  type: "text" | "reasoning";
  text: string;
};

interface AssistantResult {
  message: string;
}

export interface AssistantHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AssistantToolPlan {
  tool:
    | "none"
    | "list_bookmarks"
    | "create_bookmark"
    | "update_bookmark"
    | "delete_bookmark"
    | "list_categories"
    | "create_category"
    | "update_category"
    | "delete_category"
    | "move_bookmarks_to_category"
    | "archive_bookmark"
    | "pin_bookmark";
  arguments: Record<string, unknown>;
  confidence: number;
  requiresConfirmation: boolean;
  reason: string;
}

function inferCategory(metadata: PageMetadata): string {
  const text = `${metadata.title} ${metadata.description} ${metadata.textSample}`.toLowerCase();
  const rules: Array<[string, string[]]> = [
    ["AI 工具", ["ai", "openai", "model", "prompt", "llm", "人工智能"]],
    ["开发工具", ["github", "docker", "api", "typescript", "vue", "node", "database"]],
    ["新闻资讯", ["news", "breaking", "报道", "新闻", "快讯"]],
    ["设计资源", ["design", "figma", "ui", "ux", "icon", "设计"]],
    ["NAS 与自托管", ["nas", "self-hosted", "synology", "homelab", "docker compose"]]
  ];

  return rules.find(([, keywords]) => keywords.some((keyword) => {
    if (/^[a-z0-9-]+$/.test(keyword) && keyword.length <= 3) {
      return new RegExp(`\\b${keyword}\\b`, "i").test(text);
    }

    return text.includes(keyword);
  }))?.[0] ?? "未分类";
}

function fallbackClassification(metadata: PageMetadata): AiClassification {
  const category = inferCategory(metadata);

  return {
    title: metadata.title,
    summary: metadata.description || metadata.textSample.slice(0, 120) || "已保存该网页，暂无可用摘要。",
    category,
    confidence: 0.45
  };
}

function normalizeAiCategory(category: string, allowedCategories: string[]) {
  const allowed = new Set(allowedCategories);
  return allowed.has(category) ? category : "未分类";
}

function extractJsonObject(content: string) {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return "{}";
  }

  return content.slice(start, end + 1);
}

function getConfigIdentity(active: ActiveAiConfig) {
  return `${active.provider.id} ${active.provider.name} ${active.provider.baseUrl} ${active.model.name}`.toLowerCase();
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function mapOpenAiReasoningEffort(effort?: ReasoningEffort, identity = "") {
  if (!effort || effort === "默认") {
    return undefined;
  }

  if (effort === "关闭") {
    if (includesAny(identity, ["gpt-5.1", "gpt-5.2", "gpt-5.3", "gpt-5.4", "gpt-5.5", "glm-5.2", "mimo"])) {
      return "none";
    }

    return "minimal";
  }

  if (effort === "低") {
    return "low";
  }

  if (effort === "中") {
    return "medium";
  }

  if (effort === "高") {
    return "high";
  }

  if (includesAny(identity, ["glm-5.2"])) {
    return "max";
  }

  if (includesAny(identity, ["gpt-5.5", "codex-max"])) {
    return "xhigh";
  }

  return "high";
}

function mapDeepSeekEffort(effort?: ReasoningEffort) {
  if (effort === "最大") {
    return "max";
  }

  if (effort === "低" || effort === "中" || effort === "高") {
    return "high";
  }

  return undefined;
}

function applyOpenAiCompatibleReasoning(body: Record<string, unknown>, active: ActiveAiConfig, effort?: ReasoningEffort) {
  if (!effort || effort === "默认") {
    return;
  }

  const identity = getConfigIdentity(active);
  const isKimi = includesAny(identity, ["kimi", "moonshot"]);
  const isMiniMax = includesAny(identity, ["minimax"]);
  const isGlm = includesAny(identity, ["glm", "zhipu", "bigmodel", "z.ai"]);
  const isMimo = includesAny(identity, ["mimo", "xiaomi"]);
  const isDeepSeek = includesAny(identity, ["deepseek"]);
  const modelName = active.model.name.toLowerCase();
  const isOpenAiReasoning = /^(gpt-5|o1|o3|o4)/.test(modelName) || modelName.includes("codex");

  if (isKimi) {
    if (identity.includes("k2.7-code")) {
      return;
    }

    if (effort === "关闭") {
      body.thinking = { type: "disabled" };
      return;
    }

    body.thinking = effort === "最大" && identity.includes("k2.6")
      ? { type: "enabled", keep: "all" }
      : { type: "enabled" };
    return;
  }

  if (isGlm) {
    if (effort === "关闭") {
      body.thinking = { type: "disabled" };
      body.reasoning_effort = "none";
      return;
    }

    body.thinking = { type: "enabled" };
    body.reasoning_effort = mapOpenAiReasoningEffort(effort, identity);
    return;
  }

  if (isDeepSeek) {
    if (effort === "关闭") {
      body.thinking = { type: "disabled" };
      return;
    }

    body.thinking = { type: "enabled" };
    const deepSeekEffort = mapDeepSeekEffort(effort);
    if (deepSeekEffort) {
      body.reasoning_effort = deepSeekEffort;
    }
    return;
  }

  if (isOpenAiReasoning || isMimo) {
    body.reasoning_effort = mapOpenAiReasoningEffort(effort, identity);
    return;
  }

  if (isMiniMax && effort !== "关闭") {
    body.reasoning_split = true;
    return;
  }

}

function mapAnthropicThinkingBudget(effort: ReasoningEffort, maxTokens: number) {
  const budgetByEffort: Partial<Record<ReasoningEffort, number>> = {
    低: 1024,
    中: 4096,
    高: 8192,
    最大: 32768
  };
  const desired = budgetByEffort[effort] ?? 1024;
  const budget = Math.min(desired, Math.max(1024, maxTokens - 256));

  return {
    budget,
    maxTokens: Math.max(maxTokens, budget + 256)
  };
}

function applyAnthropicCompatibleReasoning(body: Record<string, unknown>, active: ActiveAiConfig, effort?: ReasoningEffort) {
  if (!effort || effort === "默认") {
    return;
  }

  const identity = getConfigIdentity(active);
  const isMiniMax = includesAny(identity, ["minimax"]);
  const isDeepSeek = includesAny(identity, ["deepseek"]);

  if (isMiniMax) {
    body.thinking = effort === "关闭" ? { type: "disabled" } : { type: "adaptive" };
    return;
  }

  if (isDeepSeek) {
    if (effort === "关闭") {
      body.thinking = { type: "disabled" };
      return;
    }

    body.thinking = { type: "enabled" };
    const deepSeekEffort = mapDeepSeekEffort(effort);
    if (deepSeekEffort) {
      body.output_config = { effort: deepSeekEffort };
    }
    return;
  }

  if (effort === "关闭") {
    body.thinking = { type: "disabled" };
    return;
  }

  const { budget, maxTokens } = mapAnthropicThinkingBudget(effort, active.model.maxTokens);
  body.max_tokens = maxTokens;
  body.thinking = {
    type: "enabled",
    budget_tokens: budget
  };
}

async function requestOpenAi(active: ActiveAiConfig, messages: ChatMessage[], jsonMode: boolean) {
  const body: Record<string, unknown> = {
    model: active.model.name,
    temperature: active.provider.temperature,
    messages,
    max_tokens: active.model.maxTokens
  };

  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const response = await fetch(`${active.provider.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${active.provider.apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`AI 服务返回 ${response.status}`);
  }

  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return payload.choices?.[0]?.message?.content ?? "";
}

async function* streamOpenAi(active: ActiveAiConfig, messages: ChatMessage[], effort?: ReasoningEffort) {
  const body: Record<string, unknown> = {
    model: active.model.name,
    temperature: active.provider.temperature,
    max_tokens: active.model.maxTokens,
    stream: true,
    messages
  };
  applyOpenAiCompatibleReasoning(body, active, effort);

  const response = await fetch(`${active.provider.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${active.provider.apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok || !response.body) {
    throw new Error(`AI 服务返回 ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const text = line.trim();
      if (!text.startsWith("data:")) {
        continue;
      }

      const data = text.slice(5).trim();
      if (!data || data === "[DONE]") {
        continue;
      }

      try {
        const payload = JSON.parse(data) as {
          choices?: Array<{
            delta?: {
              content?: string;
              reasoning?: string;
              reasoning_content?: string;
              reasoning_details?: Array<{ text?: string; content?: string }>;
            };
          }>;
        };
        const delta = payload.choices?.[0]?.delta;
        const reasoning = delta?.reasoning_content
          ?? delta?.reasoning
          ?? delta?.reasoning_details?.map((item) => item.text ?? item.content ?? "").join("");
        if (reasoning) {
          yield { type: "reasoning", text: reasoning } satisfies StreamChunk;
        }
        if (delta?.content) {
          yield { type: "text", text: delta.content } satisfies StreamChunk;
        }
      } catch {
        continue;
      }
    }
  }
}

async function requestAnthropic(active: ActiveAiConfig, messages: ChatMessage[]) {
  const system = messages.filter((message) => message.role === "system").map((message) => message.content).join("\n\n");
  const conversation = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role,
      content: message.content
    }));

  const response = await fetch(`${active.provider.baseUrl.replace(/\/$/, "")}/v1/messages`, {
    method: "POST",
    headers: {
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      "x-api-key": active.provider.apiKey
    },
    body: JSON.stringify({
      model: active.model.name,
      max_tokens: active.model.maxTokens,
      temperature: active.provider.temperature,
      system,
      messages: conversation
    })
  });

  if (!response.ok) {
    throw new Error(`AI 服务返回 ${response.status}`);
  }

  const payload = await response.json() as { content?: Array<{ type?: string; text?: string }> };
  return payload.content?.find((item) => item.type === "text")?.text ?? "";
}

async function* streamAnthropic(active: ActiveAiConfig, messages: ChatMessage[], effort?: ReasoningEffort) {
  const system = messages.filter((message) => message.role === "system").map((message) => message.content).join("\n\n");
  const conversation = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role,
      content: message.content
    }));
  const body: Record<string, unknown> = {
    model: active.model.name,
    max_tokens: active.model.maxTokens,
    temperature: active.provider.temperature,
    stream: true,
    system,
    messages: conversation
  };
  applyAnthropicCompatibleReasoning(body, active, effort);

  const response = await fetch(`${active.provider.baseUrl.replace(/\/$/, "")}/v1/messages`, {
    method: "POST",
    headers: {
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      "x-api-key": active.provider.apiKey
    },
    body: JSON.stringify(body)
  });

  if (!response.ok || !response.body) {
    throw new Error(`AI 服务返回 ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const text = line.trim();
      if (!text.startsWith("data:")) {
        continue;
      }

      const data = text.slice(5).trim();
      if (!data || data === "[DONE]") {
        continue;
      }

      try {
        const payload = JSON.parse(data) as { type?: string; delta?: { type?: string; text?: string; thinking?: string } };
        if (payload.type === "content_block_delta" && payload.delta?.thinking) {
          yield { type: "reasoning", text: payload.delta.thinking } satisfies StreamChunk;
        }
        if (payload.type === "content_block_delta" && payload.delta?.text) {
          yield { type: "text", text: payload.delta.text } satisfies StreamChunk;
        }
      } catch {
        continue;
      }
    }
  }
}

async function requestAi(messages: ChatMessage[], options: { jsonMode?: boolean } = {}) {
  const active = getActiveAiConfig();

  if (active.provider.apiFormat === "anthropic") {
    return requestAnthropic(active, messages);
  }

  return requestOpenAi(active, messages, Boolean(options.jsonMode));
}

async function* streamAi(messages: ChatMessage[], modelName?: string, effort?: ReasoningEffort): AsyncGenerator<StreamChunk> {
  const active = getActiveAiConfig(modelName);

  if (active.provider.apiFormat === "anthropic") {
    yield* streamAnthropic(active, messages, effort);
    return;
  }

  yield* streamOpenAi(active, messages, effort);
}

export async function classifyBookmark(metadata: PageMetadata, allowedCategories: string[]): Promise<AiClassification> {
  const prompt = buildClassifyBookmarkUserPrompt(metadata, allowedCategories);

  try {
    const content = await requestAi([
      { role: "system", content: CLASSIFY_BOOKMARK_SYSTEM_PROMPT },
      { role: "user", content: prompt }
    ], { jsonMode: true });
    const parsed = JSON.parse(extractJsonObject(content)) as Partial<AiClassification>;

    return {
      title: String(parsed.title || metadata.title),
      summary: String(parsed.summary || metadata.description || "已保存该网页。"),
      category: normalizeAiCategory(String(parsed.category || "未分类"), allowedCategories),
      confidence: Number(parsed.confidence ?? 0.7)
    };
  } catch {
    const fallback = fallbackClassification(metadata);
    return {
      ...fallback,
      category: normalizeAiCategory(fallback.category, allowedCategories)
    };
  }
}

export async function generateAssistantReply(message: string, bookmarks: Array<ReturnType<typeof toBookmark>>): Promise<AssistantResult> {
  const prompt = buildAssistantUserPrompt({ message, bookmarks });

  const content = await requestAi([
    { role: "system", content: ASSISTANT_CHAT_SYSTEM_PROMPT },
    { role: "user", content: prompt }
  ]);

  return {
    message: content.trim() || "我暂时没有生成有效回复。"
  };
}

export async function* streamAssistantReply(options: {
  message: string;
  bookmarks: Array<ReturnType<typeof toBookmark>>;
  history?: AssistantHistoryMessage[];
  model?: string;
  effort?: ReasoningEffort;
}) {
  const prompt = buildAssistantUserPrompt({
    message: options.message,
    bookmarks: options.bookmarks,
    history: options.history
  });

  yield* streamAi([
    { role: "system", content: ASSISTANT_CHAT_SYSTEM_PROMPT },
    { role: "user", content: prompt }
  ], options.model, options.effort);
}

export async function planAssistantToolCall(options: {
  message: string;
  categories: string[];
  history?: AssistantHistoryMessage[];
  bookmarkHints: Array<Pick<ReturnType<typeof toBookmark>, "id" | "title" | "category" | "url" | "domain">>;
}): Promise<AssistantToolPlan | null> {
  const prompt = buildAssistantToolUserPrompt(options);

  try {
    const content = await requestAi([
      { role: "system", content: ASSISTANT_TOOL_SYSTEM_PROMPT },
      { role: "user", content: prompt }
    ], { jsonMode: true });
    const parsed = JSON.parse(extractJsonObject(content)) as Partial<AssistantToolPlan>;
    const tool = typeof parsed.tool === "string" ? parsed.tool : "none";
    const allowedTools = new Set<AssistantToolPlan["tool"]>([
      "none",
      "list_bookmarks",
      "create_bookmark",
      "update_bookmark",
      "delete_bookmark",
      "list_categories",
      "create_category",
      "update_category",
      "delete_category",
      "move_bookmarks_to_category",
      "archive_bookmark",
      "pin_bookmark"
    ]);

    if (!allowedTools.has(tool as AssistantToolPlan["tool"])) {
      return null;
    }

    return {
      tool: tool as AssistantToolPlan["tool"],
      arguments: typeof parsed.arguments === "object" && parsed.arguments !== null ? parsed.arguments : {},
      confidence: Number(parsed.confidence ?? 0),
      requiresConfirmation: Boolean(parsed.requiresConfirmation),
      reason: String(parsed.reason ?? "")
    };
  } catch {
    return null;
  }
}

export async function generateAssistantToolResultReply(options: {
  message: string;
  resultMessage: string;
  type: string;
  changed?: boolean;
  categoriesChanged?: boolean;
}): Promise<string> {
  const prompt = buildAssistantToolResultPrompt(options);
  const content = await requestAi([
    { role: "system", content: ASSISTANT_TOOL_RESULT_SYSTEM_PROMPT },
    { role: "user", content: prompt }
  ]);

  return content.trim() || options.resultMessage;
}

export async function testAiConnection(provider: {
  id: string;
  name: string;
  apiFormat: "openai" | "anthropic";
  baseUrl: string;
  apiKey?: string;
  temperature: number;
}, model: {
  id: string;
  name: string;
  maxTokens: number;
}) {
  const activeConfig = {
    provider: {
      ...provider,
      enabled: true,
      apiKey: provider.apiKey ?? "",
      activeModelId: model.id,
      models: [model]
    },
    model
  } as ActiveAiConfig;
  
  const messages = [{ role: "user" as const, content: "say ok" }];
  
  if (provider.apiFormat === "anthropic") {
    return await requestAnthropic(activeConfig, messages);
  } else {
    return await requestOpenAi(activeConfig, messages, false);
  }
}

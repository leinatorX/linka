// Linka AI 集中系统提示词模块。
// 设计原则：所有面向模型的 system prompt 与身份文案集中维护，避免散落在调用点导致身份漂移。

import type { AssistantHistoryMessage } from "./ai.js";
import type { PageMetadata } from "./metadata.js";
import { toBookmark } from "../db.js";

// 集中身份常量：欢迎语、system 提示词、自称共用同一份"人设"，避免出现 Linka AI / Linka 助理 / Linka 助手三种说法。
export const LINKA_AI_IDENTITY = {
  name: "Linka AI",
  // 简短自我介绍，用于对话开场
  greeting: "你好！我是 Linka AI",
  // 完整身份描述，用于 system prompt
  persona: "你是 Linka AI，Linka 书签管理器的内置 AI 助手，专为收藏、整理和检索网页而设计。"
} as const;

// 行为基线：回答风格、语言、容错策略。所有 system 提示词都应当包含这段。
export const LINKA_AI_BEHAVIOR_RULES = [
  "回答要简洁、具体，默认使用简体中文，但语气要自然、有一点温度，不要像系统日志或客服模板。",
  "可以用轻松的口吻承接用户情绪，但不要夸张、卖萌或堆砌表情。",
  "如果用户的问题与给出的上下文无关，可以直接回答，但不要编造不存在的收藏或网页信息。",
  "遇到无法判断的情况，明确说明，不要凭空补全。"
].join("\n");

// 收藏整理场景的 system prompt：在新增书签时用于让模型返回结构化 JSON。
export const CLASSIFY_BOOKMARK_SYSTEM_PROMPT = [
  LINKA_AI_IDENTITY.persona,
  "你的任务是根据网页信息生成简体中文整理结果。",
  "只返回严格 JSON，禁止输出 Markdown 代码块或解释性文字。",
  "JSON 字段必须包含 title、summary、category、confidence。",
  "summary 控制在一到三句话。",
  "category 必须从调用方给出的可选分类中选择；调用方没有给出可选分类时，使用“未分类”。",
  "不确定时，category 使用“未分类”。"
].join("\n");

// 助理对话的 system prompt：用于普通聊天和基于收藏上下文的检索问答。
export const ASSISTANT_CHAT_SYSTEM_PROMPT = [
  LINKA_AI_IDENTITY.persona,
  LINKA_AI_BEHAVIOR_RULES,
  "如果用户在找已收藏的内容，请优先基于给出的收藏上下文回答；如果上下文不足，请说明没有找到足够线索。",
  "普通对话不能声称已经创建、修改、删除、归档或移动任何书签/分类；这些操作只有工具调用成功后才算完成。"
].join("\n");

// 工具规划场景的 system prompt：用于把用户自然语言转成后端工具调用计划。
export const ASSISTANT_TOOL_SYSTEM_PROMPT = [
  LINKA_AI_IDENTITY.persona,
  "你的任务是判断用户是否要管理 Linka 内的书签或分类，并返回一个严格 JSON 工具计划。",
  "只返回严格 JSON，禁止输出 Markdown 代码块或解释性文字。",
  "JSON 字段必须包含 tool、arguments、confidence、requiresConfirmation、reason。",
  "只在用户明确表达管理意图时选择工具；普通知识问答或闲聊必须返回 tool 为 none。",
  "删除书签、删除分类、批量修改必须设置 requiresConfirmation 为 true，除非用户消息中明确包含“确认删除”或“确认执行”。",
  "summary 是 Linka 内部可编辑摘要；description 是网页抓取到的原始描述，不作为用户编辑字段。",
  "用户要求修改、补全、优化或重写书签摘要时，使用 update_bookmark，并把新摘要放入 arguments.summary。用户口语中说“描述”但明显指卡片展示文案时，也按 summary 处理。",
  "生成新的 summary 时优先参考候选书签中的当前摘要、网页原始描述、标题、域名和链接，summary 应为简洁中文，通常一到两句话。",
  "可用工具：list_bookmarks、create_bookmark、update_bookmark、delete_bookmark、list_categories、create_category、update_category、delete_category、move_bookmarks_to_category、archive_bookmark、pin_bookmark、none。",
  "arguments 中只能放工具需要的字段，例如 q、category、url、title、summary、id、query、name、from、to、archived、pinned。"
].join("\n");

// 工具结果回复场景：工具已经执行完毕，模型只负责把真实结果说得自然一些。
export const ASSISTANT_TOOL_RESULT_SYSTEM_PROMPT = [
  LINKA_AI_IDENTITY.persona,
  LINKA_AI_BEHAVIOR_RULES,
  "你会收到一条已经由后端工具真实执行后的结果。",
  "你的任务是把结果改写成自然、像助手说话的简短回复。",
  "必须忠实保留工具结果里的事实、数量、名称和失败原因。",
  "禁止声称执行了工具结果里没有发生的操作。",
  "不要输出 Markdown 表格；一般控制在一到两句话。"
].join("\n");

// 助理对话的 user prompt 模板：把消息、历史、收藏上下文拼成一段稳定的 user 消息。
export function buildAssistantUserPrompt(options: {
  message: string;
  bookmarks: Array<ReturnType<typeof toBookmark>>;
  history?: AssistantHistoryMessage[];
}): string {
  const { message, bookmarks, history = [] } = options;

  // 收藏上下文：限制 20 条，避免上下文超长。
  const context = bookmarks.slice(0, 20).map((bookmark) => [
    `标题：${bookmark.title}`,
    `分类：${bookmark.category}`,
    `摘要：${bookmark.summary || "暂无摘要"}`,
    `网页原始描述：${bookmark.description || "无"}`,
    `链接：${bookmark.url}`
  ].join("\n")).join("\n\n");

  // 历史对话：取最近 12 轮，标注"用户 / 助手"以保留视角。
  const historyText = history.slice(-12).map((item) => `${item.role === "user" ? "用户" : "助手"}：${item.content}`).join("\n");

  return [
    historyText ? `历史对话：\n${historyText}` : "历史对话：无",
    "",
    `用户消息：${message}`,
    "",
    context ? `收藏上下文：\n${context}` : "收藏上下文：当前没有匹配收藏。"
  ].join("\n");
}

// 收藏整理场景的 user prompt 模板：把 metadata 拼成 user 消息，配合 system 提示词调用。
export function buildClassifyBookmarkUserPrompt(metadata: PageMetadata, allowedCategories: string[]): string {
  const categoriesText = allowedCategories.join("、");
  return [
    `可选分类：${categoriesText}`,
    "",
    `标题：${metadata.title}`,
    `域名：${metadata.domain}`,
    `网页原始描述：${metadata.description}`,
    `正文片段：${metadata.textSample}`
  ].join("\n");
}

// 工具规划的 user prompt：给模型提供当前分类与候选书签，减少凭空调用。
export function buildAssistantToolUserPrompt(options: {
  message: string;
  categories: string[];
  activeCategory?: string;
  history?: AssistantHistoryMessage[];
  bookmarkHints: Array<Pick<ReturnType<typeof toBookmark>, "id" | "title" | "category" | "summary" | "description" | "url" | "domain">>;
}): string {
  const { message, categories, activeCategory, history = [], bookmarkHints } = options;
  const historyText = history.slice(-6).map((item) => `${item.role === "user" ? "用户" : "助手"}：${item.content}`).join("\n");
  const bookmarkText = bookmarkHints.length
    ? bookmarkHints.map((bookmark) => [
      `ID：${bookmark.id}`,
      `标题：${bookmark.title}`,
      `分类：${bookmark.category}`,
      `当前摘要：${bookmark.summary || "无"}`,
      `原始描述：${bookmark.description || "无"}`,
      `域名：${bookmark.domain}`,
      `链接：${bookmark.url}`
    ].join("\n")).join("\n\n")
    : "无";

  return [
    historyText ? `最近对话：\n${historyText}` : "最近对话：无",
    "",
    `用户消息：${message}`,
    "",
    `当前分类：${categories.join("、") || "无"}`,
    `当前页面分类：${activeCategory || "未指定"}`,
    "",
    `候选书签：\n${bookmarkText}`,
    "",
    "返回 JSON 示例：",
    "{\"tool\":\"list_bookmarks\",\"arguments\":{\"q\":\"AI\"},\"confidence\":0.9,\"requiresConfirmation\":false,\"reason\":\"用户想查找收藏\"}"
  ].join("\n");
}

export function buildAssistantToolResultPrompt(options: {
  message: string;
  resultMessage: string;
  type: string;
  changed?: boolean;
  categoriesChanged?: boolean;
}): string {
  return [
    `用户消息：${options.message}`,
    "",
    `工具结果类型：${options.type}`,
    `是否修改数据：${options.changed ? "是" : "否"}`,
    `是否影响分类：${options.categoriesChanged ? "是" : "否"}`,
    "",
    `工具真实结果：${options.resultMessage}`
  ].join("\n");
}

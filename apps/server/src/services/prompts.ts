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
  "回答要简洁、具体，默认使用简体中文。",
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
  "如果用户在找已收藏的内容，请优先基于给出的收藏上下文回答；如果上下文不足，请说明没有找到足够线索。"
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
    `摘要：${bookmark.summary || bookmark.description || "暂无摘要"}`,
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
    `描述：${metadata.description}`,
    `正文片段：${metadata.textSample}`
  ].join("\n");
}

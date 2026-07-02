import { config } from "../config.js";
import type { PageMetadata } from "./metadata.js";

export interface AiClassification {
  title: string;
  summary: string;
  category: string;
  tags: string[];
  confidence: number;
}

function uniqueTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) {
    return [];
  }

  return [...new Set(tags.map((tag) => String(tag).trim()).filter(Boolean))].slice(0, 6);
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
  const tags = [category, metadata.domain.split(".")[0], ...metadata.title.split(/\s+/).slice(0, 3)]
    .map((tag) => tag.replace(/[^\p{L}\p{N}\u4e00-\u9fa5_-]/gu, ""))
    .filter(Boolean)
    .slice(0, 5);

  return {
    title: metadata.title,
    summary: metadata.description || metadata.textSample.slice(0, 120) || "已保存该网页，暂无可用摘要。",
    category,
    tags: [...new Set(tags)],
    confidence: 0.45
  };
}

export async function classifyBookmark(metadata: PageMetadata): Promise<AiClassification> {
  if (!config.openaiApiKey) {
    return fallbackClassification(metadata);
  }

  const prompt = [
    "你是 Linka 的网页收藏整理助手。",
    "请根据网页信息生成简体中文整理结果，只返回 JSON，不要输出 Markdown。",
    "JSON 字段必须包含 title、summary、category、tags、confidence。",
    "summary 控制在一到三句话，tags 为 3 到 6 个短标签，不确定时 category 使用“未分类”。",
    "",
    `标题：${metadata.title}`,
    `域名：${metadata.domain}`,
    `描述：${metadata.description}`,
    `正文片段：${metadata.textSample}`
  ].join("\n");

  try {
    const response = await fetch(`${config.openaiBaseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.openaiApiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: config.openaiModel,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "你只输出严格 JSON。" },
          { role: "user", content: prompt }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`AI 服务返回 ${response.status}`);
    }

    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as Partial<AiClassification>;

    return {
      title: String(parsed.title || metadata.title),
      summary: String(parsed.summary || metadata.description || "已保存该网页。"),
      category: String(parsed.category || "未分类"),
      tags: uniqueTags(parsed.tags),
      confidence: Number(parsed.confidence ?? 0.7)
    };
  } catch {
    return fallbackClassification(metadata);
  }
}

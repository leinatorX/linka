// 网络搜索与网页内容抓取服务。
// 支持 Tavily、Brave Search 和 SearXNG 三种搜索引擎。
// 设置持久化复用 settings 表，模式与 weather.ts 一致。

import { db } from "../db.js";
import { getDomain } from "../utils/url.js";

// ---- 类型定义 ----

export type SearchEngine = "tavily" | "brave" | "searxng";

export interface WebSearchSettings {
  enabled: boolean;
  engine: SearchEngine;
  apiKey: string;
  baseUrl: string;       // SearXNG 自托管地址
  maxResults: number;    // 3 ~ 10
}

export interface PublicWebSearchSettings {
  enabled: boolean;
  engine: SearchEngine;
  apiKey: string;
  baseUrl: string;
  maxResults: number;
}

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

// ---- 设置持久化 ----

const SETTINGS_KEY = "search";
const selectSetting = db.prepare("SELECT value FROM settings WHERE key = ?");
const upsertSetting = db.prepare(`
  INSERT INTO settings (key, value, updated_at)
  VALUES (?, ?, ?)
  ON CONFLICT(key) DO UPDATE SET
    value = excluded.value,
    updated_at = excluded.updated_at
`);

const DEFAULT_SEARCH_SETTINGS: WebSearchSettings = {
  enabled: false,
  engine: "tavily",
  apiKey: "",
  baseUrl: "",
  maxResults: 5
};

export function getSearchSettings(): WebSearchSettings {
  const row = selectSetting.get(SETTINGS_KEY) as { value: string } | undefined;
  if (!row) {
    return DEFAULT_SEARCH_SETTINGS;
  }
  try {
    const parsed = JSON.parse(row.value) as Partial<WebSearchSettings>;
    return {
      enabled: Boolean(parsed.enabled),
      engine: normalizeEngine(parsed.engine),
      apiKey: String(parsed.apiKey ?? ""),
      baseUrl: String(parsed.baseUrl ?? "").trim().replace(/\/$/, ""),
      maxResults: normalizeMaxResults(parsed.maxResults)
    };
  } catch {
    return DEFAULT_SEARCH_SETTINGS;
  }
}

export function getPublicSearchSettings(): PublicWebSearchSettings {
  const settings = getSearchSettings();
  return {
    enabled: settings.enabled,
    engine: settings.engine,
    apiKey: settings.apiKey,
    baseUrl: settings.baseUrl,
    maxResults: settings.maxResults
  };
}

export function saveSearchSettings(value: Partial<WebSearchSettings>): PublicWebSearchSettings {
  const current = getSearchSettings();
  const next: WebSearchSettings = {
    enabled: value.enabled ?? current.enabled,
    engine: normalizeEngine(value.engine ?? current.engine),
    apiKey: value.apiKey !== undefined ? value.apiKey : current.apiKey,
    baseUrl: String(value.baseUrl ?? current.baseUrl).trim().replace(/\/$/, ""),
    maxResults: normalizeMaxResults(value.maxResults ?? current.maxResults)
  };
  upsertSetting.run(SETTINGS_KEY, JSON.stringify(next), new Date().toISOString());
  return getPublicSearchSettings();
}

/** 快速判断搜索功能是否可用（已启用且有必要的凭据） */
export function isSearchEnabled(): boolean {
  const settings = getSearchSettings();
  if (!settings.enabled) {
    return false;
  }
  // SearXNG 不需要 API Key，只需要地址
  if (settings.engine === "searxng") {
    return Boolean(settings.baseUrl);
  }
  // Tavily 和 Brave 需要 API Key
  return Boolean(settings.apiKey);
}

// ---- 搜索引擎实现 ----

/** 统一搜索入口，根据配置的引擎分发到具体实现 */
export async function searchWeb(query: string): Promise<WebSearchResult[]> {
  const settings = getSearchSettings();
  if (!settings.enabled) {
    throw new Error("网络搜索未启用。");
  }

  switch (settings.engine) {
    case "tavily":
      return searchTavily(query, settings);
    case "brave":
      return searchBrave(query, settings);
    case "searxng":
      return searchSearXNG(query, settings);
    default:
      throw new Error(`不支持的搜索引擎：${settings.engine}`);
  }
}

/** Tavily Search API — 专为 AI Agent 设计的搜索服务 */
async function searchTavily(query: string, settings: WebSearchSettings): Promise<WebSearchResult[]> {
  if (!settings.apiKey) {
    throw new Error("Tavily API Key 未配置。");
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: settings.apiKey,
      query,
      max_results: settings.maxResults,
      include_answer: false,
      search_depth: "basic"
    }),
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    throw new Error(`Tavily 搜索失败：${response.status} ${(await response.text()).slice(0, 200)}`);
  }

  const payload = await response.json() as {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };

  return (payload.results ?? []).slice(0, settings.maxResults).map((item) => ({
    title: String(item.title ?? ""),
    url: String(item.url ?? ""),
    snippet: String(item.content ?? "").slice(0, 300)
  }));
}

/** Brave Search API — 隐私友好的搜索引擎 */
async function searchBrave(query: string, settings: WebSearchSettings): Promise<WebSearchResult[]> {
  if (!settings.apiKey) {
    throw new Error("Brave Search API Key 未配置。");
  }

  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(settings.maxResults));

  const response = await fetch(url.toString(), {
    headers: {
      "accept": "application/json",
      "accept-encoding": "gzip",
      "x-subscription-token": settings.apiKey
    },
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    throw new Error(`Brave 搜索失败：${response.status} ${(await response.text()).slice(0, 200)}`);
  }

  const payload = await response.json() as {
    web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
  };

  return (payload.web?.results ?? []).slice(0, settings.maxResults).map((item) => ({
    title: String(item.title ?? ""),
    url: String(item.url ?? ""),
    snippet: String(item.description ?? "").slice(0, 300)
  }));
}

/** SearXNG — 自托管的元搜索引擎 */
async function searchSearXNG(query: string, settings: WebSearchSettings): Promise<WebSearchResult[]> {
  if (!settings.baseUrl) {
    throw new Error("SearXNG 地址未配置。");
  }

  const url = new URL("/search", settings.baseUrl);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("pageno", "1");

  const response = await fetch(url.toString(), {
    headers: { "accept": "application/json" },
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    throw new Error(`SearXNG 搜索失败：${response.status} ${(await response.text()).slice(0, 200)}`);
  }

  const payload = await response.json() as {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };

  return (payload.results ?? []).slice(0, settings.maxResults).map((item) => ({
    title: String(item.title ?? ""),
    url: String(item.url ?? ""),
    snippet: String(item.content ?? "").slice(0, 300)
  }));
}

// ---- 网页内容抓取 ----

// 内网 / 本地地址黑名单，防止 SSRF 攻击
const BLOCKED_HOSTNAMES = new Set([
  "localhost", "127.0.0.1", "0.0.0.0", "[::1]"
]);

function isBlockedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    if (BLOCKED_HOSTNAMES.has(hostname)) {
      return true;
    }
    // 阻止内网 IP 段
    if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(hostname)) {
      return true;
    }
    return false;
  } catch {
    return true;
  }
}

/** 抓取 URL 的正文内容，清洗 HTML 后返回纯文本（截断到 ~8000 字符） */
export async function fetchWebContent(url: string): Promise<string> {
  if (isBlockedUrl(url)) {
    throw new Error("出于安全原因，不允许抓取内网或本地地址。");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "Linka/0.1 bookmark organizer",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });

    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok) {
      throw new Error(`网页请求失败：HTTP ${response.status}`);
    }

    // 非 HTML 页面返回状态信息
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      const text = (await response.text()).slice(0, 8000);
      return `[${contentType}] ${text}`;
    }

    const html = (await response.text()).slice(0, 800000);
    const domain = getDomain(url);
    const title = extractTitle(html);
    const body = extractBodyText(html);

    return [
      `来源：${domain}`,
      title ? `标题：${title}` : "",
      "",
      body
    ].filter(Boolean).join("\n").slice(0, 8000);
  } finally {
    clearTimeout(timeout);
  }
}

// ---- 工具函数 ----

function normalizeEngine(value: unknown): SearchEngine {
  const engines: SearchEngine[] = ["tavily", "brave", "searxng"];
  return engines.includes(value as SearchEngine) ? (value as SearchEngine) : "tavily";
}

function normalizeMaxResults(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 5;
  return Math.min(Math.max(Math.round(n), 3), 10);
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeHtml(match[1]) : "";
}

/** 从 HTML 中提取正文内容，去除导航、脚本、样式等非正文标签 */
function extractBodyText(html: string): string {
  return decodeHtml(
    html
      // 移除脚本和样式
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      // 移除常见的非正文结构标签内容
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<header[\s\S]*?<\/header>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
      .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
      // 移除所有 HTML 标签
      .replace(/<[^>]+>/g, " ")
      // 压缩空白
      .replace(/\s+/g, " ")
  ).slice(0, 8000);
}

/** 将搜索结果格式化为 AI 可读的文本上下文 */
export function formatSearchResults(results: WebSearchResult[]): string {
  if (!results.length) {
    return "网络搜索未返回任何结果。";
  }

  return results.map((result, index) => [
    `${index + 1}. ${result.title}`,
    `链接：${result.url}`,
    `摘要：${result.snippet}`
  ].join("\n")).join("\n\n");
}

import type { AssistantToolPlan } from "./ai.js";
import { createBookmark, deleteBookmark, getBookmarkById, listBookmarks, updateBookmark } from "./bookmarks.js";
import { createCategory, deleteCategory, listCategories, updateCategory } from "./categories.js";
import { extractFirstUrl, isValidUrl, normalizeUrl } from "../utils/url.js";
import { fetchWebContent, formatSearchResults, searchWeb } from "./webSearch.js";

export interface AssistantToolResult {
  type: "bookmark_saved" | "search_results" | "message" | "tool_result" | "web_context" | "confirmation_request";
  message: string;
  action?: string;
  bookmark?: ReturnType<typeof listBookmarks>[number];
  results?: ReturnType<typeof listBookmarks>;
  changed?: boolean;
  categoriesChanged?: boolean;
}

export interface AssistantToolContext {
  activeCategory?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function hasConfirmation(message: string) {
  return /确认删除|确认执行|确认操作|确定删除|请删除/.test(message);
}

function isRealCategoryName(value: string) {
  return Boolean(value && !/^(首页|全部|所有|未指定)$/.test(value));
}

function pickCategoryFromMessage(message: string) {
  return listCategories().find((category) => message.includes(category.name))?.name;
}

function pickDefaultCategory(message: string, context?: AssistantToolContext) {
  return pickCategoryFromMessage(message) || (isRealCategoryName(context?.activeCategory ?? "") ? context?.activeCategory : undefined);
}

function extractUrls(text: string) {
  return [...text.matchAll(/https?:\/\/[^\s<>"']+/gi)]
    .map((match) => match[0].replace(/[，。！？；：、)\]}]+$/u, ""))
    .filter(isValidUrl);
}

function findBookmarkByUrl(url: string) {
  let normalizedUrl = "";
  try {
    normalizedUrl = normalizeUrl(url);
  } catch {
    return null;
  }

  return listBookmarks({ archived: false }).find((bookmark) => (
    bookmark.normalizedUrl === normalizedUrl || bookmark.url === url
  )) ?? null;
}

function pickRecentBookmarkFromHistory(context?: AssistantToolContext) {
  const history = context?.history ?? [];
  for (const item of [...history].reverse()) {
    for (const url of extractUrls(item.content).reverse()) {
      const bookmark = findBookmarkByUrl(url);
      if (bookmark) {
        return bookmark;
      }
    }
  }

  return null;
}

function pickRecentCategoryFromHistory(context?: AssistantToolContext) {
  const history = context?.history ?? [];
  for (const item of [...history].reverse()) {
    const category = pickCategoryFromMessage(item.content);
    if (category) {
      return category;
    }
  }

  return undefined;
}

function isMoveToCategoryIntent(message: string) {
  return /(放入|放到|放进|移到|移动到|挪到|归类到|分到|加到).*(分类|资源|工具|平台|云盘|应用)?/.test(message);
}

function isAffirmativeReply(message: string) {
  return /^(是|是的|对|对的|可以|好|好的|行|确认|没错|帮我移|移吧|可以的)[\s。！!]*$/.test(message.trim());
}

function inferSlashCommandToolPlan(message: string): AssistantToolPlan | null {
  const normalized = message.trim();
  const match = normalized.match(/^\/(搜索|搜尋|搜寻|search|联网搜索|網絡搜索|网络搜索|fetch|抓取|读取网页|讀取網頁)\s+([\s\S]+)$/i);
  if (!match) {
    return null;
  }

  const command = match[1].toLowerCase();
  const value = match[2].trim();
  if (!value) {
    return null;
  }

  if (/^(fetch|抓取|读取网页|讀取網頁)$/i.test(command)) {
    return {
      tool: "web_fetch",
      arguments: { url: value },
      confidence: 1,
      requiresConfirmation: false,
      reason: "用户通过 Slash 命令要求抓取指定网页内容。"
    };
  }

  return {
    tool: "web_search",
    arguments: { query: value },
    confidence: 1,
    requiresConfirmation: false,
    reason: "用户通过 Slash 命令要求联网搜索。"
  };
}

function isLocalSearchIntent(message: string) {
  return /(书签|收藏|收藏夹|分类|Linka|本地|已保存|已收录)/i.test(message);
}

function isVagueSearchQuery(query: string) {
  return /^(一下|一下啊|一下吧|下|啊|吧|这个|这个吧|刚才那个|上面那个|继续|搜一下|搜索一下)[\s。！!]*$/i.test(query.trim());
}

function extractRecentSearchTopic(context?: AssistantToolContext) {
  const history = context?.history ?? [];
  for (const item of [...history].reverse()) {
    if (item.role !== "user") {
      continue;
    }

    const content = item.content.trim();
    if (!content || isLocalSearchIntent(content) || isVagueSearchQuery(content)) {
      continue;
    }

    const slashPlan = inferSlashCommandToolPlan(content);
    if (slashPlan?.tool === "web_search") {
      return asText(slashPlan.arguments.query);
    }

    const explicitMatch = content.match(/^(?:帮我|请|麻烦)?(?:联网)?(?:搜索|搜一下|查一下|查询|查找|网上搜|網上搜|搜索一下)\s*([\s\S]+)$/i);
    const explicitQuery = explicitMatch?.[1]?.trim();
    if (explicitQuery && !isVagueSearchQuery(explicitQuery)) {
      return explicitQuery;
    }

    return content;
  }

  return "";
}

function isTimelyExternalInfoQuery(message: string) {
  if (isLocalSearchIntent(message)) {
    return false;
  }

  return /(新闻|資訊|资讯|最新|今日|今天|现在|实时|热点|赛程|比分|价格|股价|天气|预警|名单|阵容|排名|结果|开奖结果|发布|更新|公告)/i.test(message);
}

function inferDirectWebSearchToolPlan(message: string, context?: AssistantToolContext): AssistantToolPlan | null {
  const normalized = message.trim();
  if (!normalized || /^[/$@]/.test(normalized)) {
    return null;
  }

  // 明确指向 Linka 内部内容时保留给书签/分类工具链处理。
  if (isLocalSearchIntent(normalized)) {
    return null;
  }

  const match = normalized.match(/^(?:帮我|请|麻烦)?(?:联网)?(?:搜索|搜一下|查一下|查询|查找|网上搜|網上搜|搜索一下)\s*([\s\S]*)$/i);
  let query = match?.[1]?.trim() ?? "";
  if (match && !query) {
    query = extractRecentSearchTopic(context);
  }
  if (query && isVagueSearchQuery(query)) {
    query = extractRecentSearchTopic(context);
  }

  if (!query && isTimelyExternalInfoQuery(normalized)) {
    query = normalized;
  }

  if (!query) {
    return null;
  }

  return {
    tool: "web_search",
    arguments: { query },
    confidence: 1,
    requiresConfirmation: false,
    reason: "用户直接要求搜索外部信息，且没有指向本地书签。"
  };
}

export function inferAssistantToolPlan(message: string, context?: AssistantToolContext): AssistantToolPlan | null {
  const slashCommandPlan = inferSlashCommandToolPlan(message);
  if (slashCommandPlan) {
    return slashCommandPlan;
  }

  const directWebSearchPlan = inferDirectWebSearchToolPlan(message, context);
  if (directWebSearchPlan) {
    return directWebSearchPlan;
  }

  const url = extractFirstUrl(message);
  if (!url || !isValidUrl(url)) {
    const category = pickCategoryFromMessage(message) || (isAffirmativeReply(message) ? pickRecentCategoryFromHistory(context) : undefined);
    const bookmark = pickRecentBookmarkFromHistory(context);
    if (category && bookmark && (isMoveToCategoryIntent(message) || isAffirmativeReply(message))) {
      return {
        tool: "move_bookmarks_to_category",
        arguments: {
          id: bookmark.id,
          to: category
        },
        confidence: 1,
        requiresConfirmation: false,
        reason: "用户要求把最近提到的书签移动到指定分类。"
      };
    }

    return null;
  }

  if (!/(收藏|添加|加入|保存|收录|记下|加到|放到|添加到)(?:.*?(书签|收藏夹|分类|资源))?/.test(message)) {
    return null;
  }

  const category = pickDefaultCategory(message, context);
  return {
    tool: "create_bookmark",
    arguments: {
      url,
      ...(category ? { category } : {})
    },
    confidence: 1,
    requiresConfirmation: false,
    reason: "用户提供了 URL，并明确要求添加为书签。"
  };
}

function formatBookmarkList(bookmarks: ReturnType<typeof listBookmarks>) {
  if (!bookmarks.length) {
    return "没有找到匹配的书签。";
  }

  return bookmarks.slice(0, 10).map((bookmark, index) => (
    [
      `${index + 1}. ${bookmark.title}`,
      `分类：${bookmark.category}`,
      bookmark.summary ? `摘要：${bookmark.summary}` : `网页描述：${bookmark.description || "暂无摘要"}`,
      `链接：${bookmark.url}`
    ].join("\n")
  )).join("\n\n");
}

function findCategory(value: string) {
  if (!value) {
    return null;
  }

  return listCategories().find((category) => category.id === value || category.name === value) ?? null;
}

function resolveBookmarks(args: Record<string, unknown>, context?: AssistantToolContext) {
  const id = asText(args.id);
  const query = asText(args.query || args.q || args.title || args.url);
  const category = asText(args.category || args.from);

  if (id) {
    const bookmark = getBookmarkById(id);
    return bookmark ? [bookmark] : [];
  }

  if (category && /全部|所有/.test(query || "")) {
    return listBookmarks({ category, archived: false });
  }

  if (query) {
    return listBookmarks({ q: query, archived: false });
  }

  if (category) {
    return listBookmarks({ category, archived: false });
  }

  const recentBookmark = pickRecentBookmarkFromHistory(context);
  return recentBookmark ? [recentBookmark] : [];
}

export async function executeAssistantToolPlan(plan: AssistantToolPlan, message: string, context?: AssistantToolContext): Promise<AssistantToolResult | null> {
  if (plan.tool === "none" || plan.confidence < 0.55) {
    return null;
  }

  const args = plan.arguments ?? {};

  if (plan.requiresConfirmation && !hasConfirmation(message)) {
    return {
      type: "confirmation_request",
      message: `这个操作可能会修改或删除数据。我理解的操作是：${plan.reason || plan.tool}。需确认以防误删。`,
      action: "确认执行"
    };
  }

  if (plan.tool === "list_bookmarks") {
    const results = listBookmarks({
      q: asText(args.q || args.query),
      category: asText(args.category) || undefined,
      archived: asBoolean(args.archived)
    }).slice(0, 20);
    return {
      type: "search_results",
      message: results.length ? `找到 ${results.length} 条匹配书签：\n\n${formatBookmarkList(results)}` : "没有找到匹配的书签。",
      results
    };
  }

  if (plan.tool === "create_bookmark") {
    const url = asText(args.url);
    if (!isValidUrl(url)) {
      return { type: "message", message: "我没有找到有效 URL，无法创建书签。" };
    }

    const category = asText(args.category) || pickDefaultCategory(message, context) || "";
    if (category) {
      createCategory(category);
    }
    const result = await createBookmark({
      url,
      title: asText(args.title) || undefined,
      category: category || undefined,
      source: "assistant_tool"
    });
    return {
      type: "bookmark_saved",
      message: result.status === "exists" ? "这个链接已经在收藏夹里。" : `已收藏「${result.bookmark.title}」，归类到「${result.bookmark.category}」。`,
      bookmark: result.bookmark,
      changed: result.status !== "exists",
      categoriesChanged: Boolean(category)
    };
  }

  if (plan.tool === "list_categories") {
    const categories = listCategories();
    return {
      type: "tool_result",
      message: categories.length ? `当前共有 ${categories.length} 个分类：${categories.map((category) => category.name).join("、")}` : "当前还没有分类。"
    };
  }

  if (plan.tool === "create_category") {
    const name = asText(args.name || args.category);
    if (!name) {
      return { type: "message", message: "请告诉我要创建的分类名称。" };
    }

    const category = createCategory(name);
    return {
      type: "tool_result",
      message: `已创建分类「${category.name}」。`,
      changed: true,
      categoriesChanged: true
    };
  }

  if (plan.tool === "update_category") {
    const from = asText(args.id || args.from || args.category);
    const name = asText(args.name || args.to);
    const category = findCategory(from);
    if (!category || !name) {
      return { type: "message", message: "没有找到要修改的分类，或缺少新的分类名称。" };
    }

    let updated;
    try {
      updated = updateCategory(category.id, name);
    } catch {
      return { type: "message", message: "这个分类名称已经存在，不能重复命名。" };
    }
    if (!updated) {
      return { type: "message", message: "这个分类不存在或不可修改。" };
    }

    return {
      type: "tool_result",
      message: `已将分类「${category.name}」改为「${updated.name}」。`,
      changed: true,
      categoriesChanged: true
    };
  }

  if (plan.tool === "delete_category") {
    const target = findCategory(asText(args.id || args.name || args.category));
    if (!target) {
      return { type: "message", message: "没有找到要删除的分类。" };
    }

    if (!hasConfirmation(message)) {
      return { type: "message", message: `删除分类「${target.name}」会把相关书签归入“未分类”。请明确回复“确认删除分类 ${target.name}”。` };
    }

    const deleted = deleteCategory(target.id);
    return {
      type: "tool_result",
      message: deleted ? `已删除分类「${target.name}」，相关书签已归入“未分类”。` : "这个分类不存在或不可删除。",
      changed: deleted,
      categoriesChanged: deleted
    };
  }

  if (plan.tool === "move_bookmarks_to_category") {
    const category = asText(args.to || args.category || args.name);
    const targets = resolveBookmarks(args, context);
    if (!category) {
      return { type: "message", message: "请告诉我要移动到哪个分类。" };
    }
    if (!targets.length) {
      return { type: "message", message: "没有找到要移动的书签。" };
    }
    if (!hasConfirmation(message) && targets.length > 1) {
      return {
        type: "confirmation_request",
        message: `这会修改 ${targets.length} 条书签的分类。请确认执行。`,
        action: "确认执行"
      };
    }

    createCategory(category);
    const updated = targets.map((bookmark) => updateBookmark(bookmark.id, { category })).filter(Boolean);
    return {
      type: "tool_result",
      message: `已将 ${updated.length} 条书签移动到「${category}」。`,
      results: updated as ReturnType<typeof listBookmarks>,
      changed: updated.length > 0,
      categoriesChanged: true
    };
  }

  if (plan.tool === "archive_bookmark" || plan.tool === "pin_bookmark" || plan.tool === "update_bookmark") {
    const targets = resolveBookmarks(args, context);
    if (!targets.length) {
      return { type: "message", message: "没有找到要修改的书签。" };
    }
    if (targets.length > 1) {
      return {
        type: "search_results",
        message: `找到 ${targets.length} 条可能匹配的书签，请用更精确的标题或链接再试：\n\n${formatBookmarkList(targets)}`,
        results: targets
      };
    }

    const patch: Record<string, unknown> = {};
    if (plan.tool === "archive_bookmark") {
      patch.archived = asBoolean(args.archived) ?? true;
    } else if (plan.tool === "pin_bookmark") {
      patch.pinned = asBoolean(args.pinned) ?? true;
    } else {
      const title = asText(args.title);
      const summary = asText(args.summary || args.description);
      const category = asText(args.category);
      if (title) patch.title = title;
      if (summary) patch.summary = summary;
      if (category) {
        createCategory(category);
        patch.category = category;
      }
    }

    const updated = updateBookmark(targets[0].id, patch);
    if (!updated) {
      return { type: "message", message: "修改书签失败，可能书签已经不存在。" };
    }

    return {
      type: "tool_result",
      message: `已更新书签「${updated.title}」。`,
      bookmark: updated,
      results: [updated],
      changed: true,
      categoriesChanged: Boolean(patch.category)
    };
  }

  if (plan.tool === "delete_bookmark") {
    const targets = resolveBookmarks(args, context);
    if (!targets.length) {
      return { type: "message", message: "没有找到要删除的书签。" };
    }
    if (targets.length > 1) {
      return {
        type: "search_results",
        message: `找到 ${targets.length} 条可能匹配的书签。为了避免误删，请用更精确的标题或链接，并明确写“确认删除”：\n\n${formatBookmarkList(targets)}`,
        results: targets
      };
    }
    if (!hasConfirmation(message)) {
      return { type: "message", message: `请明确回复“确认删除 ${targets[0].title}”，我再删除这条书签。` };
    }

    const deleted = deleteBookmark(targets[0].id);
    return {
      type: "tool_result",
      message: deleted ? `已删除书签「${targets[0].title}」。` : "删除失败，书签可能已经不存在。",
      changed: deleted
    };
  }

  if (plan.tool === "web_search") {
    const query = asText(args.query || args.q);
    if (!query) {
      return { type: "message", message: "搜索内容不能为空。" };
    }
    try {
      const results = await searchWeb(query);
      return {
        type: "web_context",
        message: formatSearchResults(results)
      };
    } catch (e: any) {
      return { type: "message", message: `搜索失败：${e.message}` };
    }
  }

  if (plan.tool === "web_fetch") {
    const url = asText(args.url);
    if (!isValidUrl(url)) {
      return { type: "message", message: "提供的 URL 无效。" };
    }
    try {
      const content = await fetchWebContent(url);
      return {
        type: "web_context",
        message: content
      };
    } catch (e: any) {
      return { type: "message", message: `抓取网页内容失败：${e.message}` };
    }
  }

  return null;
}

export function getAssistantNativeOpenAiTools(options: { webSearchEnabled?: boolean } = {}) {
  const tools: Array<{
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }> = [
    {
      type: "function",
      function: {
        name: "list_bookmarks",
        description: "按关键词、分类或归档状态查询本地书签",
        parameters: {
          type: "object",
          properties: {
            keyword: { type: "string", description: "搜索关键词" },
            category: { type: "string", description: "分类名称" },
            archived: { type: "boolean", description: "是否已被归档" }
          }
        }
      }
    },
    {
      type: "function",
      function: {
        name: "create_bookmark",
        description: "创建/保存新书签到书签库",
        parameters: {
          type: "object",
          properties: {
            url: { type: "string", description: "书签完整的网址 URL" },
            title: { type: "string", description: "书签标题" },
            category: { type: "string", description: "保存到的分类名称" },
            description: { type: "string", description: "描述或备注" }
          },
          required: ["url"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "update_bookmark",
        description: "更新指定书签的信息（如修改标题、分类、描述）",
        parameters: {
          type: "object",
          properties: {
            id: { type: "string", description: "书签 ID" },
            title: { type: "string", description: "新标题" },
            category: { type: "string", description: "新分类" },
            description: { type: "string", description: "新描述" }
          }
        }
      }
    },
    {
      type: "function",
      function: {
        name: "delete_bookmark",
        description: "删除指定的书签（危险操作）",
        parameters: {
          type: "object",
          properties: {
            id: { type: "string", description: "书签 ID" },
            title: { type: "string", description: "书签标题" }
          }
        }
      }
    },
    {
      type: "function",
      function: {
        name: "list_categories",
        description: "列出当前系统中的所有书签分类",
        parameters: {
          type: "object",
          properties: {}
        }
      }
    },
    {
      type: "function",
      function: {
        name: "create_category",
        description: "创建新的书签分类",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string", description: "分类名称" },
            color: { type: "string", description: "可选分类颜色十六进制码" }
          },
          required: ["name"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "move_bookmarks_to_category",
        description: "移动书签到指定的分类",
        parameters: {
          type: "object",
          properties: {
            id: { type: "string", description: "书签 ID" },
            to: { type: "string", description: "目标分类名称" }
          },
          required: ["to"]
        }
      }
    }
  ];

  if (options.webSearchEnabled) {
    tools.push(
      {
        type: "function",
        function: {
          name: "web_search",
          description: "使用搜索引擎进行实时网页搜索",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "搜索关键词" }
            },
            required: ["query"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "web_fetch",
          description: "抓取并读取具体网页的内容",
          parameters: {
            type: "object",
            properties: {
              url: { type: "string", description: "目标网页的完整 URL" }
            },
            required: ["url"]
          }
        }
      }
    );
  }

  return tools;
}

export function getAssistantNativeAnthropicTools(options: { webSearchEnabled?: boolean } = {}) {
  const openAiTools = getAssistantNativeOpenAiTools(options);
  return openAiTools.map((item) => ({
    name: item.function.name,
    description: item.function.description,
    input_schema: item.function.parameters
  }));
}

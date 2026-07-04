import type { AssistantToolPlan } from "./ai.js";
import { createBookmark, deleteBookmark, getBookmarkById, listBookmarks, updateBookmark } from "./bookmarks.js";
import { createCategory, deleteCategory, listCategories, updateCategory } from "./categories.js";
import { isValidUrl } from "../utils/url.js";

export interface AssistantToolResult {
  type: "bookmark_saved" | "search_results" | "message" | "tool_result";
  message: string;
  bookmark?: ReturnType<typeof listBookmarks>[number];
  results?: ReturnType<typeof listBookmarks>;
  changed?: boolean;
  categoriesChanged?: boolean;
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

function formatBookmarkList(bookmarks: ReturnType<typeof listBookmarks>) {
  if (!bookmarks.length) {
    return "没有找到匹配的书签。";
  }

  return bookmarks.slice(0, 10).map((bookmark, index) => (
    `${index + 1}. ${bookmark.title}\n分类：${bookmark.category}\n链接：${bookmark.url}`
  )).join("\n\n");
}

function findCategory(value: string) {
  if (!value) {
    return null;
  }

  return listCategories().find((category) => category.id === value || category.name === value) ?? null;
}

function resolveBookmarks(args: Record<string, unknown>) {
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

  return [];
}

export async function executeAssistantToolPlan(plan: AssistantToolPlan, message: string): Promise<AssistantToolResult | null> {
  if (plan.tool === "none" || plan.confidence < 0.55) {
    return null;
  }

  const args = plan.arguments ?? {};

  if (plan.requiresConfirmation && !hasConfirmation(message)) {
    return {
      type: "message",
      message: `这个操作可能会修改或删除数据。我理解的操作是：${plan.reason || plan.tool}。请在同一句里明确写“确认执行”或“确认删除”后再让我执行。`
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

    const category = asText(args.category);
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
    const targets = resolveBookmarks(args);
    if (!category) {
      return { type: "message", message: "请告诉我要移动到哪个分类。" };
    }
    if (!targets.length) {
      return { type: "message", message: "没有找到要移动的书签。" };
    }
    if (targets.length > 5 && !hasConfirmation(message)) {
      return { type: "message", message: `这会修改 ${targets.length} 条书签的分类。请明确回复“确认执行”后再让我处理。` };
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
    const targets = resolveBookmarks(args);
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
      const summary = asText(args.summary);
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
    const targets = resolveBookmarks(args);
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

  return null;
}

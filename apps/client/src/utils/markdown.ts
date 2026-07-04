import { marked } from "marked";

// 渲染 AI 助手消息中的 markdown 文本。
// 设计：让 marked 走默认 renderer 完整输出，然后在 DOMParser 阶段做白名单净化与链接加固。
// 关键点：
// 1. GFM + 单换行变 <br>，匹配模型自然分段。
// 2. async: false 走同步 parse 路径，避免返回 Promise。
// 3. 不重写 Renderer.link（marked 14 token API 易踩坑），改在 DOMParser 阶段统一处理。
// 4. DOMParser 阶段：白名单标签、剥离 on* 事件、链接协议校验、补 target/rel。

const ALLOWED_LINK_PROTOCOLS = /^(https?:|mailto:|#|\/)/i;

function sanitizeLinkHref(href: string): string | null {
  if (!ALLOWED_LINK_PROTOCOLS.test(href)) {
    return null;
  }
  return href;
}

marked.setOptions({
  gfm: true,
  breaks: true,
  async: false
});

// 白名单：a / strong / em / code / pre / 列表 / 标题 / 引用 / 分割线 / 表格 / del / span
const ALLOWED_TAGS = new Set([
  "a", "strong", "em", "code", "pre",
  "ul", "ol", "li", "p", "br",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "blockquote", "hr", "table", "thead", "tbody", "tr", "td", "th",
  "del", "span"
]);

// a 标签允许的属性：href / target / rel
const ALLOWED_ATTRS_BY_TAG: Record<string, Set<string>> = {
  a: new Set(["href", "target", "rel"]),
  code: new Set(["class"]), // marked 会给围栏代码块加 class="language-xxx"
  pre: new Set([]),
  span: new Set([])
};

function sanitizeWithDom(html: string): string {
  if (typeof DOMParser === "undefined") {
    return html;
  }
  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, "text/html");
  const root = doc.getElementById("root");
  if (!root) {
    return "";
  }
  walk(root, doc);
  return root.innerHTML;

  function walk(node: Element, ownerDoc: Document) {
    // 用 children 快照遍历，因为我们会改写子树
    const children = Array.from(node.children);
    for (const child of children) {
      const tag = child.tagName.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) {
        // 非白名单标签"降级"为纯文本节点保留内容
        const text = ownerDoc.createTextNode(child.textContent ?? "");
        child.replaceWith(text);
        continue;
      }
      // 清理属性
      const allowedAttrs = ALLOWED_ATTRS_BY_TAG[tag];
      for (const attr of Array.from(child.attributes)) {
        const name = attr.name.toLowerCase();
        // 任何 on* 事件一律移除
        if (name.startsWith("on")) {
          child.removeAttribute(attr.name);
          continue;
        }
        // a 标签的 href 走协议白名单
        if (tag === "a" && name === "href") {
          const safeHref = sanitizeLinkHref(attr.value);
          if (!safeHref) {
            child.removeAttribute("href");
          } else {
            child.setAttribute("href", safeHref);
          }
          continue;
        }
        // 不在白名单里的属性一律移除
        if (allowedAttrs && !allowedAttrs.has(name)) {
          child.removeAttribute(attr.name);
          continue;
        }
        if (!allowedAttrs) {
          // 未声明的标签不允许任何属性
          child.removeAttribute(attr.name);
        }
      }
      // a 标签补 target/rel（外链 SPA 安全）
      if (tag === "a" && child.hasAttribute("href")) {
        const href = child.getAttribute("href") || "";
        if (/^https?:/i.test(href)) {
          child.setAttribute("target", "_blank");
          child.setAttribute("rel", "noopener noreferrer");
        }
      }
      walk(child, ownerDoc);
    }
  }
}

export function renderAssistantMarkdown(text: string): string {
  if (!text) {
    return "";
  }
  // 防御性 try-catch：marked 偶尔会因边缘语法抛错，必须保证 AssistantPanel 不被错误卸载。
  let html: string;
  try {
    html = marked.parse(text) as string;
  } catch {
    // 解析失败时降级为转义后的纯文本
    return escapeHtml(text);
  }
  return sanitizeWithDom(html);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

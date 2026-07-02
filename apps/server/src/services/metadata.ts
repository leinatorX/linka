import { getDomain } from "../utils/url.js";

export interface PageMetadata {
  title: string;
  description: string;
  faviconUrl: string;
  coverImageUrl: string;
  domain: string;
  textSample: string;
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

function pickMeta(html: string, names: string[]): string {
  for (const name of names) {
    const patterns = [
      new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["'][^>]*>`, "i")
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) {
        return decodeHtml(match[1]);
      }
    }
  }

  return "";
}

function absolutize(baseUrl: string, value: string): string {
  if (!value) {
    return "";
  }

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return "";
  }
}

function extractTextSample(html: string): string {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .slice(0, 6000)
  ).slice(0, 1200);
}

export async function fetchPageMetadata(url: string): Promise<PageMetadata> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "Linka/0.1 bookmark organizer",
        accept: "text/html,application/xhtml+xml"
      }
    });

    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.includes("text/html")) {
      throw new Error("网页不可访问或不是 HTML 页面");
    }

    const html = (await response.text()).slice(0, 600000);
    const title = decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
    const description = pickMeta(html, ["description", "og:description", "twitter:description"]);
    const favicon = html.match(/<link[^>]+(?:rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']|href=["']([^"']+)["'][^>]+rel=["'][^"']*icon[^"']*["'])[^>]*>/i);
    const coverImage = pickMeta(html, ["og:image", "twitter:image"]);
    const domain = getDomain(url);

    return {
      title: title || domain,
      description,
      faviconUrl: absolutize(url, favicon?.[1] ?? favicon?.[2] ?? "/favicon.ico"),
      coverImageUrl: absolutize(url, coverImage),
      domain,
      textSample: extractTextSample(html)
    };
  } finally {
    clearTimeout(timeout);
  }
}

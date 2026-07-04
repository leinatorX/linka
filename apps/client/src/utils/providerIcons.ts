import type { AiProviderConfig } from "../types";

const PROVIDER_GRADIENTS: Record<string, string> = {
  openai: "background: linear-gradient(135deg, #10b981 0%, #059669 100%);",
  anthropic: "background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);",
  minimax: "background: linear-gradient(135deg, #e41c78 0%, #fd5b40 100%);",
  deepseek: "background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);",
  moonshot: "background: linear-gradient(135deg, #18181b 0%, #3f3f46 100%);",
  kimi: "background: linear-gradient(135deg, #18181b 0%, #3f3f46 100%);",
  zhipu: "background: linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%);",
  glm: "background: linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%);",
  xiaomi: "background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);",
  mimo: "background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);",
  qwen: "background: linear-gradient(135deg, #615ced 0%, #4338ca 100%);",
  doubao: "background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);",
  wenxin: "background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);",
  gemini: "background: linear-gradient(135deg, #4285f4 0%, #9b72cb 50%, #d96570 100%);",
  mistral: "background: linear-gradient(135deg, #facc15 0%, #ca8a04 100%);",
  cohere: "background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);",
  meta: "background: linear-gradient(135deg, #0866ff 0%, #0050cc 100%);",
  grok: "background: linear-gradient(135deg, #111827 0%, #1f2937 100%);",
  perplexity: "background: linear-gradient(135deg, #20b2aa 0%, #0f766e 100%);"
};

const BRAND_ICON_MAP: Record<string, string> = {
  minimax: "minimax",
  deepseek: "deepseek",
  openai: "openai",
  anthropic: "anthropic",
  moonshot: "moonshot",
  kimi: "kimi",
  zhipu: "zhipu",
  qwen: "qwen",
  doubao: "doubao",
  wenxin: "wenxin",
  gemini: "gemini",
  mistral: "mistral",
  cohere: "cohere",
  meta: "meta",
  grok: "grok",
  perplexity: "perplexity",
  cursor: "cursor"
};

export function getAvatarStyle(provider: Pick<AiProviderConfig, "id" | "name">) {
  const nameKey = provider.name.trim().toLowerCase();
  return PROVIDER_GRADIENTS[nameKey] ?? PROVIDER_GRADIENTS[provider.id] ?? "background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);";
}

export function getProviderIconUrl(provider: Pick<AiProviderConfig, "id" | "name">): string | null {
  const nameKey = provider.name.trim().toLowerCase();
  const slug = BRAND_ICON_MAP[nameKey] ?? BRAND_ICON_MAP[provider.id];
  return slug ? `/provider-icons/${slug}.svg` : null;
}

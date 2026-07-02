export function normalizeUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl.trim());
  parsed.hash = "";
  parsed.protocol = parsed.protocol.toLowerCase();
  parsed.hostname = parsed.hostname.toLowerCase();

  if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }

  return parsed.toString();
}

export function getDomain(rawUrl: string): string {
  return new URL(rawUrl).hostname.replace(/^www\./, "");
}

export function extractFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>"']+/i);
  return match?.[0] ?? null;
}

export function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

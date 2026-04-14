import { mkdir } from "node:fs/promises";

export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function keywordTokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4);
}

export function keywordCoverage(text: string, expected: string): number {
  const haystack = text.toLowerCase();
  const tokens = unique(keywordTokens(expected));
  if (tokens.length === 0) {
    return 1;
  }

  const hits = tokens.filter((token) => haystack.includes(token)).length;
  return hits / tokens.length;
}

export function pathLooksLike(pathname: string, ...keywords: string[]): boolean {
  const normalized = pathname.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
}

export function globToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const withGlob = escaped.replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp(`^${withGlob}$`, "i");
}

export function matchesAnyPattern(value: string, patterns: string[]): boolean {
  if (patterns.length === 0) {
    return false;
  }

  return patterns.some((pattern) => globToRegExp(pattern).test(value));
}

export function normalizeUrlPathname(url: string): string {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return "/";
  }
}

export function normalizeComparableUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }
    return url.toString();
  } catch {
    return value;
  }
}

export function normalizeDomain(value: string): string {
  try {
    return new URL(value.startsWith("http") ? value : `https://${value}`).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return value.replace(/^www\./, "").toLowerCase();
  }
}

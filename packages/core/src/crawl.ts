import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";
import { AI_BOTS } from "./constants.ts";
import type { CrawlOptions, CrawlResult, FetchedPage, RobotsSnapshot, SiteSource } from "./types.ts";
import { matchesAnyPattern, normalizeUrlPathname, pathLooksLike, unique } from "./utils.ts";

const xmlParser = new XMLParser({ ignoreAttributes: false });

function resolveSiteSource(siteInput: string): SiteSource {
  if (/^https?:\/\//i.test(siteInput)) {
    return {
      kind: "remote",
      input: siteInput,
      baseUrl: siteInput.endsWith("/") ? siteInput.slice(0, -1) : siteInput
    };
  }

  return {
    kind: "local",
    input: siteInput,
    baseUrl: "https://fixture.local",
    rootDir: path.resolve(siteInput)
  };
}

function buildUrl(source: SiteSource, target: string): string {
  if (/^https?:\/\//i.test(target)) {
    return target;
  }

  return target.startsWith("/") ? `${source.baseUrl}${target}` : `${source.baseUrl}/${target}`;
}

async function pathIsFile(filePath: string): Promise<boolean> {
  try {
    const details = await stat(filePath);
    return details.isFile();
  } catch {
    return false;
  }
}

async function findLocalFile(rootDir: string, pathname: string): Promise<string | null> {
  const trimmed = pathname.replace(/^\/+/, "");
  const candidates =
    trimmed === ""
      ? ["index.html"]
      : [trimmed, `${trimmed}.html`, path.join(trimmed, "index.html")];

  for (const candidate of candidates) {
    const fullPath = path.join(rootDir, candidate);
    if (await pathIsFile(fullPath)) {
      return fullPath;
    }
  }

  return null;
}

async function fetchLocalText(source: SiteSource, target: string): Promise<FetchedPage> {
  const url = buildUrl(source, target);
  const pathname = new URL(url).pathname;
  const filePath = await findLocalFile(source.rootDir!, pathname);

  if (!filePath) {
    return {
      url,
      status: 404,
      html: "",
      contentType: "text/plain",
      fetchError: `Local file not found for ${pathname}`
    };
  }

  const html = await readFile(filePath, "utf8");
  const extension = path.extname(filePath).toLowerCase();

  return {
    url,
    status: 200,
    html,
    contentType:
      extension === ".xml"
        ? "application/xml"
        : extension === ".txt"
          ? "text/plain"
          : "text/html"
  };
}

async function fetchRemoteText(source: SiteSource, target: string): Promise<FetchedPage> {
  const url = buildUrl(source, target);

  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "AnswerLens/0.1.0 (+https://github.com/example/answerlens)"
      },
      signal: AbortSignal.timeout(12000)
    });

    return {
      url,
      status: response.status,
      html: await response.text(),
      contentType: response.headers.get("content-type") ?? "text/plain",
      fetchError: response.ok ? undefined : `HTTP ${response.status}`
    };
  } catch (error) {
    return {
      url,
      status: 0,
      html: "",
      contentType: "text/plain",
      fetchError: error instanceof Error ? error.message : "Unknown fetch error"
    };
  }
}

async function fetchText(source: SiteSource, target: string): Promise<FetchedPage> {
  return source.kind === "local" ? fetchLocalText(source, target) : fetchRemoteText(source, target);
}

function parseRobots(text: string): RobotsSnapshot {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const sections = new Map<string, { disallows: string[] }>();
  const sitemapHints: string[] = [];
  let currentAgent = "*";

  for (const line of lines) {
    const [directiveRaw, ...rest] = line.split(":");
    if (!directiveRaw || rest.length === 0) continue;

    const directive = directiveRaw.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (!value) continue;

    if (directive === "sitemap") {
      sitemapHints.push(value);
      continue;
    }

    if (directive === "user-agent") {
      currentAgent = value;
      if (!sections.has(currentAgent)) {
        sections.set(currentAgent, { disallows: [] });
      }
      continue;
    }

    if (directive === "disallow") {
      const section = sections.get(currentAgent) ?? { disallows: [] };
      section.disallows.push(value);
      sections.set(currentAgent, section);
    }
  }

  const wildcard = sections.get("*");
  const blockedAiBots = AI_BOTS.filter((bot) => sections.get(bot)?.disallows.includes("/") ?? false);

  return {
    exists: text.trim().length > 0,
    text,
    blockedAll: wildcard?.disallows.includes("/") ?? false,
    blockedAiBots,
    sitemapHints
  };
}

function parseSitemapLocs(xml: string): string[] {
  if (!xml.trim()) return [];

  const parsed = xmlParser.parse(xml);
  const urlset = parsed?.urlset?.url;
  if (urlset) {
    const items = Array.isArray(urlset) ? urlset : [urlset];
    return items
      .map((item) => item?.loc)
      .filter((loc): loc is string => typeof loc === "string");
  }

  const sitemapIndex = parsed?.sitemapindex?.sitemap;
  if (sitemapIndex) {
    const items = Array.isArray(sitemapIndex) ? sitemapIndex : [sitemapIndex];
    return items
      .map((item) => item?.loc)
      .filter((loc): loc is string => typeof loc === "string");
  }

  return [];
}

async function discoverLocalHtmlUrls(source: SiteSource): Promise<string[]> {
  const urls: string[] = [];
  const rootDir = source.rootDir!;

  async function walk(dirPath: string): Promise<void> {
    const entries = await readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      if (!entry.name.endsWith(".html")) continue;

      const relative = path.relative(rootDir, fullPath).replace(/\\/g, "/");
      let pathname = relative.replace(/index\.html$/i, "").replace(/\.html$/i, "");
      pathname = pathname === "" ? "/" : `/${pathname}`.replace(/\/+/g, "/");
      urls.push(`${source.baseUrl}${pathname}`);
    }
  }

  await walk(rootDir);
  return unique(urls);
}

function prioritizeUrls(urls: string[]): string[] {
  return [...urls].sort((left, right) => {
    const leftPath = normalizeUrlPathname(left);
    const rightPath = normalizeUrlPathname(right);

    const rank = (pathname: string) => {
      if (pathname === "/") return 0;
      if (pathLooksLike(pathname, "pricing", "plans")) return 1;
      if (pathLooksLike(pathname, "security", "trust")) return 2;
      if (pathLooksLike(pathname, "faq")) return 3;
      if (pathLooksLike(pathname, "compare", "alternatives", "/vs")) return 4;
      if (pathLooksLike(pathname, "docs", "developers", "api")) return 5;
      if (pathLooksLike(pathname, "integrations")) return 6;
      if (pathLooksLike(pathname, "use-case", "solutions", "for-")) return 7;
      return 9;
    };

    return rank(leftPath) - rank(rightPath) || left.localeCompare(right);
  });
}

function shouldInclude(url: string, includePatterns: string[], excludePatterns: string[]): boolean {
  const pathname = normalizeUrlPathname(url);
  if (excludePatterns.length > 0 && (matchesAnyPattern(url, excludePatterns) || matchesAnyPattern(pathname, excludePatterns))) {
    return false;
  }

  if (includePatterns.length === 0) return true;
  return matchesAnyPattern(url, includePatterns) || matchesAnyPattern(pathname, includePatterns);
}

export async function crawlSite(options: CrawlOptions): Promise<CrawlResult> {
  const source = resolveSiteSource(options.siteInput);
  const robotsFetch = await fetchText(source, "/robots.txt");
  const robots = parseRobots(robotsFetch.status === 200 ? robotsFetch.html : "");

  const sitemapCandidates = unique([
    ...(options.sitemapUrl ? [options.sitemapUrl] : []),
    ...robots.sitemapHints,
    "/sitemap.xml",
    "/sitemap_index.xml"
  ]);

  const discovered: string[] = [];
  const visitedSitemaps = new Set<string>();

  for (const sitemapCandidate of sitemapCandidates) {
    const sitemapUrl = buildUrl(source, sitemapCandidate);
    if (visitedSitemaps.has(sitemapUrl)) continue;
    visitedSitemaps.add(sitemapUrl);

    const sitemapFetch = await fetchText(source, sitemapUrl);
    if (sitemapFetch.status !== 200 || !sitemapFetch.contentType.includes("xml")) continue;

    for (const loc of parseSitemapLocs(sitemapFetch.html)) {
      if (loc.endsWith(".xml")) {
        sitemapCandidates.push(loc);
        continue;
      }
      discovered.push(loc);
    }
  }

  const urls = discovered.length > 0 ? discovered : source.kind === "local" ? await discoverLocalHtmlUrls(source) : [source.baseUrl];
  const crawlTargets = prioritizeUrls(unique(urls))
    .filter((url) => shouldInclude(url, options.includePatterns, options.excludePatterns))
    .slice(0, options.maxPages);

  const pages: FetchedPage[] = [];
  for (const target of crawlTargets) {
    const page = await fetchText(source, target);
    if (page.contentType.includes("html") || page.contentType.includes("text/plain") || page.status === 0) {
      pages.push(page);
    }
  }

  return {
    source,
    robots,
    discoveredUrls: crawlTargets,
    pages
  };
}


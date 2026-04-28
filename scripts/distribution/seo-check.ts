import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";
import { XMLParser } from "fast-xml-parser";
import { checkLocaleText, type SeoLocale } from "./site-seo.ts";

type ReleaseEntry = {
  tag_name: string;
};

type Finding = {
  ruleId: string;
  severity: "error";
  path: string;
  message: string;
};

type CliOptions = {
  siteDir: string;
  siteUrl: string;
  releasesPath: string;
  reportDir: string;
};

const DEFAULT_SITE_URL = "https://yscjrh.github.io/ai-visibility-auditor/";
const XML_PARSER = new XMLParser({ ignoreAttributes: false });

function parseArgs(argv: string[]): CliOptions {
  const flags = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--") {
      continue;
    }
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      flags.set(key, "true");
      continue;
    }

    flags.set(key, next);
    index += 1;
  }

  return {
    siteDir: path.resolve(flags.get("site") ?? "dist/site"),
    siteUrl: withTrailingSlash(flags.get("site-url") ?? process.env.ANSWERLENS_SITE_URL ?? DEFAULT_SITE_URL),
    releasesPath: path.resolve(flags.get("releases") ?? preferredReleasesPath()),
    reportDir: path.resolve(flags.get("report-dir") ?? "build")
  };
}

export async function runSeoCheck(options: CliOptions): Promise<Finding[]> {
  const findings: Finding[] = [];
  const latestRelease = await readLatestRelease(options.releasesPath);
  const sitemapPath = path.join(options.siteDir, "sitemap.xml");
  const sitemap = await readFile(sitemapPath, "utf8");
  const sitemapUrls = parseSitemapUrls(sitemap);
  const sitemapSet = new Set(sitemapUrls);
  checkDuplicateSitemapUrls(sitemapUrls, findings);
  const htmlFiles = await listHtmlFiles(options.siteDir);
  const pageByCanonical = new Map<string, { file: string; html: string; $: cheerio.CheerioAPI; locale?: SeoLocale }>();

  for (const file of htmlFiles) {
    const html = await readFile(file, "utf8");
    const $ = cheerio.load(html);
    if (isRedirectPage($) || isReportArtifactPage(options.siteDir, file)) {
      continue;
    }

    const canonical = $("link[rel='canonical']").attr("href")?.trim();
    const locale = localeForFile(options.siteDir, file);
    if (!canonical) {
      findings.push(finding("canonical-missing", file, "Canonical HTML page is missing a canonical link."));
      continue;
    }

    if (pageByCanonical.has(canonical)) {
      findings.push(finding("canonical-duplicate", file, `Canonical URL is used by more than one generated page: ${canonical}.`));
    } else {
      pageByCanonical.set(canonical, { file, html, $, locale });
    }
    if (!sitemapSet.has(canonical)) {
      findings.push(finding("sitemap-missing-canonical", file, `Sitemap is missing canonical URL ${canonical}.`));
    }
  }

  for (const url of sitemapUrls) {
    const localPath = localPathForUrl(options.siteDir, options.siteUrl, url);
    if (!localPath) {
      findings.push(finding("sitemap-outside-site", "sitemap.xml", `Sitemap URL is outside site URL: ${url}.`));
      continue;
    }

    try {
      await stat(localPath);
    } catch {
      findings.push(finding("sitemap-local-missing", "sitemap.xml", `Sitemap URL has no local file: ${url}.`));
    }
  }

  for (const [canonical, page] of pageByCanonical.entries()) {
    checkHead(page.file, page.$, canonical, latestRelease, findings);
    checkHreflang(page.file, page.$, canonical, options.siteUrl, pageByCanonical, findings);
    checkJsonLd(page.file, page.$, canonical, latestRelease, findings);
    await checkInternalLinks(options.siteDir, options.siteUrl, canonical, page.file, page.$, findings);
    if (page.locale === "zh-CN") {
      checkChineseVisibleText(page.file, page.$, findings);
    }
  }

  const rootUrl = new URL("", options.siteUrl).href;
  if (!sitemapSet.has(rootUrl)) {
    findings.push(finding("sitemap-missing-root", "sitemap.xml", `Sitemap is missing project root ${rootUrl}.`));
  }

  await writeReports(options.reportDir, findings);
  return findings;
}

function checkHead(file: string, $: cheerio.CheerioAPI, canonical: string, latestRelease: string, findings: Finding[]): void {
  const h1Count = $("h1").length;
  if (h1Count !== 1) {
    findings.push(finding("h1-count", file, `Expected exactly one H1, found ${h1Count}.`));
  }

  const title = $("title").first().text().trim();
  if (!title) {
    findings.push(finding("title-missing", file, "Missing non-empty title."));
  }

  const description = $("meta[name='description']").attr("content")?.trim();
  if (!description) {
    findings.push(finding("description-missing", file, "Missing non-empty meta description."));
  }

  if (!isAbsoluteHttpUrl(canonical)) {
    findings.push(finding("canonical-absolute", file, `Canonical URL is not absolute: ${canonical}.`));
  }

  for (const property of ["og:title", "og:description", "og:url", "og:image", "og:image:alt"]) {
    const content = $(`meta[property='${property}']`).attr("content")?.trim();
    if (!content) {
      findings.push(finding("og-missing", file, `Missing Open Graph field ${property}.`));
    }
  }

  for (const name of ["twitter:card", "twitter:title", "twitter:description", "twitter:image", "twitter:image:alt"]) {
    const content = $(`meta[name='${name}']`).attr("content")?.trim();
    if (!content) {
      findings.push(finding("twitter-missing", file, `Missing Twitter field ${name}.`));
    }
  }

  for (const selector of ["meta[property='og:url']", "meta[property='og:image']", "meta[name='twitter:image']"]) {
    const content = $(selector).attr("content")?.trim();
    if (content && !isAbsoluteHttpUrl(content)) {
      findings.push(finding("social-url-absolute", file, `${selector} is not an absolute URL: ${content}.`));
    }
  }

  const ogUrl = $("meta[property='og:url']").attr("content")?.trim();
  if (ogUrl && ogUrl !== canonical) {
    findings.push(finding("og-url-canonical", file, `Open Graph URL ${ogUrl} must match canonical URL ${canonical}.`));
  }

  if (canonical.endsWith("/en/") || canonical.endsWith("/zh/")) {
    const softwareApp = collectJsonLd($).find((node) => node?.["@type"] === "SoftwareApplication");
    if (!softwareApp) {
      findings.push(finding("jsonld-home-softwareapplication", file, "Homepage is missing SoftwareApplication JSON-LD."));
    } else if (softwareApp.softwareVersion !== latestRelease) {
      findings.push(
        finding(
          "jsonld-software-version",
          file,
          `SoftwareApplication softwareVersion ${softwareApp.softwareVersion ?? "(missing)"} does not match latest release ${latestRelease}.`
        )
      );
    }
    if (softwareApp?.url !== canonical) {
      findings.push(finding("jsonld-home-url", file, `SoftwareApplication url ${softwareApp?.url ?? "(missing)"} must match canonical URL ${canonical}.`));
    }
  }
}

function checkHreflang(
  file: string,
  $: cheerio.CheerioAPI,
  canonical: string,
  siteUrl: string,
  pageByCanonical: Map<string, { file: string; $: cheerio.CheerioAPI; locale?: SeoLocale }>,
  findings: Finding[]
): void {
  const alternates = new Map<string, string>();
  $("link[rel='alternate'][hreflang]").each((_, node) => {
    const hreflang = $(node).attr("hreflang")?.trim();
    const href = $(node).attr("href")?.trim();
    if (hreflang && href) {
      alternates.set(hreflang, href);
    }
  });

  for (const hreflang of ["en", "zh-CN", "x-default"]) {
    const href = alternates.get(hreflang);
    if (!href) {
      findings.push(finding("hreflang-missing", file, `Missing hreflang ${hreflang}.`));
      continue;
    }
    if (!isAbsoluteHttpUrl(href)) {
      findings.push(finding("hreflang-absolute", file, `hreflang ${hreflang} is not absolute: ${href}.`));
    }
  }

  const selfLang = canonical.includes("/zh/") ? "zh-CN" : "en";
  if (alternates.get(selfLang) !== canonical) {
    findings.push(finding("hreflang-self", file, `hreflang ${selfLang} must self-reference ${canonical}.`));
  }

  const expectedXDefault = expectedNeutralXDefault(siteUrl, canonical);
  if (expectedXDefault && alternates.get("x-default") !== expectedXDefault) {
    findings.push(
      finding(
        "hreflang-x-default-neutral",
        file,
        `hreflang x-default must point to the neutral redirect URL ${expectedXDefault}, found ${alternates.get("x-default") ?? "(missing)"}.`
      )
    );
  }

  for (const hreflang of ["en", "zh-CN"] as const) {
    const href = alternates.get(hreflang);
    if (!href || href === canonical) {
      continue;
    }
    const target = pageByCanonical.get(href);
    if (!target) {
      findings.push(finding("hreflang-target-missing", file, `hreflang ${hreflang} points to a page that was not generated: ${href}.`));
      continue;
    }
    const reciprocal = target.$(`link[rel='alternate'][href='${canonical}']`).length > 0;
    if (!reciprocal) {
      findings.push(finding("hreflang-reciprocal", file, `hreflang target ${href} does not point back to ${canonical}.`));
    }
  }
}

function checkJsonLd(file: string, $: cheerio.CheerioAPI, canonical: string, _latestRelease: string, findings: Finding[]): void {
  const nodes = collectJsonLd($);
  if (nodes.length === 0) {
    findings.push(finding("jsonld-missing", file, "Missing JSON-LD script."));
    return;
  }

  const forbidden = ["aggregateRating", "review", "reviewRating", "ratingValue", "downloadCount", "interactionStatistic"];
  const serialized = JSON.stringify(nodes);
  for (const key of forbidden) {
    if (serialized.includes(`"${key}"`)) {
      findings.push(finding("jsonld-forbidden-claim", file, `JSON-LD contains forbidden claim-like field ${key}.`));
    }
  }

  if (!canonical.endsWith("/en/") && !canonical.endsWith("/zh/") && !nodes.some((node) => node?.["@type"] === "BreadcrumbList")) {
    findings.push(finding("jsonld-breadcrumb", file, "Nested page is missing BreadcrumbList JSON-LD."));
  }

  checkPageJsonLdUrls(file, nodes, canonical, findings);
  checkBreadcrumbJsonLd(file, nodes, canonical, findings);
  checkFaqJsonLd(file, $, nodes, canonical, findings);
}

function checkPageJsonLdUrls(file: string, nodes: Array<Record<string, any>>, canonical: string, findings: Finding[]): void {
  const pageTypes = new Set(["WebPage", "CollectionPage", "Dataset", "FAQPage"]);
  for (const node of nodes) {
    const type = node?.["@type"];
    if (typeof type !== "string" || !pageTypes.has(type)) {
      continue;
    }
    if (node.url !== canonical) {
      findings.push(finding("jsonld-url-canonical", file, `${type} JSON-LD url ${node.url ?? "(missing)"} must match canonical URL ${canonical}.`));
    }
  }
}

function checkBreadcrumbJsonLd(file: string, nodes: Array<Record<string, any>>, canonical: string, findings: Finding[]): void {
  const breadcrumb = nodes.find((node) => node?.["@type"] === "BreadcrumbList");
  if (!breadcrumb) {
    return;
  }

  const elements = Array.isArray(breadcrumb.itemListElement) ? breadcrumb.itemListElement : [];
  const first = elements[0];
  const last = elements[elements.length - 1];
  const expectedHome = expectedLocaleHome(canonical);
  const firstItem = jsonLdListItemUrl(first);
  const lastItem = jsonLdListItemUrl(last);

  if (expectedHome && firstItem !== expectedHome) {
    findings.push(finding("jsonld-breadcrumb-home", file, `Breadcrumb home item ${firstItem ?? "(missing)"} must point to locale home ${expectedHome}.`));
  }

  if (lastItem !== canonical) {
    findings.push(finding("jsonld-breadcrumb-canonical", file, `Breadcrumb current item ${lastItem ?? "(missing)"} must match canonical URL ${canonical}.`));
  }
}

function checkFaqJsonLd(
  file: string,
  $: cheerio.CheerioAPI,
  nodes: Array<Record<string, any>>,
  canonical: string,
  findings: Finding[]
): void {
  const faq = nodes.find((node) => node?.["@type"] === "FAQPage");
  if (!faq) {
    return;
  }

  const canonicalUrl = safeUrl(canonical);
  if (!canonicalUrl?.pathname.includes("/faq/")) {
    findings.push(finding("jsonld-faq-page-only", file, "FAQPage JSON-LD is only allowed on visible FAQ pages."));
  }

  const visibleText = visiblePageText($);
  const questions = Array.isArray(faq.mainEntity) ? faq.mainEntity : [];
  for (const question of questions) {
    const name = typeof question?.name === "string" ? question.name.trim() : "";
    if (name && !visibleText.includes(name)) {
      findings.push(finding("jsonld-faq-visible", file, `FAQPage question is not visible on the page: ${name}.`));
    }
  }
}

async function checkInternalLinks(
  siteDir: string,
  siteUrl: string,
  pageUrl: string,
  file: string,
  $: cheerio.CheerioAPI,
  findings: Finding[]
): Promise<void> {
  const checks: Array<Promise<void>> = [];
  $("a[href]").each((_, node) => {
    const href = $(node).attr("href")?.trim();
    if (!href || href.startsWith("#") || /^(mailto|tel|javascript):/i.test(href)) {
      return;
    }

    let url: URL;
    try {
      url = new URL(href, pageUrl);
    } catch {
      findings.push(finding("link-invalid-url", file, `Invalid link URL: ${href}.`));
      return;
    }

    const base = new URL(siteUrl);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) {
      return;
    }

    if (/\.(png|jpg|jpeg|gif|webp|svg|css|js|xml|txt)$/i.test(url.pathname)) {
      return;
    }

    const local = localPathForUrl(siteDir, siteUrl, url.href);
    if (!local) {
      return;
    }

    checks.push(
      stat(local)
        .then(() => undefined)
        .catch(() => {
          findings.push(finding("internal-link-missing", file, `Internal link has no local target: ${url.href}.`));
        })
    );
  });
  await Promise.all(checks);
}

function checkChineseVisibleText(file: string, $: cheerio.CheerioAPI, findings: Finding[]): void {
  const clone = $.root().clone();
  clone.find("script,style,pre,code").remove();
  const visible = clone.text();
  for (const localeFinding of checkLocaleText(visible, "zh-CN")) {
    findings.push(finding(localeFinding.ruleId, file, `${localeFinding.message} Snippet: ${localeFinding.snippet}`));
  }
}

function collectJsonLd($: cheerio.CheerioAPI): Array<Record<string, any>> {
  const nodes: Array<Record<string, any>> = [];
  $("script[type='application/ld+json']").each((_, node) => {
    const text = $(node).text().trim();
    if (!text) {
      return;
    }
    try {
      const parsed = JSON.parse(text);
      for (const item of Array.isArray(parsed) ? parsed : [parsed]) {
        if (item && typeof item === "object") {
          nodes.push(item);
        }
      }
    } catch {
      nodes.push({ "@type": "InvalidJsonLd" });
    }
  });
  return nodes;
}

function checkDuplicateSitemapUrls(urls: string[], findings: Finding[]): void {
  const seen = new Set<string>();
  for (const url of urls) {
    if (seen.has(url)) {
      findings.push(finding("sitemap-duplicate-url", "sitemap.xml", `Sitemap contains duplicate URL: ${url}.`));
      continue;
    }
    seen.add(url);
  }
}

function parseSitemapUrls(xml: string): string[] {
  const parsed = XML_PARSER.parse(xml);
  const raw = parsed?.urlset?.url;
  const urls = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return urls.map((entry: { loc?: string }) => entry.loc).filter((loc: unknown): loc is string => typeof loc === "string");
}

async function listHtmlFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(root, entry.name);
      if (entry.isDirectory()) {
        return listHtmlFiles(full);
      }
      return entry.isFile() && entry.name.endsWith(".html") ? [full] : [];
    })
  );
  return files.flat();
}

async function readLatestRelease(releasesPath: string): Promise<string> {
  const releases = JSON.parse(await readFile(releasesPath, "utf8")) as ReleaseEntry[];
  return releases[0]?.tag_name ?? "v0.3.2";
}

async function writeReports(reportDir: string, findings: Finding[]): Promise<void> {
  await mkdir(reportDir, { recursive: true });
  await writeFile(path.join(reportDir, "seo-check.json"), `${JSON.stringify({ findings }, null, 2)}\n`, "utf8");
  const markdown =
    findings.length === 0
      ? "# SEO check\n\nNo findings.\n"
      : `# SEO check\n\n${findings
          .map((item) => `- **${item.ruleId}** (${item.path}): ${item.message}`)
          .join("\n")}\n`;
  await writeFile(path.join(reportDir, "seo-check.md"), markdown, "utf8");
}

function localPathForUrl(siteDir: string, siteUrl: string, href: string): string | null {
  const base = new URL(siteUrl);
  const url = new URL(href);
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) {
    return null;
  }
  const relative = decodeURIComponent(url.pathname.slice(base.pathname.length));
  const withoutHash = relative.replace(/\/$/, "");
  if (!withoutHash) {
    return path.join(siteDir, "index.html");
  }
  const candidate = path.join(siteDir, withoutHash);
  return path.extname(candidate) ? candidate : path.join(candidate, "index.html");
}

function localeForFile(siteDir: string, file: string): SeoLocale | undefined {
  const relative = path.relative(siteDir, file).split(path.sep).join("/");
  if (relative.startsWith("zh/")) {
    return "zh-CN";
  }
  if (relative.startsWith("en/")) {
    return "en";
  }
  return undefined;
}

function expectedNeutralXDefault(siteUrl: string, canonical: string): string | null {
  const route = unlocalizedRouteForCanonical(siteUrl, canonical);
  return route === null ? null : new URL(route, siteUrl).href;
}

function expectedLocaleHome(canonical: string): string | null {
  const url = safeUrl(canonical);
  if (!url) {
    return null;
  }
  const match = url.pathname.match(/^(.*\/)(en|zh)(?:\/|$)/);
  if (!match) {
    return null;
  }
  return `${url.origin}${match[1]}${match[2]}/`;
}

function unlocalizedRouteForCanonical(siteUrl: string, canonical: string): string | null {
  const base = safeUrl(siteUrl);
  const url = safeUrl(canonical);
  if (!base || !url) {
    return null;
  }
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) {
    return null;
  }

  const relative = url.pathname.slice(base.pathname.length);
  if (relative === "en/" || relative === "zh/") {
    return "";
  }

  if (relative.startsWith("en/")) {
    return relative.slice("en/".length);
  }

  if (relative.startsWith("zh/")) {
    return relative.slice("zh/".length);
  }

  return null;
}

function jsonLdListItemUrl(value: any): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const item = value.item;
  if (typeof item === "string") {
    return item;
  }
  if (item && typeof item === "object" && typeof item["@id"] === "string") {
    return item["@id"];
  }
  if (item && typeof item === "object" && typeof item.url === "string") {
    return item.url;
  }
  return undefined;
}

function visiblePageText($: cheerio.CheerioAPI): string {
  const clone = $.root().clone();
  clone.find("script,style,pre,code").remove();
  return clone.text().replace(/\s+/g, " ").trim();
}

function isRedirectPage($: cheerio.CheerioAPI): boolean {
  return $("meta[http-equiv='refresh']").length > 0 && $("h1").length === 0;
}

function isReportArtifactPage(siteDir: string, file: string): boolean {
  const relative = path.relative(siteDir, file).split(path.sep).join("/");
  return relative.includes("examples/static-good/") || relative.includes("starter/example-run/");
}

function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function safeUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function finding(ruleId: string, file: string, message: string): Finding {
  return {
    ruleId,
    severity: "error",
    path: file,
    message
  };
}

function withTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function preferredReleasesPath(): string {
  return "dist/releases.json";
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  try {
    await stat(options.releasesPath);
  } catch {
    options.releasesPath = path.resolve("scripts/distribution/releases-snapshot.json");
  }
  const findings = await runSeoCheck(options);
  if (findings.length > 0) {
    console.error(`SEO check failed with ${findings.length} finding(s). See ${path.join(options.reportDir, "seo-check.md")}.`);
    process.exitCode = 1;
    return;
  }
  console.log(`SEO check passed. Reports written to ${options.reportDir}.`);
}

const isCliEntrypoint =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isCliEntrypoint) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

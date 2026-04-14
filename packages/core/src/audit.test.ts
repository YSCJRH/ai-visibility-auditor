import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { loadBrandConfig, loadCompetitorsConfig, loadPromptsConfig } from "./config.ts";
import { runAudit } from "./audit.ts";
import { normalizePage } from "./extract.ts";

const brandPath = path.resolve("examples/acme/brand.yaml");
const competitorsPath = path.resolve("examples/acme/competitors.yaml");
const promptsPath = path.resolve("examples/acme/prompts.yaml");

async function loadFixtureConfigs() {
  const [brand, competitors, prompts] = await Promise.all([
    loadBrandConfig(brandPath),
    loadCompetitorsConfig(competitorsPath),
    loadPromptsConfig(promptsPath)
  ]);

  return { brand, competitors, prompts };
}

test("healthy fixture keeps required pages and strong score", async () => {
  const configs = await loadFixtureConfigs();
  const result = await runAudit({
    siteInput: "./examples/fixtures/static-good",
    ...configs
  });

  assert.equal(result.summary.missingPageTypes.length, 0);
  assert.ok(result.summary.overallScore >= 70);
  assert.equal(result.site.kind, "local");
  assert.ok(result.pages.some((page) => page.jsonLdRecords.some((record) => record.type === "SoftwareApplication")));
  assert.ok(result.pages.some((page) => page.jsonLdRecords.some((record) => record.type === "Product")));
  assert.ok(result.pages.some((page) => page.jsonLdRecords.some((record) => record.type === "FAQPage")));
  assert.ok(result.pages.some((page) => page.schemaTextSignals.length > 0));
  assert.ok(result.pages.some((page) => page.evidenceSignals.length > 0));
  assert.ok(result.pages.some((page) => page.internalLinkRecords.length > 0));
  assert.equal(result.issues.some((issue) => issue.title === "Structured data name is not visible"), false);
  assert.equal(result.issues.some((issue) => issue.title === "FAQ schema does not match visible questions"), false);
  assert.equal(result.issues.some((issue) => issue.title === "Pricing page evidence density is low"), false);
  assert.equal(result.issues.some((issue) => issue.title === "Key proof page is weakly linked"), false);
  assert.equal(result.issues.some((issue) => issue.title === "Anchor text is generic for proof page"), false);
  assert.equal(result.issues.some((issue) => issue.title === "Proof page lacks contextual support"), false);
});

test("blocked fixture reports crawl blockers", async () => {
  const configs = await loadFixtureConfigs();
  const result = await runAudit({
    siteInput: "./examples/fixtures/blocked-site",
    ...configs
  });

  assert.ok(result.issues.some((issue) => issue.title === "Robots blocks all crawlers"));
  assert.ok(result.scores.access.score < 100);
});

test("missing evidence fixture reports page gaps", async () => {
  const configs = await loadFixtureConfigs();
  const result = await runAudit({
    siteInput: "./examples/fixtures/missing-evidence",
    ...configs
  });

  assert.ok(result.summary.missingPageTypes.includes("pricing"));
  assert.ok(result.summary.missingPageTypes.includes("security"));
  assert.ok(result.recommendations.some((recommendation) => recommendation.id === "add-citable-evidence"));
});

test("schema mismatch and evidence density fixture reports field-level gaps", async () => {
  const configs = await loadFixtureConfigs();
  const result = await runAudit({
    siteInput: "./examples/fixtures/schema-mismatch-evidence-density",
    ...configs
  });

  const issueTitles = new Set(result.issues.map((issue) => issue.title));
  const homepage = result.pages.find((page) => page.pageType === "home");
  const faq = result.pages.find((page) => page.pageType === "faq");
  const pricing = result.pages.find((page) => page.pageType === "pricing");

  assert.ok(homepage);
  assert.ok(faq);
  assert.ok(pricing);
  assert.ok(homepage.jsonLdRecords.some((record) => record.type === "SoftwareApplication"));
  assert.ok(homepage.schemaTextSignals.some((signal) => signal.field === "name" && !signal.visible));
  assert.ok(faq.schemaTextSignals.some((signal) => signal.field === "faq.question" && !signal.visible));
  assert.ok(pricing.evidenceSignals.some((signal) => signal.type === "pricing-proof"));
  assert.ok(issueTitles.has("Structured data name is not visible"));
  assert.ok(issueTitles.has("Structured data description is not visible"));
  assert.ok(issueTitles.has("FAQ schema does not match visible questions"));
  assert.ok(issueTitles.has("FAQ schema answers are not visible"));
  assert.ok(issueTitles.has("Pricing page evidence density is low"));
  assert.ok(issueTitles.has("Security page evidence density is low"));
  assert.ok(issueTitles.has("Docs page evidence density is low"));
  assert.ok(issueTitles.has("Compare page evidence density is low"));
  assert.ok(issueTitles.has("Use-case page evidence density is low"));
  assert.ok(result.recommendations.some((recommendation) => recommendation.id === "add-citable-evidence"));
});

test("normalizePage keeps structured internal links with fallback anchor text", async () => {
  const { brand } = await loadFixtureConfigs();
  const page = normalizePage(
    {
      kind: "local",
      input: "./examples/fixtures/weak-link-context",
      baseUrl: "https://acme.test",
      rootDir: path.resolve("examples/fixtures/weak-link-context")
    },
    {
      url: "https://acme.test/product",
      status: 200,
      html: `<!doctype html><html lang="en"><head><title>Product</title></head><body><main><p><a href="/docs" aria-label="Developer docs"></a></p><p>Generic section with <a href="/faq">Learn more</a>.</p></main></body></html>`,
      contentType: "text/html"
    },
    brand.brand
  );

  const docsLink = page.internalLinkRecords.find((record) => record.url === "https://acme.test/docs");
  const faqLink = page.internalLinkRecords.find((record) => record.url === "https://acme.test/faq");

  assert.ok(docsLink);
  assert.ok(faqLink);
  assert.equal(docsLink.anchorText, "Developer docs");
  assert.ok(docsLink.sourceContext.includes("Developer docs"));
  assert.equal(page.internalLinks.includes("https://acme.test/docs"), true);
  assert.equal(page.internalLinks.includes("https://acme.test/faq"), true);
});

test("weak link context fixture reports discoverability gaps", async () => {
  const configs = await loadFixtureConfigs();
  const result = await runAudit({
    siteInput: "./examples/fixtures/weak-link-context",
    ...configs
  });

  const issueTitles = new Set(result.issues.map((issue) => issue.title));
  const productPage = result.pages.find((page) => page.pageType === "product");

  assert.ok(productPage);
  assert.ok(productPage.internalLinkRecords.some((record) => record.anchorText === "Developer docs"));
  assert.ok(issueTitles.has("Key proof page is weakly linked"));
  assert.ok(issueTitles.has("Anchor text is generic for proof page"));
  assert.ok(issueTitles.has("Proof page lacks contextual support"));
  assert.ok(result.recommendations.some((recommendation) => recommendation.id === "close-comparison-gaps"));
});

test("trailing slash proof pages still collect incoming link context", async () => {
  const configs = await loadFixtureConfigs();
  const result = await runAudit({
    siteInput: "./examples/fixtures/trailing-slash-link-context",
    ...configs
  });

  const enterprisePage = result.pages.find((page) => page.url === "https://fixture.local/use-case/enterprise");
  const enterpriseWeakLinkIssue = result.issues.find(
    (issue) => issue.title === "Key proof page is weakly linked" && issue.pageUrl === "https://fixture.local/use-case/enterprise"
  );

  assert.ok(enterprisePage);
  assert.equal(enterpriseWeakLinkIssue, undefined);
});

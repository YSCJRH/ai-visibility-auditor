import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadBrandConfig, loadCompetitorsConfig, loadPromptsConfig, runAudit } from "./index.ts";
import { buildSearchConsoleValidation, parseSearchConsoleCsv } from "./validation.ts";

test("parseSearchConsoleCsv reads valid page-level exports", async () => {
  const csv = await readFile(path.resolve("examples/fixtures/search-console/static-good-pages.csv"), "utf8");
  const rows = parseSearchConsoleCsv(csv);

  assert.equal(rows.length, 5);
  assert.equal(rows[0]?.page, "https://fixture.local/pricing");
  assert.equal(rows[0]?.clicks, 12);
  assert.equal(rows[0]?.impressions, 120);
  assert.equal(rows[0]?.ctr, 10);
  assert.equal(rows[0]?.position, 3.2);
});

test("parseSearchConsoleCsv rejects missing required columns", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-gsc-invalid-"));
  const filePath = path.join(tempDir, "invalid.csv");
  await writeFile(filePath, "page,clicks,impressions,position\nhttps://fixture.local/pricing,12,120,3.2\n", "utf8");

  await assert.rejects(
    () => readFile(filePath, "utf8").then((value) => parseSearchConsoleCsv(value)),
    /missing required columns: ctr/i
  );
});

test("parseSearchConsoleCsv rejects invalid numeric values", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-gsc-invalid-number-"));
  const filePath = path.join(tempDir, "invalid.csv");
  await writeFile(
    filePath,
    "page,clicks,impressions,ctr,position\nhttps://fixture.local/pricing,not-a-number,120,10%,3.2\n",
    "utf8"
  );

  await assert.rejects(
    () => readFile(filePath, "utf8").then((value) => parseSearchConsoleCsv(value)),
    /invalid numeric value for clicks/i
  );
});

test("buildSearchConsoleValidation matches normalized URLs and flags out-of-scope pages", async () => {
  const [brand, competitors, prompts, csvText] = await Promise.all([
    loadBrandConfig(path.resolve("examples/acme/brand.yaml")),
    loadCompetitorsConfig(path.resolve("examples/acme/competitors.yaml")),
    loadPromptsConfig(path.resolve("examples/acme/prompts.yaml")),
    readFile(path.resolve("examples/fixtures/search-console/static-good-pages.csv"), "utf8")
  ]);

  const audit = await runAudit({
    siteInput: "./examples/fixtures/static-good",
    brand,
    competitors,
    prompts
  });

  const result = buildSearchConsoleValidation(
    audit,
    csvText,
    path.resolve("examples/fixtures/search-console/static-good-pages.csv")
  );
  const securityPage = result.validation.pages.find((page) => page.page.includes("/security"));
  const outOfScopePage = result.validation.pages.find((page) => page.outOfScope);
  const unmatchedFinding = result.validation.findings.find((finding) => finding.title === "Search Console page is not covered by crawl");
  const noEvidenceFinding = result.validation.findings.find((finding) => finding.title === "Key page has no Search Console evidence");

  assert.equal(result.audit.run.mode, "validation-import");
  assert.equal(result.audit.run.validationSource, "search-console");
  assert.equal(result.validation.summary.importedPageCount, 5);
  assert.equal(result.validation.summary.matchedAuditPageCount, 3);
  assert.equal(result.validation.summary.outOfScopePageCount, 1);
  assert.equal(securityPage?.matchedAuditPageUrl, "https://fixture.local/security");
  assert.equal(securityPage?.matchedPageType, "security");
  assert.equal(outOfScopePage?.page, "https://external.example/compare");
  assert.match(unmatchedFinding?.pageUrl ?? "", /missing-page/);
  assert.equal(noEvidenceFinding?.pageType, "faq");
});

test("buildSearchConsoleValidation flags search-visible pages that still have audit blockers", async () => {
  const [brand, competitors, prompts] = await Promise.all([
    loadBrandConfig(path.resolve("examples/acme/brand.yaml")),
    loadCompetitorsConfig(path.resolve("examples/acme/competitors.yaml")),
    loadPromptsConfig(path.resolve("examples/acme/prompts.yaml"))
  ]);

  const audit = await runAudit({
    siteInput: "./examples/fixtures/schema-mismatch-evidence-density",
    brand,
    competitors,
    prompts
  });
  const csvText = "page,clicks,impressions,ctr,position\nhttps://fixture.local/pricing,5,60,8.3%,6.1\n";

  const result = buildSearchConsoleValidation(
    audit,
    csvText,
    path.resolve("examples/fixtures/search-console/missing-evidence-pages.csv")
  );
  const blockerFinding = result.validation.findings.find(
    (finding) => finding.title === "Search-visible page still has audit blockers"
  );

  assert.equal(result.validation.summary.pagesWithImpressions, 1);
  assert.ok(result.validation.summary.totalImpressions > 0);
  assert.equal(blockerFinding?.pageUrl, "https://fixture.local/pricing");
  assert.ok((blockerFinding?.relatedAuditIssueIds?.length ?? 0) > 0);
});

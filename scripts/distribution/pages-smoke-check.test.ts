import test from "node:test";
import assert from "node:assert/strict";
import { runPagesSmokeCheck } from "./pages-smoke-check.ts";

const SHOW_AND_TELL_DISCUSSION_URL = "https://github.com/YSCJRH/ai-visibility-auditor/discussions/new?category=show-and-tell";

test("pages-smoke-check passes when live Pages routes contain sharing and artifact-order text", async () => {
  const findings = await runPagesSmokeCheck({
    siteUrl: "https://example.test/ai-visibility-auditor",
    retryDelayMs: 0,
    fetchImpl: async (url) => responseFor(url, pageForUrl(url))
  });

  assert.deepEqual(findings, []);
});

test("pages-smoke-check reports missing snippets and unreadable routes", async () => {
  const findings = await runPagesSmokeCheck({
    siteUrl: "https://example.test/ai-visibility-auditor/",
    retries: 1,
    retryDelayMs: 0,
    fetchImpl: async (url) => {
      if (url.endsWith("/zh/releases/")) {
        return responseFor(url, "temporary outage", 503);
      }
      if (isNeutralReleaseUrl(url)) {
        return responseFor(url, "AnswerLens locale redirect");
      }
      if (url.endsWith("/zh/examples/static-good/index.html")) {
        return responseFor(url, "审阅并分享这次运行 share-summary.md scorecard.md recommendations.md");
      }
      if (url.endsWith("/examples/static-good/index.html")) {
        return responseFor(url, "Review and share this run share-summary.md scorecard.md recommendations.md");
      }
      if (url.endsWith("/en/use-case/open-source-maintainers/")) {
        return responseFor(url, "AnswerLens for open-source maintainers.");
      }
      return responseFor(url, "Download the latest AnswerLens release. share-summary.md scorecard.md recommendations.md");
    }
  });

  assert.equal(findings.length, 24);
  assert.equal(findings.filter((finding) => finding.ruleId === "pages-live-route").length, 1);
  assert.equal(findings.filter((finding) => finding.ruleId === "pages-live-snippet").length, 23);
  assert.ok(findings.some((finding) => /\/releases\/$/.test(finding.url) && finding.message.includes("en/releases/")));
  assert.ok(findings.some((finding) => /\/en\/releases\/$/.test(finding.url) && finding.message.includes("release-assets-summary.md")));
  assert.ok(findings.some((finding) => /\/zh\/releases\/$/.test(finding.url) && finding.ruleId === "pages-live-route"));
  assert.ok(findings.some((finding) => /\/examples\/static-good\/index\.html$/.test(finding.url)));
  assert.ok(findings.some((finding) => /\/zh\/examples\/static-good\/index\.html$/.test(finding.url)));
  assert.ok(findings.some((finding) => /\/en\/use-case\/open-source-maintainers\/$/.test(finding.url)));
});

function pageForUrl(url: string): string {
  if (isNeutralReleaseUrl(url)) {
    return [
      "AnswerLens locale redirect",
      "en/releases/",
      "zh/releases/",
      "Continue in English",
      "继续中文"
    ].join("\n");
  }

  if (url.endsWith("/en/releases/")) {
    return [
      "Download the latest AnswerLens release.",
      SHOW_AND_TELL_DISCUSSION_URL,
      "release-assets-summary.md",
      "release-assets-smoke-summary.md",
      "Release review path",
      "starter-bundle.md",
      "examples/consumer-repo",
      "first-run story template",
      "Show and tell Discussion form",
      "raw provider payloads",
      "standalone adoption proof",
      "share-summary.md",
      "scorecard.md",
      "recommendations.md"
    ].join("\n");
  }

  if (url.endsWith("/zh/releases/")) {
    return [
      "下载最新的 AnswerLens 发布版本",
      SHOW_AND_TELL_DISCUSSION_URL,
      "release-assets-summary.md",
      "release-assets-smoke-summary.md",
      "Release review path",
      "starter-bundle.md",
      "examples/consumer-repo",
      "first-run story template",
      "Show and tell Discussion form",
      "raw provider payloads",
      "standalone adoption proof",
      "share-summary.md",
      "scorecard.md",
      "recommendations.md"
    ].join("\n");
  }

  if (url.endsWith("/zh/examples/static-good/index.html")) {
    return [
      "审阅并分享这次运行",
      SHOW_AND_TELL_DISCUSSION_URL,
      "first-run story template",
      "raw provider payloads",
      "share-summary.md",
      "scorecard.md",
      "recommendations.md"
    ].join("\n");
  }

  if (url.endsWith("/examples/static-good/index.html")) {
    return [
      "Review and share this run",
      SHOW_AND_TELL_DISCUSSION_URL,
      "first-run story template",
      "raw provider payloads",
      "share-summary.md",
      "scorecard.md",
      "recommendations.md"
    ].join("\n");
  }

  if (url.endsWith("/en/use-case/open-source-maintainers/")) {
    return [
      "AnswerLens for open-source maintainers.",
      SHOW_AND_TELL_DISCUSSION_URL,
      "reuse permission",
      "raw-payload boundaries"
    ].join("\n");
  }

  throw new Error(`Unexpected URL ${url}`);
}

function isNeutralReleaseUrl(url: string): boolean {
  const pathname = new URL(url).pathname;
  return pathname.endsWith("/releases/") && !pathname.includes("/en/releases/") && !pathname.includes("/zh/releases/");
}

function responseFor(url: string, body: string, status = 200): Response {
  return new Response(body, { status, statusText: status === 200 ? "OK" : "Service Unavailable" });
}

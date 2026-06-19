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
      if (url.endsWith("/en/use-case/open-source-maintainers/")) {
        return responseFor(url, "AnswerLens for open-source maintainers.");
      }
      return responseFor(url, "Download the latest AnswerLens release. share-summary.md scorecard.md recommendations.md");
    }
  });

  assert.deepEqual(
    findings.map((finding) => finding.ruleId),
    [
      "pages-live-snippet",
      "pages-live-route",
      "pages-live-snippet",
      "pages-live-snippet",
      "pages-live-snippet"
    ]
  );
  assert.match(findings[0].url, /\/en\/releases\/$/);
  assert.match(findings[1].url, /\/zh\/releases\/$/);
  assert.match(findings[2].url, /\/en\/use-case\/open-source-maintainers\/$/);
});

function pageForUrl(url: string): string {
  if (url.endsWith("/en/releases/")) {
    return [
      "Download the latest AnswerLens release.",
      SHOW_AND_TELL_DISCUSSION_URL,
      "share-summary.md",
      "scorecard.md",
      "recommendations.md"
    ].join("\n");
  }

  if (url.endsWith("/zh/releases/")) {
    return [
      "下载最新的 AnswerLens 发布版本",
      SHOW_AND_TELL_DISCUSSION_URL,
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

function responseFor(url: string, body: string, status = 200): Response {
  return new Response(body, { status, statusText: status === 200 ? "OK" : "Service Unavailable" });
}

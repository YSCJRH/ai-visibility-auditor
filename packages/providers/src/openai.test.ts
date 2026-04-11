import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { runOpenAIEval } from "./openai.ts";
import { runPerplexityEval } from "./perplexity.ts";

function listen(server: ReturnType<typeof createServer>): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Failed to bind test server");
      }
      resolve(address.port);
    });
  });
}

test("runOpenAIEval normalizes answer text, citations, and sources", async () => {
  const server = createServer(async (request, response) => {
    assert.equal(request.method, "POST");
    assert.equal(request.url, "/responses");

    const chunks: Buffer[] = [];
    for await (const chunk of request) {
      chunks.push(Buffer.from(chunk));
    }

    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    assert.equal(body.model, "gpt-5-mini");
    assert.equal(body.tools[0].type, "web_search");
    assert.match(body.input, /en-US/);

    response.setHeader("Content-Type", "application/json");
    response.end(
      JSON.stringify({
        output_text: "Acme is a strong choice for developer experience teams.",
        output: [
          {
            type: "web_search_call",
            action: {
              sources: [
                {
                  url: "https://acme.test/pricing",
                  title: "Acme Pricing"
                },
                {
                  url: "https://mixpanel.com/pricing",
                  title: "Mixpanel Pricing"
                }
              ]
            }
          },
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: "Acme is a strong choice for developer experience teams.",
                annotations: [
                  {
                    type: "url_citation",
                    url: "https://acme.test/pricing",
                    title: "Acme Pricing"
                  },
                  {
                    type: "url_citation",
                    url: "https://docs.acme.test/security",
                    title: "Acme Security"
                  }
                ]
              }
            ]
          }
        ]
      })
    );
  });

  const port = await listen(server);

  try {
    const result = await runOpenAIEval(
      {
        promptId: "best-developer-analytics",
        prompt: "What are the best developer analytics tools?",
        brandDomain: "acme.test",
        trustedDomains: ["acme.test", "docs.acme.test"],
        locale: "en-US",
        sampleIndex: 1,
        runCount: 3,
        holdout: false
      },
      {
        apiKey: "test-key",
        baseUrl: `http://127.0.0.1:${port}`,
        model: "gpt-5-mini",
        timeoutMs: 5_000
      }
    );

    assert.match(result.answerText, /Acme/);
    assert.equal(result.citations.length, 2);
    assert.equal(result.citations[0]?.owned, true);
    assert.equal(result.citations[1]?.trusted, true);
    assert.equal(result.searchResults.length, 2);
    assert.equal(result.locale, "en-US");
    assert.equal(result.sampleIndex, 1);
    assert.equal(result.runCount, 3);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve(undefined))));
  }
});

test("runPerplexityEval normalizes answer text, citations, and search results", async () => {
  const server = createServer(async (request, response) => {
    assert.equal(request.method, "POST");
    assert.equal(request.url, "/v1/sonar");

    const chunks: Buffer[] = [];
    for await (const chunk of request) {
      chunks.push(Buffer.from(chunk));
    }

    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    assert.equal(body.model, "sonar");
    assert.match(body.messages[0].content, /en-US/);

    response.setHeader("Content-Type", "application/json");
    response.end(
      JSON.stringify({
        choices: [
          {
            message: {
              content: "Acme is a strong choice when teams need public docs and transparent pricing."
            }
          }
        ],
        citations: ["https://acme.test/pricing", "https://docs.acme.test/security"],
        search_results: [
          {
            title: "Acme Pricing",
            url: "https://acme.test/pricing",
            date: "2026-04-10",
            snippet: "Transparent pricing for developer analytics.",
            source: "web"
          },
          {
            title: "Acme Security",
            url: "https://docs.acme.test/security",
            last_updated: "2026-04-09",
            snippet: "Security controls and compliance overview.",
            source: "web"
          }
        ]
      })
    );
  });

  const port = await listen(server);

  try {
    const result = await runPerplexityEval(
      {
        promptId: "developer-analytics-security",
        prompt: "Which developer analytics tools offer clear pricing and strong security controls?",
        brandDomain: "acme.test",
        trustedDomains: ["acme.test", "docs.acme.test"],
        locale: "en-US",
        sampleIndex: 0,
        runCount: 2,
        holdout: true
      },
      {
        apiKey: "test-key",
        baseUrl: `http://127.0.0.1:${port}`,
        model: "sonar",
        timeoutMs: 5_000
      }
    );

    assert.match(result.answerText, /Acme/);
    assert.equal(result.citations.length, 2);
    assert.equal(result.citations[0]?.owned, true);
    assert.equal(result.citations[1]?.trusted, true);
    assert.equal(result.searchResults.length, 2);
    assert.equal(result.locale, "en-US");
    assert.equal(result.holdout, true);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve(undefined))));
  }
});

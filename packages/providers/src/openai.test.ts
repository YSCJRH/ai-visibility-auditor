import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { runOpenAIEval } from "./openai.ts";

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
        trustedDomains: ["acme.test", "docs.acme.test"]
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
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve(undefined))));
  }
});

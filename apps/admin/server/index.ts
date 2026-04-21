import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createAuditRun,
  createEvalRun,
  getRunDetail,
  getRunJob,
  listConfigPresets,
  listRuns,
  readRunArtifact
} from "@answerlens/admin-runtime";
import type { CreateAuditRunInput, CreateEvalRunInput } from "@answerlens/contracts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistDir = path.resolve(__dirname, "../dist");
const port = Number(process.env.PORT ?? 4318);

function isArtifactPayload(value: string): "markdown" | "json" | "html" | "text" {
  if (value.endsWith(".md")) {
    return "markdown";
  }
  if (value.endsWith(".json")) {
    return "json";
  }
  if (value.endsWith(".html")) {
    return "html";
  }
  return "text";
}

export function createServer(): express.Express {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_request, response) => {
    response.json({ ok: true, service: "answerlens-admin-bff" });
  });

  app.get("/api/config-presets", async (_request, response, next) => {
    try {
      response.json({ presets: await listConfigPresets() });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/runs", async (_request, response, next) => {
    try {
      response.json({ runs: await listRuns() });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/runs/:runId", async (request, response, next) => {
    try {
      response.json(await getRunDetail(request.params.runId));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/runs/:runId/artifacts/:artifactName", async (request, response, next) => {
    try {
      const { entry, content } = await readRunArtifact(request.params.runId, request.params.artifactName);
      const rawType = isArtifactPayload(entry.name);
      if (rawType === "markdown") {
        response.type("text/markdown; charset=utf-8");
      } else if (rawType === "json") {
        response.type("application/json; charset=utf-8");
      } else if (rawType === "html") {
        response.type("text/html; charset=utf-8");
      } else {
        response.type("text/plain; charset=utf-8");
      }
      response.send(content);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/jobs/:jobId", (request, response) => {
    const job = getRunJob(request.params.jobId);
    if (!job) {
      response.status(404).json({ message: `Unknown job ${request.params.jobId}` });
      return;
    }
    response.json(job);
  });

  app.post("/api/runs/audit", async (request, response, next) => {
    try {
      const payload = request.body as CreateAuditRunInput;
      response.status(202).json(await createAuditRun(payload));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/runs/eval", async (request, response, next) => {
    try {
      const payload = request.body as CreateEvalRunInput;
      response.status(202).json(await createEvalRun(payload));
    } catch (error) {
      next(error);
    }
  });

  if (process.env.NODE_ENV !== "development") {
    app.use(express.static(clientDistDir));
    app.get("*", (_request, response) => {
      response.sendFile(path.join(clientDistDir, "index.html"));
    });
  }

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : "Unknown server error";
    response.status(500).json({ message });
  });

  return app;
}

if (process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])) {
  const app = createServer();
  app.listen(port, "127.0.0.1", () => {
    console.log(`AnswerLens admin BFF listening on http://127.0.0.1:${port}`);
  });
}

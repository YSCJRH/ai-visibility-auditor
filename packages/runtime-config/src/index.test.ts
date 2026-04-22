import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { defaultRuntimePathForBrand, loadRuntimeConfig, resolveEvalRuntime } from "./index.ts";

async function writeRuntimeFile(directory: string, content: string): Promise<string> {
  const filePath = path.join(directory, "runtime.yaml");
  await writeFile(filePath, content, "utf8");
  return filePath;
}

test("loadRuntimeConfig reads runtime.yaml", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-runtime-config-"));
  const runtimePath = await writeRuntimeFile(
    tempDir,
    `runtime:
  eval:
    provider: openai
    model: gpt-5-mini
    locale: en-US
    samples: 2
    timeout_ms: 45000
  providers:
    openai:
      base_url: https://api.openai.com/v1
`
  );

  const config = await loadRuntimeConfig(runtimePath);
  assert.equal(config.runtime.eval?.provider, "openai");
  assert.equal(config.runtime.eval?.model, "gpt-5-mini");
  assert.equal(config.runtime.eval?.samples, 2);
  assert.equal(config.runtime.providers?.openai?.base_url, "https://api.openai.com/v1");
});

test("resolveEvalRuntime uses sibling runtime.yaml next to brand.yaml", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-runtime-default-path-"));
  const configDir = path.join(tempDir, ".github", "answerlens");
  await mkdir(configDir, { recursive: true });
  await writeFile(
    path.join(configDir, "brand.yaml"),
    "brand:\n  name: Example\n  domain: example.com\n  category: Devtools\n  one_liner: Example\n  target_personas: []\n  key_use_cases: []\n  competitors: []\n  canonical_facts: []\n  trusted_domains: []\n",
    "utf8"
  );
  await writeRuntimeFile(
    configDir,
    `runtime:
  eval:
    provider: perplexity
    model: sonar-pro
`
  );

  const brandPath = path.join(configDir, "brand.yaml");
  assert.equal(defaultRuntimePathForBrand(brandPath), path.join(configDir, "runtime.yaml"));
  const resolved = await resolveEvalRuntime({ brandPath, env: {} });
  assert.equal(resolved.provider.value, "perplexity");
  assert.equal(resolved.model.value, "sonar-pro");
  assert.equal(resolved.provider.source, "runtime");
  assert.equal(resolved.model.source, "runtime");
});

test("resolveEvalRuntime applies override > runtime > env > default precedence", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-runtime-precedence-"));
  const runtimePath = await writeRuntimeFile(
    tempDir,
    `runtime:
  eval:
    provider: openai
    model: gpt-5-mini
    locale: en-US
    samples: 2
    timeout_ms: 45000
  providers:
    openai:
      base_url: https://runtime.example/v1
`
  );

  const resolved = await resolveEvalRuntime({
    runtimePath,
    provider: "perplexity",
    model: "sonar-deep-research",
    samples: 3,
    timeoutMs: 30000,
    baseUrl: "https://override.example",
    env: {
      ANSWERLENS_PERPLEXITY_MODEL: "sonar-env",
      ANSWERLENS_PERPLEXITY_BASE_URL: "https://env.example"
    }
  });

  assert.equal(resolved.provider.value, "perplexity");
  assert.equal(resolved.provider.source, "override");
  assert.equal(resolved.model.value, "sonar-deep-research");
  assert.equal(resolved.model.source, "override");
  assert.equal(resolved.locale.value, "en-US");
  assert.equal(resolved.locale.source, "runtime");
  assert.equal(resolved.samples.value, 3);
  assert.equal(resolved.timeoutMs.value, 30000);
  assert.equal(resolved.baseUrl.value, "https://override.example");
});

test("resolveEvalRuntime applies profile values before runtime defaults", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-runtime-profile-"));
  const runtimePath = await writeRuntimeFile(
    tempDir,
    `runtime:
  eval:
    provider: openai
    model: gpt-5-mini
    locale: en-US
    samples: 1
    timeout_ms: 60000
`
  );

  const resolved = await resolveEvalRuntime({
    runtimePath,
    profile: "high-confidence-review",
    env: {}
  });

  assert.equal(resolved.provider.value, "openai");
  assert.equal(resolved.provider.source, "profile");
  assert.equal(resolved.model.value, "gpt-5");
  assert.equal(resolved.model.source, "profile");
  assert.equal(resolved.samples.value, 1);
  assert.equal(resolved.locale.value, "en-US");
});

test("resolveEvalRuntime lets a profile alias switch providers", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-runtime-profile-provider-"));
  const runtimePath = await writeRuntimeFile(
    tempDir,
    `runtime:
  eval:
    provider: openai
    model: gpt-5-mini
    locale: en-US
    samples: 1
    timeout_ms: 60000
`
  );

  const resolved = await resolveEvalRuntime({
    runtimePath,
    profile: "perplexity-cross-check",
    env: {}
  });

  assert.equal(resolved.provider.value, "perplexity");
  assert.equal(resolved.provider.source, "profile");
  assert.equal(resolved.model.value, "sonar");
  assert.equal(resolved.model.source, "profile");
  assert.equal(resolved.locale.value, "en-US");
  assert.equal(resolved.samples.value, 1);
});

test("resolveEvalRuntime falls back to env and provider defaults", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-runtime-env-"));
  const runtimePath = await writeRuntimeFile(
    tempDir,
    `runtime:
  eval:
    provider: openai
`
  );

  const resolved = await resolveEvalRuntime({
    runtimePath,
    env: {
      ANSWERLENS_OPENAI_MODEL: "gpt-5-mini",
      OPENAI_BASE_URL: "https://env.openai.example/v1"
    }
  });

  assert.equal(resolved.provider.value, "openai");
  assert.equal(resolved.model.value, "gpt-5-mini");
  assert.equal(resolved.model.source, "env");
  assert.equal(resolved.baseUrl.value, "https://env.openai.example/v1");
  assert.equal(resolved.baseUrl.source, "env");
  assert.equal(resolved.samples.value, 1);
  assert.equal(resolved.timeoutMs.value, 60000);
});

test("resolveEvalRuntime errors when provider is missing everywhere", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-runtime-missing-provider-"));
  const runtimePath = await writeRuntimeFile(
    tempDir,
    `runtime:
  eval:
    model: gpt-5-mini
`
  );

  await assert.rejects(
    () => resolveEvalRuntime({ runtimePath, env: {} }),
    /Eval provider is required/i
  );
});

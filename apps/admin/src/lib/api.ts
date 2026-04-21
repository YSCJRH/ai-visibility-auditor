import type {
  AdminRunDetail,
  AdminRunListItem,
  ConfigPresetSummary,
  CreateAuditRunInput,
  CreateEvalRunInput,
  RunJobRecord
} from "@answerlens/contracts";

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

export function listRuns(): Promise<{ runs: AdminRunListItem[] }> {
  return requestJson("/api/runs");
}

export function getRunDetail(runId: string): Promise<AdminRunDetail> {
  return requestJson(`/api/runs/${encodeURIComponent(runId)}`);
}

export function listConfigPresets(): Promise<{ presets: ConfigPresetSummary[] }> {
  return requestJson("/api/config-presets");
}

export function createAuditRun(input: CreateAuditRunInput): Promise<RunJobRecord> {
  return requestJson("/api/runs/audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
}

export function createEvalRun(input: CreateEvalRunInput): Promise<RunJobRecord> {
  return requestJson("/api/runs/eval", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
}

export function getRunJob(jobId: string): Promise<RunJobRecord> {
  return requestJson(`/api/jobs/${encodeURIComponent(jobId)}`);
}

export function artifactRawUrl(runId: string, artifactName: string): string {
  return `/api/runs/${encodeURIComponent(runId)}/artifacts/${encodeURIComponent(artifactName)}`;
}

export async function getArtifactContent(runId: string, artifactName: string): Promise<string> {
  const response = await fetch(artifactRawUrl(runId, artifactName));
  if (!response.ok) {
    throw new Error(`Failed to load ${artifactName}`);
  }
  return response.text();
}

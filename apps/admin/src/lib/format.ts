import type { AdminRunStatus, ArtifactEntry, AuditIssue, AuditRecommendation, RunKind } from "@answerlens/contracts";

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

export function formatDateTime(value: string | undefined): string {
  if (!value) {
    return "Pending";
  }

  return dateFormatter.format(new Date(value));
}

export function formatKind(kind: RunKind): string {
  if (kind === "validation-import") {
    return "Validation import";
  }

  if (kind === "manual-import") {
    return "Manual import";
  }

  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

export function formatStatus(status: AdminRunStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function formatScore(value: number | null): string {
  if (value === null) {
    return "Pending";
  }

  return `${value}/100`;
}

export function severityTone(severity: AuditIssue["severity"]): "info" | "warn" | "error" | "success" {
  if (severity === "success") {
    return "success";
  }
  if (severity === "error") {
    return "error";
  }
  if (severity === "warn") {
    return "warn";
  }
  return "info";
}

export function artifactTone(
  artifact: ArtifactEntry,
  emphasisArtifacts: readonly string[]
): "info" | "warn" | "error" | "success" | "neutral" {
  if (emphasisArtifacts.includes(artifact.name)) {
    return "success";
  }

  if (artifact.contentType === "html") {
    return "info";
  }

  return "neutral";
}

export function humanizeSlug(value: string): string {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function downloadTextFile(filename: string, content: string, type = "text/plain;charset=utf-8"): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function openTextInNewTab(
  content: string,
  type = "text/plain;charset=utf-8"
): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function issueScope(issue: AuditIssue): string {
  return issue.pageUrl ?? issue.scope;
}

export function recommendationOutcome(recommendation: AuditRecommendation): string {
  return recommendation.expectedOutcome;
}

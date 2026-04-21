import type { AdminRunStatus, ArtifactEntry, AuditIssue, AuditRecommendation, RunKind } from "@answerlens/contracts";
import { type Locale, formatDate, translateRunKind, translateStatus } from "../shared/i18n.ts";

export function formatDateTime(value: string | undefined, locale: Locale): string {
  if (!value) {
    return locale === "zh-CN" ? "待生成" : "Pending";
  }

  return formatDate(
    value,
    locale,
    {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }
  );
}

export function formatKind(kind: RunKind, locale: Locale): string {
  return translateRunKind(kind, locale);
}

export function formatStatus(status: AdminRunStatus, locale: Locale): string {
  return translateStatus(status, locale);
}

export function formatScore(value: number | null, locale: Locale): string {
  if (value === null) {
    return locale === "zh-CN" ? "待生成" : "Pending";
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

export function downloadTextFile(filename: string, content: string, type = "text/plain;charset=utf-8"): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function openTextInNewTab(content: string, type = "text/plain;charset=utf-8"): void {
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

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { ArtifactViewer } from "../components/ArtifactViewer";
import { IssueTable } from "../components/IssueTable";
import { MetricTile } from "../components/MetricTile";
import { RecommendationList } from "../components/RecommendationList";
import { SectionHeader } from "../components/SectionHeader";
import { StatusBadge } from "../components/StatusBadge";
import { getRunDetail } from "../lib/api";
import { formatDateTime, formatKind, formatScore } from "../lib/format";
import pageStyles from "./PageLayout.module.css";
import uiStyles from "../components/UI.module.css";

const ARTIFACT_OPENING_ORDER = ["share-summary.md", "scorecard.md", "recommendations.md"];

export function RunDetailPage() {
  const params = useParams();
  const runId = params.runId ?? "";

  const runQuery = useQuery({
    queryKey: ["run-detail", runId],
    queryFn: () => getRunDetail(runId),
    enabled: runId.length > 0
  });

  const detail = runQuery.data;
  const auditScores = useMemo(() => Object.entries(detail?.auditResult?.scores ?? {}), [detail?.auditResult?.scores]);

  if (runQuery.isLoading) {
    return <p className={pageStyles.emptyState}>Loading run detail...</p>;
  }

  if (runQuery.isError || !detail) {
    return <p className={pageStyles.emptyState}>Unable to load that run. Return to the runs list and try again.</p>;
  }

  const overallScore =
    typeof detail.manifest.summary.overallScore === "number"
      ? detail.manifest.summary.overallScore
      : typeof detail.shareSummary?.metrics.overallScore === "number"
        ? detail.shareSummary.metrics.overallScore
        : null;
  const vavr = typeof detail.shareSummary?.metrics.vavr === "number" ? detail.shareSummary.metrics.vavr : null;
  const pageCount =
    typeof detail.auditResult?.summary.keyPageCount === "number"
      ? detail.auditResult.summary.keyPageCount
      : typeof detail.shareSummary?.metrics.keyPageCount === "number"
        ? detail.shareSummary.metrics.keyPageCount
        : null;

  return (
    <div className={pageStyles.page}>
      <SectionHeader
        eyebrow="Run detail"
        title={detail.manifest.site.display ?? detail.manifest.site.input}
        description={`${formatKind(detail.manifest.kind)} run generated ${formatDateTime(detail.manifest.generatedAt)}. Review the artifact order first, then inspect audit issues and score buckets.`}
        actions={<StatusBadge label={detail.manifest.kind} tone="info" />}
      />

      <section className={uiStyles.metricGrid}>
        <MetricTile
          label="Overall score"
          value={formatScore(overallScore)}
          tone={overallScore !== null && overallScore >= 90 ? "success" : "info"}
        />
        <MetricTile label="VAVR" value={formatScore(vavr)} helper="Only populated after eval-backed review." />
        <MetricTile label="Artifacts" value={String(detail.artifacts.length)} helper="Includes Markdown, HTML, and JSON outputs." />
        <MetricTile
          label="Key pages"
          value={pageCount === null ? "Pending" : String(pageCount)}
          helper="Derived from `site-audit.json` when available."
        />
      </section>

      <div className={pageStyles.grid}>
        <div className={pageStyles.mainColumn}>
          <section className={pageStyles.panel}>
            <p className={pageStyles.panelEyebrow}>Artifact workspace</p>
            <h2 className={pageStyles.panelTitle}>Open the report trail in order</h2>
            <p className={pageStyles.panelBody}>
              Start with {ARTIFACT_OPENING_ORDER.join(" -> ")}. Use the HTML report for full browsing, then drop back to
              the raw JSON artifacts if you need machine-contract detail.
            </p>
            <ArtifactViewer runId={detail.id} artifacts={detail.artifacts} />
          </section>

          <section className={pageStyles.panel}>
            <p className={pageStyles.panelEyebrow}>Audit issues</p>
            <h2 className={pageStyles.panelTitle}>Top issues</h2>
            <p className={pageStyles.panelBody}>
              These come directly from `site-audit.json`, so the UI stays aligned with the artifact contract.
            </p>
            <IssueTable issues={detail.auditResult?.issues.slice(0, 8) ?? []} />
          </section>

          <section className={pageStyles.panel}>
            <p className={pageStyles.panelEyebrow}>Fix path</p>
            <h2 className={pageStyles.panelTitle}>Recommendations</h2>
            <RecommendationList recommendations={detail.auditResult?.recommendations ?? []} />
          </section>
        </div>

        <div className={pageStyles.sideColumn}>
          <section className={pageStyles.panel}>
            <p className={pageStyles.panelEyebrow}>Run manifest</p>
            <h2 className={pageStyles.panelTitle}>Context</h2>
            <div className={pageStyles.metaList}>
              <div className={pageStyles.metaRow}>
                <span className={pageStyles.metaLabel}>Run id</span>
                <span className={pageStyles.metaValue}>{detail.manifest.run.id}</span>
              </div>
              <div className={pageStyles.metaRow}>
                <span className={pageStyles.metaLabel}>Site input</span>
                <span className={pageStyles.metaValue}>{detail.manifest.site.input}</span>
              </div>
              <div className={pageStyles.metaRow}>
                <span className={pageStyles.metaLabel}>Base URL</span>
                <span className={pageStyles.metaValue}>{detail.manifest.site.baseUrl}</span>
              </div>
              <div className={pageStyles.metaRow}>
                <span className={pageStyles.metaLabel}>Artifact version</span>
                <span className={pageStyles.metaValue}>{detail.manifest.run.artifactVersion}</span>
              </div>
              <div className={pageStyles.metaRow}>
                <span className={pageStyles.metaLabel}>Rule version</span>
                <span className={pageStyles.metaValue}>{detail.manifest.run.ruleVersion}</span>
              </div>
            </div>
          </section>

          <section className={pageStyles.panel}>
            <p className={pageStyles.panelEyebrow}>Score buckets</p>
            <h2 className={pageStyles.panelTitle}>Audit breakdown</h2>
            {auditScores.length === 0 ? (
              <p className={pageStyles.emptyState}>No bucket scores were available for this run.</p>
            ) : (
              <div className={pageStyles.scoreGrid}>
                {auditScores.map(([bucket, score]) => (
                  <article key={bucket} className={pageStyles.scoreCard}>
                    <p className={pageStyles.scoreCardTitle}>{bucket}</p>
                    <p className={pageStyles.scoreCardValue}>{typeof score.score === "number" ? `${score.score}/100` : "Pending"}</p>
                    <p className={pageStyles.scoreCardMeta}>
                      {score.issueCount} issues · {score.warnCount} warnings · {score.infoCount} info
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

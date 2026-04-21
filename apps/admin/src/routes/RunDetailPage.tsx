import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { translateBucket } from "../shared/i18n.ts";
import { ArtifactViewer } from "../components/ArtifactViewer";
import { IssueTable } from "../components/IssueTable";
import { MetricTile } from "../components/MetricTile";
import { RecommendationList } from "../components/RecommendationList";
import { SectionHeader } from "../components/SectionHeader";
import { StatusBadge } from "../components/StatusBadge";
import { getRunDetail } from "../lib/api";
import { formatDateTime, formatKind, formatScore } from "../lib/format";
import { useLocale } from "../lib/locale";
import pageStyles from "./PageLayout.module.css";
import uiStyles from "../components/UI.module.css";

const ARTIFACT_OPENING_ORDER = ["share-summary.md", "scorecard.md", "recommendations.md"];

export function RunDetailPage() {
  const { locale, t } = useLocale();
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
    return <p className={pageStyles.emptyState}>{t("admin.detail.loading")}</p>;
  }

  if (runQuery.isError || !detail) {
    return <p className={pageStyles.emptyState}>{t("admin.detail.error")}</p>;
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
  const topIssue = detail.shareSummary?.topIssues[0] ?? detail.auditResult?.issues[0] ?? null;
  const topRecommendation = detail.shareSummary?.topRecommendations[0] ?? detail.auditResult?.recommendations[0] ?? null;

  return (
    <div className={pageStyles.page}>
      <SectionHeader
        eyebrow={t("admin.detail.eyebrow")}
        title={detail.manifest.site.display ?? detail.manifest.site.input}
        description={t("admin.detail.description", {
          kind: formatKind(detail.manifest.kind, locale),
          date: formatDateTime(detail.manifest.generatedAt, locale)
        })}
        actions={<StatusBadge label={formatKind(detail.manifest.kind, locale)} tone="info" />}
      />

      <section className={uiStyles.metricGrid}>
        <MetricTile
          label={t("admin.detail.overallScore")}
          value={formatScore(overallScore, locale)}
          tone={overallScore !== null && overallScore >= 90 ? "success" : "info"}
        />
        <MetricTile label={t("admin.detail.vavr")} value={formatScore(vavr, locale)} helper={t("admin.detail.vavr.helper")} />
        <MetricTile label={t("admin.detail.artifacts")} value={String(detail.artifacts.length)} helper={t("admin.detail.artifacts.helper")} />
        <MetricTile
          label={t("admin.detail.keyPages")}
          value={pageCount === null ? t("common.pending") : String(pageCount)}
          helper={t("admin.detail.keyPages.helper")}
        />
      </section>

      <div className={pageStyles.grid}>
        <div className={pageStyles.mainColumn}>
          <section className={pageStyles.panel}>
            <p className={pageStyles.panelEyebrow}>{t("admin.detail.signalEyebrow")}</p>
            <h2 className={pageStyles.panelTitle}>{t("admin.detail.signalTitle")}</h2>
            <p className={pageStyles.panelBody}>{t("admin.detail.signalBody")}</p>
            <div className={pageStyles.metaList}>
              <div className={pageStyles.metaRow}>
                <span className={pageStyles.metaLabel}>{t("admin.detail.topIssue")}</span>
                <span className={pageStyles.metaValue}>
                  {topIssue ? `${topIssue.title}${"severity" in topIssue ? ` (${topIssue.severity})` : ""} - ${topIssue.fixHint}` : t("admin.detail.none")}
                </span>
              </div>
              <div className={pageStyles.metaRow}>
                <span className={pageStyles.metaLabel}>{t("admin.detail.topFix")}</span>
                <span className={pageStyles.metaValue}>
                  {topRecommendation ? `${topRecommendation.title} - ${topRecommendation.expectedOutcome}` : t("admin.detail.none")}
                </span>
              </div>
            </div>
          </section>

          <section className={pageStyles.panel}>
            <p className={pageStyles.panelEyebrow}>{t("admin.detail.nextEyebrow")}</p>
            <h2 className={pageStyles.panelTitle}>{t("admin.detail.nextTitle")}</h2>
            <p className={pageStyles.panelBody}>{t("admin.detail.nextBody")}</p>
            <ol className={pageStyles.orderedList}>
              <li>{t("admin.detail.nextStep1")}</li>
              <li>{t("admin.detail.nextStep2")}</li>
              <li>{t("admin.detail.nextStep3")}</li>
              <li>{t("admin.detail.nextStep4")}</li>
            </ol>
          </section>

          <section className={pageStyles.panel}>
            <p className={pageStyles.panelEyebrow}>{t("admin.detail.workspaceEyebrow")}</p>
            <h2 className={pageStyles.panelTitle}>{t("admin.detail.workspaceTitle")}</h2>
            <p className={pageStyles.panelBody}>{t("admin.detail.workspaceBody", { order: ARTIFACT_OPENING_ORDER.join(" -> ") })}</p>
            <ArtifactViewer runId={detail.id} artifacts={detail.artifacts} />
          </section>

          <section className={pageStyles.panel}>
            <p className={pageStyles.panelEyebrow}>{t("admin.detail.issuesEyebrow")}</p>
            <h2 className={pageStyles.panelTitle}>{t("admin.detail.issuesTitle")}</h2>
            <p className={pageStyles.panelBody}>{t("admin.detail.issuesBody")}</p>
            <IssueTable issues={detail.auditResult?.issues.slice(0, 8) ?? []} />
          </section>

          <section className={pageStyles.panel}>
            <p className={pageStyles.panelEyebrow}>{t("admin.detail.fixEyebrow")}</p>
            <h2 className={pageStyles.panelTitle}>{t("admin.detail.fixTitle")}</h2>
            <RecommendationList recommendations={detail.auditResult?.recommendations ?? []} />
          </section>
        </div>

        <div className={pageStyles.sideColumn}>
          <section className={pageStyles.panel}>
            <p className={pageStyles.panelEyebrow}>{t("admin.detail.contextEyebrow")}</p>
            <h2 className={pageStyles.panelTitle}>{t("admin.detail.contextTitle")}</h2>
            <div className={pageStyles.metaList}>
              <div className={pageStyles.metaRow}>
                <span className={pageStyles.metaLabel}>{t("admin.detail.runId")}</span>
                <span className={pageStyles.metaValue}>{detail.manifest.run.id}</span>
              </div>
              <div className={pageStyles.metaRow}>
                <span className={pageStyles.metaLabel}>{t("admin.detail.siteInput")}</span>
                <span className={pageStyles.metaValue}>{detail.manifest.site.input}</span>
              </div>
              <div className={pageStyles.metaRow}>
                <span className={pageStyles.metaLabel}>{t("admin.detail.baseUrl")}</span>
                <span className={pageStyles.metaValue}>{detail.manifest.site.baseUrl}</span>
              </div>
              <div className={pageStyles.metaRow}>
                <span className={pageStyles.metaLabel}>{t("admin.detail.artifactVersion")}</span>
                <span className={pageStyles.metaValue}>{detail.manifest.run.artifactVersion}</span>
              </div>
              <div className={pageStyles.metaRow}>
                <span className={pageStyles.metaLabel}>{t("admin.detail.ruleVersion")}</span>
                <span className={pageStyles.metaValue}>{detail.manifest.run.ruleVersion}</span>
              </div>
            </div>
          </section>

          <section className={pageStyles.panel}>
            <p className={pageStyles.panelEyebrow}>{t("admin.detail.bucketsEyebrow")}</p>
            <h2 className={pageStyles.panelTitle}>{t("admin.detail.bucketsTitle")}</h2>
            {auditScores.length === 0 ? (
              <p className={pageStyles.emptyState}>{t("admin.detail.bucketsEmpty")}</p>
            ) : (
              <div className={pageStyles.scoreGrid}>
                {auditScores.map(([bucket, score]) => (
                  <article key={bucket} className={pageStyles.scoreCard}>
                    <p className={pageStyles.scoreCardTitle}>{translateBucket(bucket, locale)}</p>
                    <p className={pageStyles.scoreCardValue}>{typeof score.score === "number" ? `${score.score}/100` : t("common.pending")}</p>
                    <p className={pageStyles.scoreCardMeta}>
                      {t("admin.detail.bucketMeta", { issues: score.issueCount, warnings: score.warnCount, info: score.infoCount })}
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

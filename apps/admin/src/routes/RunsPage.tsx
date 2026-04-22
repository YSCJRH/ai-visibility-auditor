import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { MetricTile } from "../components/MetricTile";
import { RunTable } from "../components/RunTable";
import { SectionHeader } from "../components/SectionHeader";
import { listRuns } from "../lib/api";
import { formatDateTime, formatScore } from "../lib/format";
import { useLocale } from "../lib/locale";
import pageStyles from "./PageLayout.module.css";
import uiStyles from "../components/UI.module.css";

type KindFilter = "all" | "audit" | "eval";

export function RunsPage() {
  const { locale, t } = useLocale();
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const runsQuery = useQuery({
    queryKey: ["runs"],
    queryFn: listRuns
  });

  const runs = runsQuery.data?.runs ?? [];
  const filteredRuns = useMemo(
    () => runs.filter((run) => (kindFilter === "all" ? true : run.kind === kindFilter)),
    [kindFilter, runs]
  );

  const averageScore =
    runs.length > 0
      ? Math.round(runs.reduce((total, run) => total + (run.overallScore ?? 0), 0) / runs.length)
      : null;
  const latestRun = runs[0] ?? null;
  const auditCount = runs.filter((run) => run.kind === "audit").length;
  const evalCount = runs.filter((run) => run.kind === "eval").length;

  return (
    <div className={pageStyles.page}>
      <SectionHeader
        eyebrow={t("admin.runs.eyebrow")}
        title={t("admin.runs.title")}
        description={t("admin.runs.description")}
      />

      <section className={uiStyles.metricGrid}>
        <MetricTile label={t("admin.runs.totalRuns")} value={String(runs.length)} helper={t("admin.runs.totalRuns.helper")} />
        <MetricTile
          label={t("admin.runs.averageScore")}
          value={formatScore(averageScore, locale)}
          helper={t("admin.runs.averageScore.helper")}
          tone={averageScore !== null && averageScore >= 90 ? "success" : "info"}
        />
        <MetricTile
          label={t("admin.runs.latestRun")}
          value={latestRun ? formatScore(latestRun.overallScore, locale) : t("common.pending")}
          helper={latestRun ? latestRun.siteLabel : t("admin.runs.latestRun.helper")}
          tone={latestRun !== null && latestRun.overallScore !== null && latestRun.overallScore >= 90 ? "success" : "neutral"}
        />
        <MetricTile label={t("admin.runs.mix")} value={`${auditCount}:${evalCount}`} helper={t("admin.runs.mix.helper")} />
      </section>

      <div className={pageStyles.grid}>
        <section className={`${pageStyles.panel} ${pageStyles.mainColumn}`}>
          <p className={pageStyles.panelEyebrow}>{t("admin.runs.guideEyebrow")}</p>
          <h2 className={pageStyles.panelTitle}>{t("admin.runs.guideTitle")}</h2>
          <p className={pageStyles.panelBody}>{t("admin.runs.guideBody")}</p>
          {latestRun ? (
            <div className={pageStyles.metaList}>
              <div className={pageStyles.metaRow}>
                <span className={pageStyles.metaLabel}>{t("admin.runs.latestRun")}</span>
                <span className={pageStyles.metaValue}>{latestRun.siteLabel}</span>
              </div>
              <div className={pageStyles.metaRow}>
                <span className={pageStyles.metaLabel}>{t("admin.table.score")}</span>
                <span className={pageStyles.metaValue}>{formatScore(latestRun.overallScore, locale)}</span>
              </div>
              <div className={pageStyles.metaRow}>
                <span className={pageStyles.metaLabel}>{t("admin.table.generated")}</span>
                <span className={pageStyles.metaValue}>{formatDateTime(latestRun.generatedAt, locale)}</span>
              </div>
              <div className={pageStyles.buttonRow}>
                <Link className={`${uiStyles.button} ${uiStyles.buttonPrimary}`} to={`/runs/${latestRun.id}`}>
                  {t("admin.runs.guideOpen")}
                </Link>
              </div>
            </div>
          ) : (
            <p className={pageStyles.emptyState}>{t("admin.runs.guideEmpty")}</p>
          )}
        </section>

        <section className={`${pageStyles.panel} ${pageStyles.sideColumn}`}>
          <p className={pageStyles.panelEyebrow}>{t("admin.runs.nextEyebrow")}</p>
          <h2 className={pageStyles.panelTitle}>{t("admin.runs.nextTitle")}</h2>
          <p className={pageStyles.panelBody}>{t("admin.runs.nextBody")}</p>
          <ol className={pageStyles.orderedList}>
            <li>{t("admin.runs.nextStep1")}</li>
            <li>{t("admin.runs.nextStep2")}</li>
            <li>{t("admin.runs.nextStep3")}</li>
          </ol>
        </section>
      </div>

      <section className={pageStyles.panel}>
        <div className={pageStyles.filterRow}>
          {[
            { label: t("admin.runs.filter.all"), value: "all" as const },
            { label: t("admin.runs.filter.audit"), value: "audit" as const },
            { label: t("admin.runs.filter.eval"), value: "eval" as const }
          ].map((filter) => (
            <button
              key={filter.value}
              type="button"
              className={`${pageStyles.filterButton} ${kindFilter === filter.value ? pageStyles.filterButtonActive : ""}`}
              onClick={() => setKindFilter(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {runsQuery.isLoading ? <p className={pageStyles.emptyState}>{t("admin.runs.loading")}</p> : null}
        {runsQuery.isError ? <p className={pageStyles.emptyState}>{t("admin.runs.error")}</p> : null}
        {!runsQuery.isLoading && filteredRuns.length === 0 ? (
          <p className={pageStyles.emptyState}>{t("admin.runs.empty")}</p>
        ) : null}
        {filteredRuns.length > 0 ? <RunTable runs={filteredRuns} /> : null}
      </section>
    </div>
  );
}

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MetricTile } from "../components/MetricTile";
import { RunTable } from "../components/RunTable";
import { SectionHeader } from "../components/SectionHeader";
import { listRuns } from "../lib/api";
import { formatScore } from "../lib/format";
import pageStyles from "./PageLayout.module.css";
import uiStyles from "../components/UI.module.css";

type KindFilter = "all" | "audit" | "eval";

export function RunsPage() {
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
        eyebrow="Runs workspace"
        title="Review the latest file-backed runs"
        description="The admin surface starts from completed artifacts, not charts. Use the run list to jump into the report trail, inspect score shifts, and open the three primary review artifacts in order."
      />

      <section className={uiStyles.metricGrid}>
        <MetricTile label="Total runs" value={String(runs.length)} helper="All artifacts currently readable from `runs/*`." />
        <MetricTile
          label="Average score"
          value={formatScore(averageScore)}
          helper="A quick pulse across the current local history."
          tone={averageScore !== null && averageScore >= 90 ? "success" : "info"}
        />
        <MetricTile
          label="Latest run"
          value={latestRun ? formatScore(latestRun.overallScore) : "Pending"}
          helper={latestRun ? latestRun.siteLabel : "Launch a run from the top bar to seed the workspace."}
          tone={latestRun?.overallScore !== null && latestRun.overallScore >= 90 ? "success" : "neutral"}
        />
        <MetricTile label="Run mix" value={`${auditCount}:${evalCount}`} helper="Audit to eval count across the local workspace." />
      </section>

      <section className={pageStyles.panel}>
        <div className={pageStyles.filterRow}>
          {[
            { label: "All runs", value: "all" as const },
            { label: "Audit only", value: "audit" as const },
            { label: "Eval only", value: "eval" as const }
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

        {runsQuery.isLoading ? <p className={pageStyles.emptyState}>Loading runs...</p> : null}
        {runsQuery.isError ? <p className={pageStyles.emptyState}>Unable to read the run workspace.</p> : null}
        {!runsQuery.isLoading && filteredRuns.length === 0 ? (
          <p className={pageStyles.emptyState}>No runs matched this filter yet. Launch a fresh audit to seed the workspace.</p>
        ) : null}
        {filteredRuns.length > 0 ? <RunTable runs={filteredRuns} /> : null}
      </section>
    </div>
  );
}

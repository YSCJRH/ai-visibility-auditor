import { Link } from "react-router-dom";
import type { AdminRunListItem } from "@answerlens/contracts";
import { formatDateTime, formatKind, formatScore, formatStatus } from "../lib/format";
import { useLocale } from "../lib/locale";
import { StatusBadge } from "./StatusBadge";
import styles from "./UI.module.css";

type RunTableProps = {
  runs: AdminRunListItem[];
};

export function RunTable({ runs }: RunTableProps) {
  const { locale, t } = useLocale();

  return (
    <div className={styles.tableWrap}>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
          <tr>
            <th>{t("admin.table.run")}</th>
            <th>{t("admin.table.site")}</th>
            <th>{t("admin.table.kind")}</th>
            <th>{t("admin.table.score")}</th>
            <th>{t("admin.table.status")}</th>
            <th>{t("admin.table.generated")}</th>
          </tr>
          </thead>
          <tbody>
          {runs.map((run) => (
            <tr key={run.id}>
              <td data-label={t("admin.table.run")}>
                <Link className={styles.tableLink} to={`/runs/${run.id}`}>
                  {run.id}
                </Link>
              </td>
              <td data-label={t("admin.table.site")}>
                <strong>{run.siteLabel}</strong>
                <div className={styles.tableSubtle}>{run.siteInput}</div>
              </td>
              <td data-label={t("admin.table.kind")}>{formatKind(run.kind, locale)}</td>
              <td data-label={t("admin.table.score")}>{formatScore(run.overallScore, locale)}</td>
              <td data-label={t("admin.table.status")}>
                <StatusBadge label={formatStatus(run.status, locale)} tone={run.status === "completed" ? "success" : "info"} />
              </td>
              <td data-label={t("admin.table.generated")}>{formatDateTime(run.generatedAt, locale)}</td>
            </tr>
          ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { Link } from "react-router-dom";
import type { AdminRunListItem } from "@answerlens/contracts";
import { formatDateTime, formatKind, formatScore, formatStatus } from "../lib/format";
import { useLocale } from "../lib/locale";
import { StatusBadge } from "./StatusBadge";
import pageStyles from "../routes/PageLayout.module.css";

type RunTableProps = {
  runs: AdminRunListItem[];
};

export function RunTable({ runs }: RunTableProps) {
  const { locale, t } = useLocale();

  return (
    <div className={pageStyles.tableWrap}>
      <table className={pageStyles.table}>
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
              <td>
                <Link className={pageStyles.tableLink} to={`/runs/${run.id}`}>
                  {run.id}
                </Link>
              </td>
              <td>
                <strong>{run.siteLabel}</strong>
                <div className={pageStyles.tableSubtle}>{run.siteInput}</div>
              </td>
              <td>{formatKind(run.kind, locale)}</td>
              <td>{formatScore(run.overallScore, locale)}</td>
              <td>
                <StatusBadge label={formatStatus(run.status, locale)} tone={run.status === "completed" ? "success" : "info"} />
              </td>
              <td>{formatDateTime(run.generatedAt, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

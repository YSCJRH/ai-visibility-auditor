import { Link } from "react-router-dom";
import type { AdminRunListItem } from "@answerlens/contracts";
import { formatDateTime, formatKind, formatScore, formatStatus } from "../lib/format";
import { StatusBadge } from "./StatusBadge";
import pageStyles from "../routes/PageLayout.module.css";

type RunTableProps = {
  runs: AdminRunListItem[];
};

export function RunTable({ runs }: RunTableProps) {
  return (
    <div className={pageStyles.tableWrap}>
      <table className={pageStyles.table}>
        <thead>
          <tr>
            <th>Run</th>
            <th>Site</th>
            <th>Kind</th>
            <th>Score</th>
            <th>Status</th>
            <th>Generated</th>
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
              <td>{formatKind(run.kind)}</td>
              <td>{formatScore(run.overallScore)}</td>
              <td>
                <StatusBadge label={formatStatus(run.status)} tone={run.status === "completed" ? "success" : "info"} />
              </td>
              <td>{formatDateTime(run.generatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import type { AuditIssue } from "@answerlens/contracts";
import { issueScope, severityTone } from "../lib/format";
import { StatusBadge } from "./StatusBadge";
import pageStyles from "../routes/PageLayout.module.css";

type IssueTableProps = {
  issues: AuditIssue[];
};

export function IssueTable({ issues }: IssueTableProps) {
  if (issues.length === 0) {
    return <p className={pageStyles.emptyState}>No current issues in the audit artifact.</p>;
  }

  return (
    <div className={pageStyles.tableWrap}>
      <table className={pageStyles.table}>
        <thead>
          <tr>
            <th>Severity</th>
            <th>Issue</th>
            <th>Scope</th>
            <th>Fix hint</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => (
            <tr key={issue.id}>
              <td>
                <StatusBadge label={issue.severity} tone={severityTone(issue.severity)} />
              </td>
              <td>
                <strong>{issue.title}</strong>
                <div className={pageStyles.tableSubtle}>{issue.message}</div>
              </td>
              <td>{issueScope(issue)}</td>
              <td>{issue.fixHint}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

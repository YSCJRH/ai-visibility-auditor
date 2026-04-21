import type { AuditIssue } from "@answerlens/contracts";
import { translateFixHint, translateIssueTitle, translateScope, translateSeverity } from "../shared/i18n.ts";
import { severityTone } from "../lib/format";
import { useLocale } from "../lib/locale";
import { StatusBadge } from "./StatusBadge";
import pageStyles from "../routes/PageLayout.module.css";

type IssueTableProps = {
  issues: AuditIssue[];
};

export function IssueTable({ issues }: IssueTableProps) {
  const { locale, t } = useLocale();

  if (issues.length === 0) {
    return <p className={pageStyles.emptyState}>{t("admin.issues.empty")}</p>;
  }

  return (
    <div className={pageStyles.tableWrap}>
      <table className={pageStyles.table}>
        <thead>
          <tr>
            <th>{t("admin.issues.severity")}</th>
            <th>{t("admin.issues.issue")}</th>
            <th>{t("admin.issues.scope")}</th>
            <th>{t("admin.issues.fixHint")}</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => (
            <tr key={issue.id}>
              <td>
                <StatusBadge label={translateSeverity(issue.severity, locale)} tone={severityTone(issue.severity)} />
              </td>
              <td>
                <strong>{translateIssueTitle(issue.title, locale)}</strong>
                <div className={pageStyles.tableSubtle}>{issue.message}</div>
              </td>
              <td>{issue.pageUrl ?? translateScope(issue.scope, locale)}</td>
              <td>{translateFixHint(issue.fixHint, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

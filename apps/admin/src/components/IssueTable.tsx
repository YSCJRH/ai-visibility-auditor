import type { AuditIssue } from "@answerlens/contracts";
import { translateFixHint, translateIssueTitle, translateScope, translateSeverity } from "../shared/i18n.ts";
import { severityTone } from "../lib/format";
import { useLocale } from "../lib/locale";
import { StatusBadge } from "./StatusBadge";
import styles from "./UI.module.css";

type IssueTableProps = {
  issues: AuditIssue[];
};

export function IssueTable({ issues }: IssueTableProps) {
  const { locale, t } = useLocale();

  if (issues.length === 0) {
    return <p className={styles.emptyState}>{t("admin.issues.empty")}</p>;
  }

  return (
    <div className={styles.tableWrap}>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
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
              <td data-label={t("admin.issues.severity")}>
                <StatusBadge label={translateSeverity(issue.severity, locale)} tone={severityTone(issue.severity)} />
              </td>
              <td data-label={t("admin.issues.issue")}>
                <strong>{translateIssueTitle(issue.title, locale)}</strong>
                <div className={styles.tableSubtle}>{issue.message}</div>
              </td>
              <td data-label={t("admin.issues.scope")}>{issue.pageUrl ?? translateScope(issue.scope, locale)}</td>
              <td data-label={t("admin.issues.fixHint")}>{translateFixHint(issue.fixHint, locale)}</td>
            </tr>
          ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

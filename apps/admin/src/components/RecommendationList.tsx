import type { AuditRecommendation } from "@answerlens/contracts";
import { translateExpectedOutcome, translateRecommendationRationale, translateRecommendationTitle } from "../shared/i18n.ts";
import { useLocale } from "../lib/locale";
import styles from "./UI.module.css";

type RecommendationListProps = {
  recommendations: AuditRecommendation[];
};

export function RecommendationList({ recommendations }: RecommendationListProps) {
  const { locale, t } = useLocale();

  if (recommendations.length === 0) {
    return <p className={styles.emptyState}>{t("admin.recommendation.empty")}</p>;
  }

  return (
    <div className={styles.listStack}>
      {recommendations.map((recommendation) => (
        <article key={recommendation.id} className={styles.listCard}>
          <p className={styles.surfaceEyebrow}>{t("admin.recommendation.eyebrow")}</p>
          <h3 className={styles.listCardTitle}>{translateRecommendationTitle(recommendation.title, locale)}</h3>
          <p className={styles.listCardBody}>{translateRecommendationRationale(recommendation.rationale, locale)}</p>
          <p className={styles.listCardOutcome}>{translateExpectedOutcome(recommendation.expectedOutcome, locale)}</p>
        </article>
      ))}
    </div>
  );
}

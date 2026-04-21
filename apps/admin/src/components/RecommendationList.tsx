import type { AuditRecommendation } from "@answerlens/contracts";
import { translateExpectedOutcome, translateRecommendationRationale, translateRecommendationTitle } from "../shared/i18n.ts";
import { useLocale } from "../lib/locale";
import pageStyles from "../routes/PageLayout.module.css";

type RecommendationListProps = {
  recommendations: AuditRecommendation[];
};

export function RecommendationList({ recommendations }: RecommendationListProps) {
  const { locale, t } = useLocale();

  if (recommendations.length === 0) {
    return <p className={pageStyles.emptyState}>{t("admin.recommendation.empty")}</p>;
  }

  return (
    <div className={pageStyles.stack}>
      {recommendations.map((recommendation) => (
        <article key={recommendation.id} className={pageStyles.panel}>
          <p className={pageStyles.panelEyebrow}>{t("admin.recommendation.eyebrow")}</p>
          <h3 className={pageStyles.panelTitle}>{translateRecommendationTitle(recommendation.title, locale)}</h3>
          <p className={pageStyles.panelBody}>{translateRecommendationRationale(recommendation.rationale, locale)}</p>
          <p className={pageStyles.panelOutcome}>{translateExpectedOutcome(recommendation.expectedOutcome, locale)}</p>
        </article>
      ))}
    </div>
  );
}

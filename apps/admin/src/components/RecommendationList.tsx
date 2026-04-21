import type { AuditRecommendation } from "@answerlens/contracts";
import { recommendationOutcome } from "../lib/format";
import pageStyles from "../routes/PageLayout.module.css";

type RecommendationListProps = {
  recommendations: AuditRecommendation[];
};

export function RecommendationList({ recommendations }: RecommendationListProps) {
  if (recommendations.length === 0) {
    return <p className={pageStyles.emptyState}>No recommendation artifact was available for this run.</p>;
  }

  return (
    <div className={pageStyles.stack}>
      {recommendations.map((recommendation) => (
        <article key={recommendation.id} className={pageStyles.panel}>
          <p className={pageStyles.panelEyebrow}>Recommendation</p>
          <h3 className={pageStyles.panelTitle}>{recommendation.title}</h3>
          <p className={pageStyles.panelBody}>{recommendation.rationale}</p>
          <p className={pageStyles.panelOutcome}>{recommendationOutcome(recommendation)}</p>
        </article>
      ))}
    </div>
  );
}

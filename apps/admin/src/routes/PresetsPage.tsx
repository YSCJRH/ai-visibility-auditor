import { useQuery } from "@tanstack/react-query";
import { MetricTile } from "../components/MetricTile";
import { SectionHeader } from "../components/SectionHeader";
import { listConfigPresets } from "../lib/api";
import { useLocale } from "../lib/locale";
import pageStyles from "./PageLayout.module.css";
import uiStyles from "../components/UI.module.css";

export function PresetsPage() {
  const { t } = useLocale();
  const presetsQuery = useQuery({
    queryKey: ["config-presets"],
    queryFn: listConfigPresets
  });

  const presets = presetsQuery.data?.presets ?? [];

  return (
    <div className={pageStyles.page}>
      <SectionHeader
        eyebrow={t("admin.presets.eyebrow")}
        title={t("admin.presets.title")}
        description={t("admin.presets.description")}
      />

      <section className={uiStyles.metricGrid}>
        <MetricTile label={t("admin.presets.count")} value={String(presets.length)} helper={t("admin.presets.count.helper")} />
        <MetricTile
          label={t("admin.presets.primary")}
          value={presets[0]?.label ?? t("common.pending")}
          helper={presets[0]?.defaultSiteInput ?? t("admin.presets.primary.empty")}
        />
      </section>

      {presetsQuery.isLoading ? <p className={pageStyles.emptyState}>{t("admin.presets.loading")}</p> : null}
      {presetsQuery.isError ? <p className={pageStyles.emptyState}>{t("admin.presets.error")}</p> : null}

      <div className={pageStyles.stack}>
        {presets.map((preset) => (
          <article key={preset.id} className={pageStyles.panel}>
            <p className={pageStyles.panelEyebrow}>{preset.id}</p>
            <h2 className={pageStyles.panelTitle}>{preset.label}</h2>
            <p className={pageStyles.panelBody}>{preset.description}</p>
            <div className={pageStyles.metaList}>
              <div className={pageStyles.metaRow}>
                <span className={pageStyles.metaLabel}>{t("admin.presets.defaultSite")}</span>
                <span className={pageStyles.metaValue}>{preset.defaultSiteInput}</span>
              </div>
              <div className={pageStyles.metaRow}>
                <span className={pageStyles.metaLabel}>{t("admin.presets.displayName")}</span>
                <span className={pageStyles.metaValue}>{preset.siteDisplayName ?? t("admin.presets.displayName.empty")}</span>
              </div>
              <div className={pageStyles.metaRow}>
                <span className={pageStyles.metaLabel}>{t("admin.presets.domain")}</span>
                <span className={pageStyles.metaValue}>{preset.domain}</span>
              </div>
              <div className={pageStyles.metaRow}>
                <span className={pageStyles.metaLabel}>{t("admin.presets.files")}</span>
                <span className={pageStyles.metaValue}>
                  {preset.brandPath}
                  <br />
                  {preset.competitorsPath}
                  <br />
                  {preset.promptsPath}
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import type { ConfigPresetSummary } from "@answerlens/contracts";
import { MetricTile } from "../components/MetricTile";
import { SectionHeader } from "../components/SectionHeader";
import { listConfigPresets } from "../lib/api";
import { useLocale } from "../lib/locale";
import pageStyles from "./PageLayout.module.css";
import uiStyles from "../components/UI.module.css";

function presetUse(preset: ConfigPresetSummary, t: (key: string) => string): string {
  if (preset.id === "example-acme") {
    return t("admin.presets.use.fixture");
  }
  if (preset.id === "repo-answerlens") {
    return t("admin.presets.use.repo");
  }
  return t("admin.presets.use.starter");
}

function presetNextMove(preset: ConfigPresetSummary, t: (key: string) => string): string {
  if (preset.id === "example-acme") {
    return t("admin.presets.next.fixture");
  }
  if (preset.id === "repo-answerlens") {
    return t("admin.presets.next.repo");
  }
  return t("admin.presets.next.starter");
}

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

      <section className={uiStyles.surfaceCard}>
        <div className={uiStyles.surfaceInner}>
          <p className={uiStyles.surfaceEyebrow}>{t("admin.presets.guideEyebrow")}</p>
          <h2 className={uiStyles.surfaceTitle}>{t("admin.presets.guideTitle")}</h2>
          <p className={uiStyles.surfaceBody}>{t("admin.presets.guideBody")}</p>
        </div>
      </section>

      {presetsQuery.isLoading ? <p className={pageStyles.emptyState}>{t("admin.presets.loading")}</p> : null}
      {presetsQuery.isError ? <p className={pageStyles.emptyState}>{t("admin.presets.error")}</p> : null}

      <div className={pageStyles.cardGrid}>
        {presets.map((preset) => (
          <article key={preset.id} className={uiStyles.surfaceCard}>
            <div className={uiStyles.surfaceInner}>
              <p className={uiStyles.surfaceEyebrow}>{preset.id}</p>
              <h2 className={uiStyles.surfaceTitle}>{preset.label}</h2>
              <p className={uiStyles.surfaceBody}>{preset.description}</p>
              <div className={uiStyles.metaList}>
                <div className={uiStyles.metaRow}>
                  <span className={uiStyles.metaLabel}>{t("admin.presets.purpose")}</span>
                  <span className={uiStyles.metaValue}>{presetUse(preset, t)}</span>
                </div>
                <div className={uiStyles.metaRow}>
                  <span className={uiStyles.metaLabel}>{t("admin.presets.nextMove")}</span>
                  <span className={uiStyles.metaValue}>{presetNextMove(preset, t)}</span>
                </div>
                <div className={uiStyles.metaRow}>
                  <span className={uiStyles.metaLabel}>{t("admin.presets.defaultSite")}</span>
                  <span className={uiStyles.metaValue}>{preset.defaultSiteInput}</span>
                </div>
                <div className={uiStyles.metaRow}>
                  <span className={uiStyles.metaLabel}>{t("admin.presets.displayName")}</span>
                  <span className={uiStyles.metaValue}>{preset.siteDisplayName ?? t("admin.presets.displayName.empty")}</span>
                </div>
                <div className={uiStyles.metaRow}>
                  <span className={uiStyles.metaLabel}>{t("admin.presets.domain")}</span>
                  <span className={uiStyles.metaValue}>{preset.domain}</span>
                </div>
                <div className={uiStyles.metaRow}>
                  <span className={uiStyles.metaLabel}>{t("admin.presets.files")}</span>
                  <span className={uiStyles.metaValue}>
                    {preset.brandPath}
                    <br />
                    {preset.competitorsPath}
                    <br />
                    {preset.promptsPath}
                  </span>
                </div>
                {preset.runtimePath ? (
                  <div className={uiStyles.metaRow}>
                    <span className={uiStyles.metaLabel}>{t("admin.presets.runtime")}</span>
                    <span className={uiStyles.metaValue}>{preset.runtimePath}</span>
                  </div>
                ) : null}
                {preset.runtimeDefaults ? (
                  <div className={uiStyles.metaRow}>
                    <span className={uiStyles.metaLabel}>{t("admin.presets.runtimeDefaults")}</span>
                    <span className={uiStyles.metaValue}>
                      {preset.runtimeDefaults.provider}
                      <br />
                      {preset.runtimeDefaults.model}
                      <br />
                      {(preset.runtimeDefaults.locale ?? t("common.pending"))} · {preset.runtimeDefaults.samples}
                    </span>
                  </div>
                ) : null}
                {preset.runtimeDefaults ? (
                  <div className={uiStyles.metaRow}>
                    <span className={uiStyles.metaLabel}>{t("admin.presets.runtimeNetwork")}</span>
                    <span className={uiStyles.metaValue}>
                      {preset.runtimeDefaults.timeoutMs}ms
                      <br />
                      {preset.runtimeDefaults.baseUrl}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { MetricTile } from "../components/MetricTile";
import { SectionHeader } from "../components/SectionHeader";
import { listConfigPresets } from "../lib/api";
import pageStyles from "./PageLayout.module.css";
import uiStyles from "../components/UI.module.css";

export function PresetsPage() {
  const presetsQuery = useQuery({
    queryKey: ["config-presets"],
    queryFn: listConfigPresets
  });

  const presets = presetsQuery.data?.presets ?? [];

  return (
    <div className={pageStyles.page}>
      <SectionHeader
        eyebrow="Preset registry"
        title="Repo-native configuration sources"
        description="The admin console reads the same preset families that power the public demo, self-dogfooding loop, and consumer-repo starter bundle. These are the sources the launcher can use without editing YAML in the browser."
      />

      <section className={uiStyles.metricGrid}>
        <MetricTile label="Preset count" value={String(presets.length)} helper="Current configuration sources visible to the BFF." />
        <MetricTile
          label="Primary target"
          value={presets[0]?.label ?? "Pending"}
          helper={presets[0]?.defaultSiteInput ?? "No preset loaded yet."}
        />
      </section>

      {presetsQuery.isLoading ? <p className={pageStyles.emptyState}>Loading presets...</p> : null}
      {presetsQuery.isError ? <p className={pageStyles.emptyState}>Unable to load the preset registry.</p> : null}

      <div className={pageStyles.stack}>
        {presets.map((preset) => (
          <article key={preset.id} className={pageStyles.panel}>
            <p className={pageStyles.panelEyebrow}>{preset.id}</p>
            <h2 className={pageStyles.panelTitle}>{preset.label}</h2>
            <p className={pageStyles.panelBody}>{preset.description}</p>
            <div className={pageStyles.metaList}>
              <div className={pageStyles.metaRow}>
                <span className={pageStyles.metaLabel}>Default site</span>
                <span className={pageStyles.metaValue}>{preset.defaultSiteInput}</span>
              </div>
              <div className={pageStyles.metaRow}>
                <span className={pageStyles.metaLabel}>Display name</span>
                <span className={pageStyles.metaValue}>{preset.siteDisplayName ?? "Not set"}</span>
              </div>
              <div className={pageStyles.metaRow}>
                <span className={pageStyles.metaLabel}>Domain</span>
                <span className={pageStyles.metaValue}>{preset.domain}</span>
              </div>
              <div className={pageStyles.metaRow}>
                <span className={pageStyles.metaLabel}>Files</span>
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

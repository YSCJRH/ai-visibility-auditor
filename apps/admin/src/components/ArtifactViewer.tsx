import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Locale } from "../shared/i18n.ts";
import type { ArtifactEntry } from "@answerlens/contracts";
import ReactMarkdown from "react-markdown";
import { artifactRawUrl, getArtifactContent } from "../lib/api";
import { artifactTone, downloadTextFile, openTextInNewTab } from "../lib/format";
import { useLocale } from "../lib/locale";
import { StatusBadge } from "./StatusBadge";
import styles from "./ArtifactViewer.module.css";

const PRIMARY_ARTIFACTS = ["share-summary.md", "scorecard.md", "recommendations.md"];

type ArtifactViewerProps = {
  runId: string;
  artifacts: ArtifactEntry[];
};

function preferredArtifactName(name: string, locale: Locale): string {
  if (locale === "zh-CN" && name.endsWith(".md") && !name.endsWith(".zh.md")) {
    return name.replace(/\.md$/, ".zh.md");
  }
  if (locale === "zh-CN" && name === "index.html") {
    return "index.zh.html";
  }
  return name;
}

export function ArtifactViewer({ runId, artifacts }: ArtifactViewerProps) {
  const { locale, t } = useLocale();
  const visibleArtifacts = useMemo(
    () => artifacts.filter((artifact) => !artifact.name.endsWith(".zh.md") && artifact.name !== "index.zh.html"),
    [artifacts]
  );
  const [selectedArtifactName, setSelectedArtifactName] = useState(preferredArtifactName(visibleArtifacts[0]?.name ?? "", locale));
  const selectedArtifact = useMemo(
    () => artifacts.find((artifact) => artifact.name === selectedArtifactName) ?? artifacts[0] ?? null,
    [artifacts, selectedArtifactName]
  );

  useEffect(() => {
    if (!visibleArtifacts[0]) {
      return;
    }
    const preferred = preferredArtifactName(visibleArtifacts[0].name, locale);
    if (!selectedArtifactName) {
      setSelectedArtifactName(preferred);
    }
  }, [locale, selectedArtifactName, visibleArtifacts]);

  const artifactQuery = useQuery({
    queryKey: ["artifact", runId, selectedArtifact?.name],
    queryFn: () => getArtifactContent(runId, selectedArtifact!.name),
    enabled: Boolean(selectedArtifact) && selectedArtifact?.contentType !== "html"
  });

  if (!selectedArtifact) {
    return null;
  }

  const rawUrl = artifactRawUrl(runId, selectedArtifact.name);
  const contentType =
    selectedArtifact.contentType === "json"
      ? "application/json;charset=utf-8"
      : selectedArtifact.contentType === "markdown"
        ? "text/markdown;charset=utf-8"
        : "text/plain;charset=utf-8";

  return (
    <section className={styles.viewer}>
      <div className={styles.toolbar}>
        <div className={styles.tabs} role="tablist" aria-label="Artifacts">
          {visibleArtifacts.map((artifact) => {
            const effectiveName = preferredArtifactName(artifact.name, locale);
            return (
              <button
                key={artifact.name}
                type="button"
                role="tab"
                className={`${styles.tab} ${effectiveName === selectedArtifact.name ? styles.tabActive : ""}`}
                onClick={() => setSelectedArtifactName(effectiveName)}
              >
                {artifact.name}
              </button>
            );
          })}
        </div>

        <div className={styles.actions}>
          <StatusBadge label={selectedArtifact.contentType} tone={artifactTone(selectedArtifact, PRIMARY_ARTIFACTS)} />
          <a className={styles.action} href={rawUrl} target="_blank" rel="noreferrer">
            {t("common.openRaw")}
          </a>
          {selectedArtifact.contentType === "html" ? (
            <a className={styles.action} href={rawUrl} download={selectedArtifact.name}>
              {t("common.download")}
            </a>
          ) : (
            <>
              <button
                className={styles.action}
                type="button"
                onClick={() => {
                  if (!artifactQuery.data) {
                    return;
                  }
                  downloadTextFile(selectedArtifact.name, artifactQuery.data, contentType);
                }}
              >
                {t("common.download")}
              </button>
              <button
                className={styles.action}
                type="button"
                onClick={() => {
                  if (!artifactQuery.data) {
                    return;
                  }
                  openTextInNewTab(artifactQuery.data, contentType);
                }}
              >
                {t("common.openPreview")}
              </button>
            </>
          )}
        </div>
      </div>

      <div className={styles.surface}>
        <div className={styles.orderCallout}>
          <p className={styles.orderEyebrow}>{t("admin.artifacts.orderEyebrow")}</p>
          <h3 className={styles.orderTitle}>{t("admin.artifacts.orderTitle")}</h3>
          <p className={styles.orderBody}>{t("admin.artifacts.orderBody")}</p>
          <ol className={styles.orderList}>
            <li>{t("admin.artifacts.orderStep1")}</li>
            <li>{t("admin.artifacts.orderStep2")}</li>
            <li>{t("admin.artifacts.orderStep3")}</li>
          </ol>
        </div>
        {selectedArtifact.contentType === "html" ? (
          <iframe className={styles.frame} title={selectedArtifact.name} src={rawUrl} />
        ) : (
          <div className={styles.content}>
            {artifactQuery.isLoading ? <p>{t("common.loadingArtifact")}</p> : null}
            {artifactQuery.isError ? <p>{t("common.unableToLoadArtifact", { name: selectedArtifact.name })}</p> : null}
            {artifactQuery.data && selectedArtifact.contentType === "markdown" ? (
              <div className={styles.markdown}>
                <ReactMarkdown>{artifactQuery.data}</ReactMarkdown>
              </div>
            ) : null}
            {artifactQuery.data && selectedArtifact.contentType !== "markdown" ? <pre>{artifactQuery.data}</pre> : null}
          </div>
        )}
      </div>
    </section>
  );
}

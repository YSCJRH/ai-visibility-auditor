import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import type { ArtifactEntry } from "@answerlens/contracts";
import { artifactRawUrl, getArtifactContent } from "../lib/api";
import { artifactTone, downloadTextFile, openTextInNewTab } from "../lib/format";
import { StatusBadge } from "./StatusBadge";
import styles from "./ArtifactViewer.module.css";

const PRIMARY_ARTIFACTS = ["share-summary.md", "scorecard.md", "recommendations.md"];

type ArtifactViewerProps = {
  runId: string;
  artifacts: ArtifactEntry[];
};

export function ArtifactViewer({ runId, artifacts }: ArtifactViewerProps) {
  const [selectedArtifactName, setSelectedArtifactName] = useState(artifacts[0]?.name ?? "");
  const selectedArtifact = useMemo(
    () => artifacts.find((artifact) => artifact.name === selectedArtifactName) ?? artifacts[0] ?? null,
    [artifacts, selectedArtifactName]
  );

  useEffect(() => {
    if (!selectedArtifact && artifacts[0]) {
      setSelectedArtifactName(artifacts[0].name);
    }
  }, [artifacts, selectedArtifact]);

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
          {artifacts.map((artifact) => (
            <button
              key={artifact.name}
              type="button"
              role="tab"
              className={`${styles.tab} ${artifact.name === selectedArtifact.name ? styles.tabActive : ""}`}
              onClick={() => setSelectedArtifactName(artifact.name)}
            >
              {artifact.name}
            </button>
          ))}
        </div>

        <div className={styles.actions}>
          <StatusBadge
            label={selectedArtifact.contentType}
            tone={artifactTone(selectedArtifact, PRIMARY_ARTIFACTS)}
          />
          <a className={styles.action} href={rawUrl} target="_blank" rel="noreferrer">
            Open raw
          </a>
          {selectedArtifact.contentType === "html" ? (
            <a className={styles.action} href={rawUrl} download={selectedArtifact.name}>
              Download
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
                Download
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
                Open preview
              </button>
            </>
          )}
        </div>
      </div>

      <div className={styles.surface}>
        {selectedArtifact.contentType === "html" ? (
          <iframe className={styles.frame} title={selectedArtifact.name} src={rawUrl} />
        ) : (
          <div className={styles.content}>
            {artifactQuery.isLoading ? <p>Loading artifact…</p> : null}
            {artifactQuery.isError ? <p>Unable to load {selectedArtifact.name}.</p> : null}
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

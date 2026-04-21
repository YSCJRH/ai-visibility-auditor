import styles from "./UI.module.css";

type MetricTileTone = "success" | "warn" | "error" | "info" | "neutral";

type MetricTileProps = {
  label: string;
  value: string;
  helper?: string;
  tone?: MetricTileTone;
};

export function MetricTile({ label, value, helper, tone = "neutral" }: MetricTileProps) {
  const toneClass =
    tone === "success"
      ? styles.toneSuccess
      : tone === "warn"
        ? styles.toneWarn
        : tone === "error"
          ? styles.toneError
          : tone === "info"
            ? styles.toneInfo
            : styles.toneNeutral;

  return (
    <article className={styles.metricTile}>
      <p className={styles.metricLabel}>{label}</p>
      <p className={`${styles.metricValue} ${toneClass}`}>{value}</p>
      {helper ? <p className={styles.metricHelper}>{helper}</p> : null}
    </article>
  );
}

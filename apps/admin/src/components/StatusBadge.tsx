import styles from "./UI.module.css";

type StatusTone = "success" | "warn" | "error" | "info" | "neutral";

type StatusBadgeProps = {
  label: string;
  tone?: StatusTone;
};

export function StatusBadge({ label, tone = "neutral" }: StatusBadgeProps) {
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

  return <span className={`${styles.statusBadge} ${toneClass}`}>{label}</span>;
}

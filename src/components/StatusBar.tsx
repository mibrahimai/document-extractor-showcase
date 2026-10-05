import { statusLabel } from "@/lib/format";
import styles from "./StatusBar.module.css";

const ORDER = ["approved", "extracted", "needs_review", "not_relevant", "rejected", "new"];

export function StatusBar({
  counts,
  height = 8,
  showLegend = false,
}: {
  counts: Record<string, number> | undefined;
  height?: number;
  showLegend?: boolean;
}) {
  const entries = ORDER.map((k) => [k, counts?.[k] ?? 0] as const).filter(([, n]) => n > 0);
  const total = entries.reduce((s, [, n]) => s + n, 0);
  return (
    <div>
      <div className={styles.bar} style={{ height }} role="img" aria-label="Status distribution">
        {total === 0 && <span className={styles.empty} />}
        {entries.map(([k, n]) => (
          <span
            key={k}
            className={`${styles.seg} ${styles[`seg_${k}`] || ""}`}
            style={{ flexGrow: n }}
            title={`${statusLabel(k)}: ${n}`}
          />
        ))}
      </div>
      {showLegend && total > 0 && (
        <div className={styles.legend}>
          {entries.map(([k, n]) => (
            <span key={k} className={styles.legendItem}>
              <span className={`${styles.swatch} ${styles[`seg_${k}`] || ""}`} />
              {statusLabel(k)} <strong>{n}</strong>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

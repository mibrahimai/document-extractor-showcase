"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api, EvidenceBox, PreviewInfo } from "@/lib/api";
import { Icon } from "./Icon";
import styles from "./DocumentViewer.module.css";

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2];

// The app's explicit theme choice, kept in sync so HTML previews (rendered
// server-side, shown in an iframe) switch light/dark along with the app.
function useAppTheme() {
  const read = () => document.documentElement.getAttribute("data-theme") || "system";
  const [theme, setTheme] = useState("system");
  useEffect(() => {
    setTheme(read());
    const obs = new MutationObserver(() => setTheme(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return theme;
}

export function DocumentViewer({
  projectId,
  docId,
  onShowText,
  boxes = [],
  htmlAnchors = [],
  labels = {},
  activeField = null,
  jump = 0,
  version = 0,
  onPickField,
}: {
  projectId: string;
  docId: string;
  onShowText: () => void;
  boxes?: EvidenceBox[];
  htmlAnchors?: string[];
  labels?: Record<string, string>;
  activeField?: string | null;
  jump?: number;
  version?: number;
  onPickField?: (field: string) => void;
}) {
  const [info, setInfo] = useState<PreviewInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [broken, setBroken] = useState<Set<number>>(new Set());
  const [showHighlights, setShowHighlights] = useState(true);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const theme = useAppTheme();

  useEffect(() => {
    setInfo(null);
    setError(null);
    setBroken(new Set());
    let alive = true;
    api
      .previewInfo(projectId, docId)
      .then((r) => alive && setInfo(r))
      .catch((e) => alive && setError(String(e.message || e)));
    return () => {
      alive = false;
    };
  }, [projectId, docId]);

  // One label per field (on its first box): a 43-item skills list with a
  // label on every box buries the very text it's pointing at.
  const firstActive = useMemo(
    () => boxes.find((b) => b.field === activeField && b.kind === "value") ?? null,
    [boxes, activeField]
  );

  const byPage = useMemo(() => {
    const m = new Map<number, EvidenceBox[]>();
    for (const b of boxes) {
      if (!m.has(b.page)) m.set(b.page, []);
      m.get(b.page)!.push(b);
    }
    return m;
  }, [boxes]);

  useEffect(() => {
    if (!activeField || !jump) return;
    setShowHighlights(true);
    const raf = requestAnimationFrame(() => {
      scrollerRef.current
        ?.querySelector(`[data-hl="${CSS.escape(activeField)}"]`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
    return () => cancelAnimationFrame(raf);
  }, [jump, activeField, info]);

  if (error || info?.kind === "none") {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon}>
          <Icon name="file" size={22} />
        </span>
        <strong>No preview for this file</strong>
        <span>{error || (info?.kind === "none" ? info.reason : "")}</span>
        <button type="button" className="btn btn-sm" onClick={onShowText}>
          Show extracted text
        </button>
      </div>
    );
  }

  if (!info) {
    return (
      <div className={styles.empty}>
        <span className={styles.spinner} /> Preparing preview…
      </div>
    );
  }

  if (info.kind === "html") {
    const anchor = activeField && htmlAnchors.includes(activeField) ? `#ev-${activeField}` : "";
    return (
      <iframe
        key={theme}
        className={styles.frame}
        sandbox=""
        src={`${api.previewHtmlUrl(projectId, docId, theme)}&v=${version}${anchor}`}
        title="Document preview"
      />
    );
  }

  const scale = zoom > 1.2 ? 2.75 : 1.75;
  const zi = ZOOMS.indexOf(zoom);

  return (
    <div className={styles.viewer}>
      <div className={styles.toolbar}>
        <span className={styles.pageCount}>
          {info.pages.length} page{info.pages.length === 1 ? "" : "s"}
        </span>
        <div className={styles.toolbarRight}>
          {boxes.length > 0 && (
            <button
              type="button"
              className={`${styles.hlToggle} ${showHighlights ? styles.hlToggleOn : ""}`}
              aria-pressed={showHighlights}
              onClick={() => setShowHighlights((s) => !s)}
              title="Show where each extracted field was found"
            >
              <Icon name="scan" size={13} /> Sources
            </button>
          )}
          <div className={styles.zoom}>
            <button type="button" onClick={() => setZoom(ZOOMS[Math.max(0, zi - 1)])} disabled={zi <= 0} aria-label="Zoom out">
              −
            </button>
            <button type="button" className={styles.zoomLevel} onClick={() => setZoom(1)} title="Fit to width">
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setZoom(ZOOMS[Math.min(ZOOMS.length - 1, zi + 1)])}
              disabled={zi >= ZOOMS.length - 1}
              aria-label="Zoom in"
            >
              +
            </button>
          </div>
        </div>
      </div>
      <div className={styles.scroller} ref={scrollerRef}>
        {info.pages.map((p, i) => (
          <figure
            key={i}
            className={styles.page}
            style={{ width: `${zoom * 100}%`, aspectRatio: `${p.w} / ${p.h}` }}
          >
            {broken.has(i) ? (
              <span className={styles.pageError}>Couldn&apos;t render page {i + 1}</span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={api.previewPageUrl(projectId, docId, i + 1, scale)}
                alt={`Page ${i + 1}`}
                loading={i < 2 ? "eager" : "lazy"}
                decoding="async"
                onError={() => setBroken((s) => new Set(s).add(i))}
              />
            )}
            {showHighlights &&
              (byPage.get(i + 1) || []).map((b, k) => {
                const active = b.field === activeField;
                if (b.kind === "context" && !active) return null;
                return (
                  <button
                    key={k}
                    type="button"
                    data-hl={b.field}
                    className={`${styles.hl} ${b.kind === "context" ? styles.hlContext : ""} ${active ? styles.hlActive : ""}`}
                    style={{
                      left: `${b.x * 100}%`,
                      top: `${b.y * 100}%`,
                      width: `${b.w * 100}%`,
                      height: `${b.h * 100}%`,
                    }}
                    title={`${labels[b.field] || b.field}${b.kind === "context" ? " (quoted passage)" : ""}`}
                    aria-label={`Source of ${labels[b.field] || b.field}`}
                    onClick={() => onPickField?.(b.field)}
                  >
                    {b === firstActive && (
                      <span className={`${styles.hlLabel} ${b.y < 0.05 ? styles.hlLabelBelow : ""}`}>
                        {labels[b.field] || b.field}
                      </span>
                    )}
                  </button>
                );
              })}
            <figcaption>{i + 1}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

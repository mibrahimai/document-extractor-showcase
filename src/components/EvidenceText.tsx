"use client";

import { useEffect, useMemo, useRef } from "react";
import type { LocateResult } from "@/lib/api";
import styles from "./EvidenceText.module.css";

type Span = LocateResult["text_spans"][number];

// Full extracted text with each field's source span marked; clicking a mark
// selects its field, and selecting a field scrolls its first mark into view.
export function EvidenceText({
  text,
  spans,
  labels,
  activeField,
  jump,
  onPickField,
}: {
  text: string;
  spans: Span[];
  labels: Record<string, string>;
  activeField: string | null;
  jump: number;
  onPickField: (field: string) => void;
}) {
  const ref = useRef<HTMLPreElement>(null);

  const segments = useMemo(() => {
    // Value spans win over the wider "context" (quoted passage) spans, and
    // overlapping spans are dropped rather than nested.
    const sorted = [...spans].sort((a, b) => a.start - b.start || (a.kind === "value" ? -1 : 1));
    const out: { text: string; span?: Span }[] = [];
    let pos = 0;
    for (const s of sorted) {
      if (s.start < pos || s.end <= s.start) continue;
      if (s.start > pos) out.push({ text: text.slice(pos, s.start) });
      out.push({ text: text.slice(s.start, s.end), span: s });
      pos = s.end;
    }
    if (pos < text.length) out.push({ text: text.slice(pos) });
    return out;
  }, [text, spans]);

  useEffect(() => {
    if (!activeField || !jump) return;
    ref.current
      ?.querySelector(`[data-field="${CSS.escape(activeField)}"]`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [jump, activeField]);

  if (!text) return <pre className={styles.text}>(no text was extracted)</pre>;

  return (
    <pre className={styles.text} ref={ref}>
      {segments.map((seg, i) =>
        seg.span ? (
          <mark
            key={i}
            data-field={seg.span.field}
            className={`${styles.mark} ${seg.span.kind === "context" ? styles.context : ""} ${seg.span.field === activeField ? styles.active : ""}`}
            title={labels[seg.span.field] || seg.span.field}
            onClick={() => onPickField(seg.span!.field)}
          >
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </pre>
  );
}

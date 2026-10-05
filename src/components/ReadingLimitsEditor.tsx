"use client";

import { useEffect, useState } from "react";
import { api, LimitKey, LimitsInfo, ReadingLimits } from "@/lib/api";
import { Icon } from "./Icon";
import styles from "./ReadingLimitsEditor.module.css";

const ROWS: { key: LimitKey; label: string; help: string; unit: "pages" | "chars" }[] = [
  {
    key: "max_pdf_pages",
    label: "PDF pages to read",
    help: "Pages beyond this are ignored. Invoices need 1–2; long tenders may need 50+.",
    unit: "pages",
  },
  {
    key: "scanned_ocr_pages",
    label: "Pages to OCR in a fully scanned PDF",
    help: "OCR takes a few seconds per page. 0 turns OCR of scanned PDFs off.",
    unit: "pages",
  },
  {
    key: "extract_chars",
    label: "Text the AI reads for extraction",
    help: "Fields that only appear after this point aren't seen. Can't exceed what this machine's model holds.",
    unit: "chars",
  },
  {
    key: "triage_chars",
    label: "Text read for the relevance check",
    help: "Only the start of a document is needed to tell what it is.",
    unit: "chars",
  },
];

// Per-project reading limits. Empty = use the default; the machine's own
// ceiling (from .env) is shown read-only because a project can't raise it.
export function ReadingLimitsEditor({
  projectId,
  value,
  onChange,
  savedVersion,
}: {
  projectId: string;
  value: ReadingLimits;
  onChange: (v: ReadingLimits) => void;
  savedVersion: number;
}) {
  const [info, setInfo] = useState<LimitsInfo | null>(null);

  useEffect(() => {
    api.limits(projectId).then(setInfo).catch(() => setInfo(null));
  }, [projectId, savedVersion]);

  if (!info) return <p className={styles.muted}>Loading limits…</p>;
  const pages = (chars: number) => Math.max(1, Math.round(chars / info.chars_per_page));

  return (
    <div>
      <div className={styles.machine}>
        <Icon name="cpu" size={15} />
        <span>
          <strong>This machine:</strong> model context {info.machine.num_ctx.toLocaleString()} tokens, so at most{" "}
          <strong>{info.machine.max_chars.toLocaleString()} characters</strong> (≈ {pages(info.machine.max_chars)} pages)
          of any document can go to the AI. Timeout {info.machine.timeout_sec}s.
          <span className={styles.muted}> Set in .env (OLLAMA_NUM_CTX, LLM_TIMEOUT_SEC) by whoever runs the server.</span>
        </span>
      </div>

      <div className={styles.rows}>
        {ROWS.map((r) => {
          const v = value[r.key];
          const def = info.defaults[r.key];
          const [lo, hi] = info.bounds[r.key];
          const shown = v ?? def;
          const overMachine = r.unit === "chars" && shown > info.machine.max_chars;
          const outOfRange = v != null && (v < lo || v > hi);
          return (
            <div key={r.key} className={styles.row}>
              <div className={styles.labelCol}>
                <label htmlFor={`lim-${r.key}`}>{r.label}</label>
                <span className={styles.help}>{r.help}</span>
              </div>
              <div className={styles.inputCol}>
                <div className={styles.inputRow}>
                  <input
                    id={`lim-${r.key}`}
                    type="number"
                    min={lo}
                    max={hi}
                    value={v ?? ""}
                    placeholder={String(def)}
                    onChange={(e) =>
                      onChange({ ...value, [r.key]: e.target.value === "" ? null : Number(e.target.value) })
                    }
                  />
                  <span className={styles.unit}>{r.unit === "pages" ? "pages" : "characters"}</span>
                  {v != null && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange({ ...value, [r.key]: null })}>
                      Use default
                    </button>
                  )}
                </div>
                <span className={styles.meta}>
                  {v == null ? `Default: ${def.toLocaleString()}` : `Default is ${def.toLocaleString()}`}
                  {r.unit === "chars" && ` · ≈ ${pages(shown)} pages`}
                </span>
                {outOfRange && (
                  <span className={styles.warn}>
                    Allowed range is {lo.toLocaleString()}–{hi.toLocaleString()}; it will be adjusted.
                  </span>
                )}
                {overMachine && !outOfRange && (
                  <span className={styles.warn}>
                    More than this machine can take; {info.machine.max_chars.toLocaleString()} will be used.
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className={styles.footnote}>
        New limits apply to documents processed from now on. To apply them to existing documents, use{" "}
        <strong>Reprocess</strong> on the documents or folders that need it. Documents that were cut short show a
        warning on their review screen.
      </p>
    </div>
  );
}

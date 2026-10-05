"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, TestExtractResult } from "@/lib/api";
import styles from "./test.module.css";

export default function TestFilePage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<TestExtractResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFileName(file.name);
    setError(null);
    setResult(null);
    setRunning(true);
    try {
      const r = await api.testExtract(projectId, file);
      setResult(r);
    } catch (err) {
      setError(String((err as Error).message || err));
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className={styles.shell}>
      <Link href={`/projects/${projectId}`} className={styles.back}>
        ← Queue
      </Link>
      <h1>Test a file</h1>
      <p>
        Pick any single file and see exactly what this project&apos;s current template would
        extract from it — nothing is saved. Use this to check a fix or a field-list change
        against the one document that had the problem, without adding it to the real queue.
      </p>

      <div className={styles.section}>
        <div className={styles.dropRow}>
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: "none" }}
            onChange={handleFile}
          />
          <button
            type="button"
            className={styles.runBtn}
            onClick={() => fileInputRef.current?.click()}
            disabled={running}
          >
            {running ? "Testing…" : "Choose file & test"}
          </button>
          {fileName && <span className={styles.meta}>{fileName}</span>}
        </div>
        {error && <p className={styles.error}>{error}</p>}
      </div>

      {result && (
        <div className={styles.section}>
          <div className={styles.summaryRow}>
            <span className={`${styles.badge} ${styles[`badge_${result.status}`] || ""}`}>
              {result.status}
            </span>
            <span className={styles.meta}>
              {result.ingest_kind}
              {result.overall_confidence != null && (
                <> · conf {result.overall_confidence.toFixed(2)} ({result.filled_field_count ?? 0} filled)</>
              )}
              {result.metrics?.elapsed_sec != null && <> · {String(result.metrics.elapsed_sec)}s</>}
              {result.reading && (
                <>
                  {" · "}
                  {result.reading.pages_total != null && `${result.reading.pages_read ?? 0}/${result.reading.pages_total} pages · `}
                  {(result.reading.chars_extracted ?? result.reading.chars_triage).toLocaleString()}/
                  {result.reading.chars_total.toLocaleString()} chars read
                </>
              )}
            </span>
          </div>

          {result.error && <div className={styles.flags}>Error: {result.error}</div>}
          {result.ingest_warning && <div className={styles.flags}>Ingest warning: {result.ingest_warning}</div>}
          {result.reading?.truncated && (
            <div className={styles.flags}>Only part of this file was read. {result.reading.notes.join(" ")}</div>
          )}
          {result.status === "not_relevant" && (
            <div className={styles.flags}>
              Not relevant{result.document_kind ? ` (${result.document_kind})` : ""}.
              {result.related_to ? ` What it is: ${result.related_to}` : ""}
            </div>
          )}
          {result.validation_flags && result.validation_flags.length > 0 && (
            <div className={styles.flags}>{result.validation_flags.join(" · ")}</div>
          )}

          {result.extraction && (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Value</th>
                  <th>Confidence</th>
                  <th>Null reason</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(result.extraction).map(([name, f]) => {
                  const low = result.low_confidence_fields?.includes(name);
                  const displayValue = Array.isArray(f.value)
                    ? f.value.join(", ")
                    : f.value == null
                    ? "—"
                    : String(f.value);
                  return (
                    <tr key={name}>
                      <td>{name}</td>
                      <td className={low ? styles.low : undefined}>{displayValue}</td>
                      <td className={low ? styles.low : undefined}>{f.confidence.toFixed(2)}</td>
                      <td className={styles.meta}>{f.null_reason || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <p className={styles.meta} style={{ marginTop: "0.85rem" }}>
            Source preview
          </p>
          <pre className={styles.preview}>{result.text_preview || "(no text preview)"}</pre>
        </div>
      )}
    </main>
  );
}

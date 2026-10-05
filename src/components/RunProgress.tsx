"use client";

import { useState } from "react";
import Link from "next/link";
import type { RunFile, RunProgress as Progress } from "@/lib/api";
import { humanizeFolder, statusLabel } from "@/lib/format";
import { Icon } from "./Icon";
import styles from "./RunProgress.module.css";

function fmtDuration(s: number | null | undefined) {
  if (s == null) return "";
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.round(s % 60)}s`;
}

// Live view of a pipeline run: overall bar, the file being worked on and at
// which stage, and every file's state. Also shows uploaded files that are
// waiting for a run, so an upload is visible immediately.
export function RunProgress({
  projectId,
  progress,
  busy,
  onProcessNow,
  onDismiss,
}: {
  projectId: string;
  progress: Progress | null;
  busy: boolean;
  onProcessNow: () => void;
  onDismiss: () => void;
}) {
  const [open, setOpen] = useState(true);
  const run = progress?.run;
  const pending = progress?.pending ?? [];

  if (busy && !run?.running) {
    return (
      <div className={styles.card}>
        <div className={styles.head}>
          <span className={styles.spinner} />
          <strong>Starting…</strong>
          <span className={styles.muted}>Checking sources and finding new files.</span>
        </div>
      </div>
    );
  }

  if (run && (run.running || busy)) {
    const active = run.files.find((f) => f.state === "active");
    const pct = run.total ? Math.round((run.done / run.total) * 100) : 100;
    return (
      <div className={styles.card}>
        <div className={styles.head}>
          <span className={styles.spinner} />
          <strong>
            Processing {Math.min(run.done + 1, run.total)} of {run.total}
          </strong>
          {run.eta_seconds != null && <span className={styles.muted}>about {fmtDuration(run.eta_seconds)} left</span>}
          {run.skipped > 0 && <span className={styles.muted}>· {run.skipped} already done, skipped</span>}
          <button type="button" className={`btn btn-ghost btn-sm ${styles.toggle}`} onClick={() => setOpen((o) => !o)}>
            {open ? "Hide files" : "Show files"}
            <Icon name="chevronDown" size={13} style={{ transform: open ? "rotate(180deg)" : undefined }} />
          </button>
        </div>
        <div className={styles.bar}>
          <span style={{ width: `${pct}%` }} />
        </div>
        {active && (
          <div className={styles.current}>
            <Icon name="file" size={14} />
            <span className={styles.fileName}>{active.name}</span>
            <span className={styles.stage}>{active.stage}</span>
            <span className={styles.muted}>{fmtDuration(active.elapsed)}</span>
          </div>
        )}
        {open && <FileList projectId={projectId} files={run.files} />}
      </div>
    );
  }

  if (pending.length > 0) {
    return (
      <div className={`${styles.card} ${styles.pendingCard}`}>
        <div className={styles.head}>
          <Icon name="clock" size={16} />
          <strong>
            {pending.length} file{pending.length === 1 ? "" : "s"} waiting to be processed
          </strong>
          <button type="button" className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }} onClick={onProcessNow}>
            <Icon name="play" size={13} /> Process now
          </button>
        </div>
        <ul className={styles.pendingList}>
          {pending.slice(0, 8).map((f) => (
            <li key={`${f.folder}/${f.name}`}>
              <Icon name="file" size={13} /> {f.name}
              <span className={styles.muted}>{humanizeFolder(f.folder)}</span>
            </li>
          ))}
          {pending.length > 8 && <li className={styles.muted}>…and {pending.length - 8} more</li>}
        </ul>
      </div>
    );
  }

  if (run && !run.running && run.total > 0) {
    const counts: Record<string, number> = {};
    for (const f of run.files) {
      const k = f.state === "failed" ? "failed" : f.result || "done";
      counts[k] = (counts[k] || 0) + 1;
    }
    const took = run.finished_at ? run.finished_at - run.started_at : null;
    return (
      <div className={`${styles.card} ${styles.doneCard}`}>
        <div className={styles.head}>
          <Icon name="check" size={16} />
          <strong>
            Processed {run.total} file{run.total === 1 ? "" : "s"}
          </strong>
          <span className={styles.muted}>
            in {fmtDuration(took)} ·{" "}
            {Object.entries(counts)
              .map(([k, n]) => `${n} ${k === "failed" ? "failed" : statusLabel(k).toLowerCase()}`)
              .join(", ")}
          </span>
          <button type="button" className={`btn btn-ghost btn-sm ${styles.toggle}`} onClick={() => setOpen((o) => !o)}>
            {open ? "Hide files" : "Show files"}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onDismiss} aria-label="Dismiss">
            <Icon name="x" size={13} />
          </button>
        </div>
        {open && <FileList projectId={projectId} files={run.files} />}
      </div>
    );
  }

  return null;
}

function FileList({ projectId, files }: { projectId: string; files: RunFile[] }) {
  return (
    <ul className={styles.files}>
      {files.map((f, i) => (
        <li key={i} className={styles[`file_${f.state}`]}>
          <span className={styles.stateIcon}>
            {f.state === "active" ? (
              <span className={styles.spinnerSm} />
            ) : f.state === "done" ? (
              <Icon name="check" size={13} />
            ) : f.state === "failed" ? (
              <Icon name="alert" size={13} />
            ) : (
              <span className={styles.dot} />
            )}
          </span>
          <span className={styles.fileName} title={f.name}>
            {f.state === "done" && f.doc_id ? (
              <Link href={`/projects/${projectId}/review/${encodeURIComponent(f.doc_id)}`}>{f.name}</Link>
            ) : (
              f.name
            )}
          </span>
          <span className={styles.fileMeta}>
            {f.state === "queued" && "waiting"}
            {f.state === "active" && f.stage}
            {f.state === "done" && f.result && <span className={`badge badge-${f.result}`}>{statusLabel(f.result)}</span>}
            {f.state === "failed" && <span className={styles.err}>{f.error}</span>}
          </span>
          <span className={styles.elapsed}>{fmtDuration(f.elapsed)}</span>
        </li>
      ))}
    </ul>
  );
}

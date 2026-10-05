"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import styles from "./import.module.css";

export default function ImportFolderPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const router = useRouter();
  const [folderPath, setFolderPath] = useState("");
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleImport() {
    if (!folderPath.trim()) {
      setError("Enter a folder path first.");
      return;
    }
    setError(null);
    setMsg(null);
    setRunning(true);
    try {
      await api.importFolder(projectId, folderPath.trim());
      const t = setInterval(async () => {
        const p = await api.getProject(projectId).catch(() => null);
        if (!p) return;
        if (p.status !== "running") {
          clearInterval(t);
          setRunning(false);
          setMsg(p.last_run_summary || "Done.");
        }
      }, 2000);
    } catch (e) {
      setError(String((e as Error).message || e));
      setRunning(false);
    }
  }

  return (
    <main className={styles.shell}>
      <Link href={`/projects/${projectId}`} className={styles.back}>
        ← Queue
      </Link>
      <h1>Run on a folder</h1>
      <p>
        Point this at any folder on this machine. Files get copied into this project and
        processed once — the path isn&apos;t remembered afterward. For a folder you want to
        re-check regularly, add it as a source in Settings instead.
      </p>

      <div className={styles.section}>
        <div className={styles.row}>
          <label htmlFor="folder">Folder path</label>
          <input
            id="folder"
            type="text"
            value={folderPath}
            onChange={(e) => setFolderPath(e.target.value)}
            placeholder="C:\Users\you\Downloads\new-rfqs"
            disabled={running}
          />
          <p className={styles.hint}>
            Every supported file (PDF, DOCX, XLSX, images, TXT) directly inside this folder gets
            imported and processed. Files already present in the project (by name) are skipped.
          </p>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.runBtn} onClick={handleImport} disabled={running}>
            {running ? "Running…" : "Import & Run"}
          </button>
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={() => router.push(`/projects/${projectId}`)}
          >
            Back to queue
          </button>
          {msg && <span className={styles.meta}>{msg}</span>}
        </div>
        {error && <p className={styles.error}>{error}</p>}
      </div>
    </main>
  );
}

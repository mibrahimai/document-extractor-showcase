"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, TaskSummary } from "@/lib/api";
import styles from "./tasks.module.css";

export default function TasksPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listTasks(projectId).then(setTasks).catch((e) => setError(String(e.message || e)));
  }, [projectId]);

  return (
    <main className={styles.shell}>
      <Link href={`/projects/${projectId}`} className={styles.back}>
        ← Queue
      </Link>
      <h1>Procurement tasks</h1>
      <p>
        The mocked sourcing-to-closure workflow — created from an approved document&apos;s review
        page, then walked through here: invite vendors, log quotes, select a winner, track
        delivery, close it out financially.
      </p>

      {error && <p className={styles.error}>{error}</p>}

      <table className={styles.table}>
        <thead>
          <tr>
            <th>Title</th>
            <th>Stage</th>
            <th>Invoice</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id}>
              <td>
                <Link href={`/projects/${projectId}/tasks/${t.id}`}>{t.title}</Link>
              </td>
              <td>
                <span className={`${styles.badge} ${styles[`stage_${t.stage}`] || ""}`}>
                  {t.stage}
                </span>
              </td>
              <td className={styles.meta}>
                {t.invoice_amount != null ? t.invoice_amount.toLocaleString() : "—"}
              </td>
            </tr>
          ))}
          {tasks.length === 0 && !error && (
            <tr>
              <td colSpan={3} className={styles.meta}>
                No tasks yet — open an approved document and click &quot;Create procurement
                task&quot;.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}

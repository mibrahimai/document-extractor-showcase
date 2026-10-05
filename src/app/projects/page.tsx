"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useShell } from "@/components/ShellContext";
import { Icon } from "@/components/Icon";
import { StatusBar } from "@/components/StatusBar";
import { timeAgo } from "@/lib/format";
import styles from "./projects.module.css";

export default function ProjectsPage() {
  const { projects, refreshProjects } = useShell();
  const [query, setQuery] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    refreshProjects();
    const t = setTimeout(() => setLoaded(true), 400);
    return () => clearTimeout(t);
  }, [refreshProjects]);

  const q = query.trim().toLowerCase();
  const visible = q
    ? projects.filter((p) => `${p.name} ${p.slug} ${p.template.name}`.toLowerCase().includes(q))
    : projects;

  return (
    <main className={styles.shell}>
      <div className={styles.hero}>
        <div>
          <h1>Projects</h1>
          <p>
            Each project is its own vertical: its own relevance rules, its own fields, its own
            documents and exports.
          </p>
        </div>
        <div className={styles.heroActions}>
          <div className={styles.search}>
            <Icon name="search" size={15} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter projects…"
            />
          </div>
          <Link href="/projects/new" className="btn btn-primary">
            <Icon name="plus" size={15} /> New project
          </Link>
        </div>
      </div>

      {loaded && projects.length === 0 && (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>
            <Icon name="layers" size={22} />
          </div>
          <h2>No projects yet</h2>
          <p>Start from a ready-made template for invoices, RFQs, resumes and more, or build your own.</p>
          <Link href="/projects/new" className="btn btn-primary">
            <Icon name="sparkles" size={15} /> Create your first project
          </Link>
        </div>
      )}

      <div className={styles.grid}>
        {visible.map((p) => {
          const review = p.status_counts?.needs_review ?? 0;
          return (
            <Link key={p.id} href={`/projects/${p.id}`} className={styles.card}>
              <div className={styles.cardTop}>
                <span className={styles.avatar}>{p.name.slice(0, 1).toUpperCase()}</span>
                <div className={styles.cardTitle}>
                  <h2>{p.name}</h2>
                  <span className={styles.template}>{p.template.name}</span>
                </div>
                {p.status === "running" && (
                  <span className={`${styles.runPill} ${styles.running}`}>
                    <span className={styles.spinner} /> Running
                  </span>
                )}
                {p.status === "error" && <span className={`${styles.runPill} ${styles.errored}`}>Last run failed</span>}
              </div>

              {p.template.description && <p className={styles.desc}>{p.template.description}</p>}

              <div className={styles.numbers}>
                <div>
                  <span className={styles.num}>{p.doc_count}</span>
                  <span className={styles.numLabel}>documents</span>
                </div>
                <div>
                  <span className={`${styles.num} ${review ? styles.numWarn : ""}`}>{review}</span>
                  <span className={styles.numLabel}>to review</span>
                </div>
                <div>
                  <span className={styles.num}>{p.template.fields.length}</span>
                  <span className={styles.numLabel}>fields</span>
                </div>
              </div>

              <StatusBar counts={p.status_counts} height={6} showLegend />

              <div className={styles.cardFoot}>
                <span>
                  <Icon name="clock" size={13} /> Last run {timeAgo(p.last_run_at)}
                </span>
                <span className={styles.open}>
                  Open <Icon name="arrowRight" size={13} />
                </span>
              </div>
            </Link>
          );
        })}
        {projects.length > 0 && !q && (
          <Link href="/projects/new" className={`${styles.card} ${styles.newCard}`}>
            <span className={styles.emptyIcon}>
              <Icon name="plus" size={20} />
            </span>
            <span className={styles.newTitle}>New project</span>
            <span className={styles.newSub}>From a template, a JSON file, or scratch</span>
          </Link>
        )}
      </div>
    </main>
  );
}

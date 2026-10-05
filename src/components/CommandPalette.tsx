"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, DocRow, ProjectInfo } from "@/lib/api";
import { humanizeFolder, statusLabel } from "@/lib/format";
import { Icon } from "./Icon";
import styles from "./CommandPalette.module.css";

type Item = {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: string;
  keywords?: string;
  run: () => void;
};

export function CommandPalette({
  open,
  onClose,
  projects,
  activeProjectId,
  onToggleTheme,
}: {
  open: boolean;
  onClose: () => void;
  projects: ProjectInfo[];
  activeProjectId: string | null;
  onToggleTheme: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setCursor(0);
    requestAnimationFrame(() => inputRef.current?.focus());
    if (activeProjectId) {
      api.listDocuments(activeProjectId).then(setDocs).catch(() => setDocs([]));
    } else {
      setDocs([]);
    }
  }, [open, activeProjectId]);

  const go = (href: string) => () => {
    router.push(href);
    onClose();
  };

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    const active = projects.find((p) => String(p.id) === activeProjectId);
    if (active) {
      const base = `/projects/${active.id}`;
      out.push(
        { id: "a-queue", group: active.name, label: "Review queue", icon: "inbox", run: go(base) },
        { id: "a-tasks", group: active.name, label: "Procurement tasks", icon: "tasks", run: go(`${base}/tasks`) },
        { id: "a-vendors", group: active.name, label: "Vendors", icon: "users", run: go(`${base}/vendors`) },
        { id: "a-import", group: active.name, label: "Import a folder", icon: "folderIn", run: go(`${base}/import`) },
        { id: "a-test", group: active.name, label: "Test a single file (dry run)", icon: "flask", run: go(`${base}/test`) },
        { id: "a-settings", group: active.name, label: "Settings & template", icon: "sliders", run: go(`${base}/settings`) },
        {
          id: "a-excel",
          group: active.name,
          label: "Download standardized Excel",
          icon: "download",
          run: () => {
            window.location.href = api.standardizedExportUrl(active.id);
            onClose();
          },
        }
      );
    }
    out.push(
      { id: "n-home", group: "Navigate", label: "Home", icon: "home", run: go("/") },
      { id: "n-projects", group: "Navigate", label: "All projects", icon: "layers", run: go("/projects") },
      {
        id: "n-new",
        group: "Navigate",
        label: "New project from a template",
        icon: "plus",
        keywords: "create vertical preset",
        run: go("/projects/new"),
      },
      {
        id: "n-theme",
        group: "Navigate",
        label: "Toggle light / dark theme",
        icon: "moon",
        keywords: "dark mode appearance",
        run: () => {
          onToggleTheme();
          onClose();
        },
      }
    );
    for (const p of projects) {
      out.push({
        id: `p-${p.id}`,
        group: "Projects",
        label: p.name,
        hint: `${p.doc_count} docs`,
        icon: "folder",
        keywords: `${p.slug} ${p.template.name}`,
        run: go(`/projects/${p.id}`),
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, activeProjectId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? items.filter((i) => `${i.label} ${i.group} ${i.keywords || ""}`.toLowerCase().includes(q))
      : items;
    if (!q || !activeProjectId) return base;
    const docHits: Item[] = docs
      .filter((d) =>
        `${d.title || ""} ${d.solicitation_number || ""} ${d.file_name || ""} ${d.source_folder || ""}`
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 8)
      .map((d) => ({
        id: `d-${d.id}`,
        group: "Documents",
        label: d.title || d.file_name || d.id,
        hint: `${statusLabel(d.status)} · ${humanizeFolder(d.source_folder)}`,
        icon: "file",
        run: go(`/projects/${activeProjectId}/review/${encodeURIComponent(d.id)}`),
      }));
    return [...base, ...docHits];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, docs, query, activeProjectId]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${cursor}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  if (!open) return null;

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(filtered.length - 1, c + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[cursor]?.run();
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  let lastGroup = "";
  return (
    <div className={styles.backdrop} onMouseDown={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-label="Command palette"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={styles.inputRow}>
          <Icon name="search" size={18} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={
              activeProjectId
                ? "Jump to a page, project, or document…"
                : "Jump to a page or project…"
            }
          />
          <span className="kbd">Esc</span>
        </div>
        <div className={styles.list} ref={listRef}>
          {filtered.length === 0 && <div className={styles.empty}>No matches for “{query}”.</div>}
          {filtered.map((item, i) => {
            const header = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            return (
              <div key={item.id}>
                {header && <div className={styles.group}>{header}</div>}
                <button
                  type="button"
                  data-index={i}
                  className={`${styles.item} ${i === cursor ? styles.itemActive : ""}`}
                  onMouseEnter={() => setCursor(i)}
                  onClick={item.run}
                >
                  <Icon name={item.icon} size={16} />
                  <span className={styles.label}>{item.label}</span>
                  {item.hint && <span className={styles.hint}>{item.hint}</span>}
                </button>
              </div>
            );
          })}
        </div>
        <div className={styles.footer}>
          <span>
            <span className="kbd">↑</span> <span className="kbd">↓</span> to move
          </span>
          <span>
            <span className="kbd">Enter</span> to open
          </span>
        </div>
      </div>
    </div>
  );
}

"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getLastOpened, saveOrder, saveQueueUrl } from "@/lib/nav";
import { api, DocRow, ProjectInfo, RunProgress as RunProgressData } from "@/lib/api";
import { humanizeFolder, kindLabel, statusLabel, timeAgo } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { StatusBar } from "@/components/StatusBar";
import { RunProgress } from "@/components/RunProgress";
import { useShell } from "@/components/ShellContext";
import styles from "./page.module.css";

type Filter = "all" | "needs_review" | "extracted" | "approved" | "not_relevant";
const PAGE_SIZE = 20;
const NO_FOLDER = "(no folder)";

type SortKey = "status" | "id" | "title" | "folder" | "kind" | "confidence" | "date";

function fileName(row: DocRow) {
  return row.file_name || row.source_path?.split(/[/\\]/).pop() || "—";
}

function compareRows(a: DocRow, b: DocRow, key: SortKey, dir: "asc" | "desc") {
  let cmp = 0;
  switch (key) {
    case "status":
      cmp = a.status.localeCompare(b.status);
      break;
    case "id":
      cmp = (a.solicitation_number || "").localeCompare(b.solicitation_number || "");
      break;
    case "title":
      cmp = (a.title || fileName(a)).localeCompare(b.title || fileName(b));
      break;
    case "folder":
      cmp = humanizeFolder(a.source_folder).localeCompare(humanizeFolder(b.source_folder));
      break;
    case "kind":
      cmp = a.ingest_kind.localeCompare(b.ingest_kind);
      break;
    case "confidence":
      cmp = (a.overall_confidence ?? 0) - (b.overall_confidence ?? 0);
      break;
    case "date":
      cmp = (a.processed_at || "").localeCompare(b.processed_at || "");
      break;
  }
  return dir === "asc" ? cmp : -cmp;
}

type FolderGroup = { key: string; rows: DocRow[]; latest: string; counts: Record<string, number> };

function buildGroups(rows: DocRow[], sortKey: SortKey, sortDir: "asc" | "desc"): FolderGroup[] {
  const map = new Map<string, DocRow[]>();
  for (const r of rows) {
    const key = r.source_folder || NO_FOLDER;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  const groups = Array.from(map.entries()).map(([key, groupRows]) => {
    const counts: Record<string, number> = {};
    for (const r of groupRows) counts[r.status] = (counts[r.status] || 0) + 1;
    return {
      key,
      rows: [...groupRows].sort((a, b) => compareRows(a, b, sortKey, sortDir)),
      latest: groupRows.reduce((m, r) => ((r.processed_at || "") > m ? r.processed_at || "" : m), ""),
      counts,
    };
  });
  groups.sort((a, b) => {
    if (sortKey === "date") {
      return sortDir === "asc" ? a.latest.localeCompare(b.latest) : b.latest.localeCompare(a.latest);
    }
    return humanizeFolder(a.key).localeCompare(humanizeFolder(b.key));
  });
  return groups;
}

function SortHeader({
  label,
  sortKey,
  active,
  dir,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  active: SortKey;
  dir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const isActive = active === sortKey;
  return (
    <th
      className={`${styles.sortable} ${isActive ? styles.sortActive : ""} ${className || ""}`}
      onClick={() => onSort(sortKey)}
      aria-sort={isActive ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <span>
        {label}
        <Icon
          name="chevronDown"
          size={12}
          className={styles.sortIcon}
          style={{ transform: isActive && dir === "asc" ? "rotate(180deg)" : undefined, opacity: isActive ? 1 : 0 }}
        />
      </span>
    </th>
  );
}

function ConfMeter({ value, filled }: { value: number; filled: number }) {
  const pct = Math.round((value ?? 0) * 100);
  const tone = filled === 0 ? styles.meterNone : pct >= 80 ? styles.meterOk : pct >= 55 ? styles.meterMid : styles.meterLow;
  return (
    <div className={styles.conf} title={`${pct}% average confidence across ${filled} filled field(s)`}>
      <div className={styles.confTop}>
        <span className={styles.confPct}>{filled === 0 ? "—" : `${pct}%`}</span>
        <span className={styles.confFilled}>{filled} filled</span>
      </div>
      <div className={styles.meter}>
        <span className={tone} style={{ width: `${filled === 0 ? 0 : pct}%` }} />
      </div>
    </div>
  );
}

export default function ProjectQueuePage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const router = useRouter();
  const { toast, refreshProjects } = useShell();

  // Every view setting lives in the URL, so browser Back from a document —
  // or a shared link — lands on exactly this view again.
  const sp = useSearchParams();
  const initialStatus = sp.get("status");
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [rows, setRows] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>(
    (["all", "needs_review", "extracted", "approved", "not_relevant"] as const).find((f) => f === initialStatus) ?? "all"
  );
  const [search, setSearch] = useState(sp.get("q") ?? "");
  const [folder, setFolder] = useState<string | null>(sp.get("folder"));
  const [groupByFolder, setGroupByFolder] = useState(sp.get("view") !== "flat");
  const [sortKey, setSortKey] = useState<SortKey>(
    (["status", "id", "title", "folder", "kind", "confidence", "date"] as const).find((k) => k === sp.get("sort")) ?? "date"
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">(sp.get("dir") === "asc" ? "asc" : "desc");
  const [page, setPage] = useState(Math.max(1, Number(sp.get("page")) || 1));
  const [lastOpened, setLastOpenedState] = useState<string | null>(null);
  const firstRender = useRef(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const [prog, setProg] = useState<RunProgressData | null>(null);
  const [runDismissed, setRunDismissed] = useState<number | null>(null);
  const lastDone = useRef(-1);

  const loadProgress = useCallback(() => {
    api.progress(projectId).then(setProg).catch(() => {});
  }, [projectId]);

  const load = useCallback(() => {
    loadProgress();
    api.getProject(projectId).then((p) => {
      setProject(p);
      if (p.status === "running") setRunning(true);
    }).catch((e) => toast({ title: "Couldn't load project", description: String(e.message || e), tone: "error" }));
    api
      .listDocuments(projectId)
      .then(setRows)
      .catch((e) => toast({ title: "Couldn't load documents", description: String(e.message || e), tone: "error" }))
      .finally(() => setLoading(false));
  }, [projectId, toast, loadProgress]);

  useEffect(() => {
    load();
  }, [load]);

  // While idle, check now and then so a run started elsewhere (another tab,
  // a watched folder, the CLI-triggered API) and new uploads show up here.
  useEffect(() => {
    if (running) return;
    const t = setInterval(async () => {
      const pr = await api.progress(projectId).catch(() => null);
      if (!pr) return;
      setProg(pr);
      if (pr.status === "running") setRunning(true);
    }, 5000);
    return () => clearInterval(t);
  }, [running, projectId]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(async () => {
      // Live progress: poll the run, and pull the document list whenever
      // another file finishes so it appears in the table right away.
      const pr = await api.progress(projectId).catch(() => null);
      if (pr) {
        setProg(pr);
        const done = pr.run?.done ?? 0;
        if (done !== lastDone.current) {
          lastDone.current = done;
          api.listDocuments(projectId).then(setRows).catch(() => {});
        }
      }
      if (pr && pr.status === "running") return;
      const p = await api.getProject(projectId).catch(() => null);
      if (!p) return;
      setProject(p);
      if (p.status !== "running") {
        setRunning(false);
        load();
        refreshProjects();
        toast({
          title: p.status === "error" ? "Run failed" : "Run finished",
          description: p.last_run_summary || undefined,
          tone: p.status === "error" ? "error" : "success",
        });
      }
    }, 1500);
    return () => clearInterval(t);
  }, [running, projectId, load, refreshProjects, toast]);

  useEffect(() => {
    // Don't reset on mount, or a restored ?page=3 would be thrown away.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setPage(1);
  }, [filter, search, groupByFolder, folder]);

  const queueUrl = useMemo(() => {
    const q = new URLSearchParams();
    if (filter !== "all") q.set("status", filter);
    if (search.trim()) q.set("q", search.trim());
    if (folder) q.set("folder", folder);
    if (!groupByFolder) q.set("view", "flat");
    if (sortKey !== "date") q.set("sort", sortKey);
    if (sortDir !== "desc") q.set("dir", sortDir);
    if (page > 1) q.set("page", String(page));
    const s = q.toString();
    return `/projects/${projectId}${s ? `?${s}` : ""}`;
  }, [projectId, filter, search, folder, groupByFolder, sortKey, sortDir, page]);

  useEffect(() => {
    // replaceState (not router.replace): updates the URL without a server
    // round-trip or a new history entry per keystroke.
    window.history.replaceState(window.history.state, "", queueUrl);
    saveQueueUrl(projectId, queueUrl);
  }, [queueUrl, projectId]);

  useEffect(() => {
    setLastOpenedState(getLastOpened(projectId));
  }, [projectId]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menuOpen]);

  const busy = running || project?.status === "running";
  // Same rule as the server: never re-run a document someone corrected or approved.
  const recheckable = rows.filter((r) => (r.skipped_fields ?? 0) > 0 && !r.corrected && r.status !== "approved");

  async function startRun() {
    setRunning(true);
    try {
      await api.run(projectId);
    } catch (e) {
      toast({ title: "Couldn't start run", description: String((e as Error).message || e), tone: "error" });
      setRunning(false);
    }
  }

  async function reprocess(body: { scope: "folder" | "all" | "skipped"; folder?: string }) {
    setRunning(true);
    try {
      await api.reprocess(projectId, body);
      toast({
        title:
          body.scope === "all"
            ? "Reprocessing everything"
            : body.scope === "skipped"
              ? `Re-checking ${recheckable.length} document${recheckable.length === 1 ? "" : "s"}`
              : `Reprocessing ${humanizeFolder(body.folder)}`,
        tone: "info",
      });
    } catch (e) {
      toast({ title: "Couldn't start reprocess", description: String((e as Error).message || e), tone: "error" });
      setRunning(false);
    }
  }

  function reprocessAll() {
    const count = project?.doc_count ?? 0;
    if (
      window.confirm(
        `Force-reprocess all ${count} document(s)? This re-runs ingest + triage + extract on every file and can take a long time.`
      )
    ) {
      reprocess({ scope: "all" });
    }
  }

  async function uploadFiles(files: File[]) {
    if (!files.length) return;
    setUploading({ done: 0, total: files.length });
    let ok = 0;
    const failed: string[] = [];
    for (const f of files) {
      try {
        await api.upload(projectId, f);
        ok++;
      } catch {
        failed.push(f.name);
      }
      setUploading((u) => (u ? { ...u, done: u.done + 1 } : u));
    }
    setUploading(null);
    loadProgress();
    if (ok) {
      toast({
        title: `Added ${ok} file${ok === 1 ? "" : "s"}`,
        description: "They'll be triaged and extracted on the next run.",
        tone: "success",
        action: busy ? undefined : { label: "Process now", onClick: startRun },
      });
    }
    if (failed.length) {
      toast({ title: `${failed.length} upload(s) failed`, description: failed.join(", "), tone: "error" });
    }
  }

  function onDragEnter(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    dragDepth.current++;
    setDragging(true);
  }

  function onDragLeave() {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    uploadFiles(Array.from(e.dataTransfer.files));
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "date" || key === "confidence" ? "desc" : "asc");
    }
  }

  function toggleCollapsed(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const r of rows) c[r.status] = (c[r.status] || 0) + 1;
    return c;
  }, [rows]);

  const filledRows = rows.filter((r) => (r.filled_field_count ?? 0) > 0);
  const avgConf = filledRows.length
    ? filledRows.reduce((s, r) => s + (r.overall_confidence ?? 0), 0) / filledRows.length
    : 0;

  const searched = useMemo(() => {
    let base = filter === "all" ? rows : rows.filter((r) => r.status === filter);
    if (folder !== null) base = base.filter((r) => (r.source_folder || "") === folder);
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter((r) =>
      [r.title, r.solicitation_number, fileName(r), r.source_folder, humanizeFolder(r.source_folder), r.document_kind]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [rows, filter, search, folder]);

  const groups = useMemo(
    () => (groupByFolder ? buildGroups(searched, sortKey, sortDir) : []),
    [groupByFolder, searched, sortKey, sortDir]
  );
  const flatRows = useMemo(
    () => (groupByFolder ? [] : [...searched].sort((a, b) => compareRows(a, b, sortKey, sortDir))),
    [groupByFolder, searched, sortKey, sortDir]
  );
  const unitCount = groupByFolder ? groups.length : flatRows.length;
  const totalPages = Math.max(1, Math.ceil(unitCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageGroups = groups.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const pageRows = flatRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const firstToReview = useMemo(() => {
    const pending = rows.filter((r) => r.status === "needs_review");
    pending.sort((a, b) => (b.processed_at || "").localeCompare(a.processed_at || ""));
    return pending[0];
  }, [rows]);

  const reviewHref = (r: DocRow) => `/projects/${projectId}/review/${encodeURIComponent(r.id)}`;

  const viewLabel = [
    folder !== null ? humanizeFolder(folder) : null,
    filter !== "all" ? statusLabel(filter) : null,
    search.trim() ? `Search “${search.trim()}”` : null,
  ]
    .filter(Boolean)
    .join(" · ") || "All documents";

  // Remember this exact list (all pages, in on-screen order) so the review
  // screen's Prev/Next and Back follow it instead of some other ordering.
  function rememberView() {
    const ids = groupByFolder ? groups.flatMap((g) => g.rows.map((r) => r.id)) : flatRows.map((r) => r.id);
    saveOrder(projectId, { ids, label: viewLabel, returnUrl: queueUrl });
  }

  function openDoc(r: DocRow, suffix = "") {
    rememberView();
    router.push(reviewHref(r) + suffix);
  }

  useEffect(() => {
    if (!lastOpened || loading) return;
    const el = document.querySelector(`[data-docid="${CSS.escape(lastOpened)}"]`);
    el?.scrollIntoView({ block: "center" });
    // Only on arrival; later list changes shouldn't yank the scroll position.
  }, [lastOpened, loading]);

  function renderRow(r: DocRow, inGroup: boolean) {
    const isLast = r.id === lastOpened;
    return (
      <tr
        key={r.id}
        data-docid={r.id}
        className={`${styles.row} ${isLast ? styles.rowLast : ""}`}
        onClick={() => openDoc(r)}
        title={isLast ? "The document you opened last" : undefined}
      >
        <td>
          <span className={`badge badge-${r.status}`}>{statusLabel(r.status)}</span>
        </td>
        <td className={styles.idCell}>{r.solicitation_number || <span className={styles.dim}>—</span>}</td>
        <td className={styles.titleCell}>
          <Link
            href={reviewHref(r)}
            className={styles.titleLink}
            onClick={(e) => {
              e.stopPropagation();
              rememberView();
            }}
          >
            {r.title || fileName(r)}
          </Link>
          {isLast && <span className={styles.lastTag}>last opened</span>}
          {r.truncated && (
            <span className={styles.partialTag} title="Only part of this document was read (reading limits)">
              partial
            </span>
          )}
          {(r.skipped_fields ?? 0) > 0 && (
            <span className={styles.partialTag} title="The AI didn't answer these fields; re-check the document">
              {r.skipped_fields} skipped
            </span>
          )}
          {r.status === "not_relevant" && r.related_to && (
            <div className={styles.note}>
              {r.document_kind && <span className={styles.kindTag}>{r.document_kind.replace(/_/g, " ")}</span>}
              {r.related_to}
            </div>
          )}
          {r.low_confidence_fields?.length > 0 && r.status !== "not_relevant" && (
            <div className={styles.lowNote}>
              <Icon name="alert" size={12} /> Check:{" "}
              {r.low_confidence_fields.map((f, i) => (
                <Fragment key={f}>
                  {i > 0 && ", "}
                  <Link
                    href={`${reviewHref(r)}?field=${encodeURIComponent(f)}`}
                    className={styles.lowLink}
                    onClick={(e) => {
                      e.stopPropagation();
                      rememberView();
                    }}
                    title="Open this document with the field selected and its source highlighted"
                  >
                    {f}
                  </Link>
                </Fragment>
              ))}
            </div>
          )}
        </td>
        <td className={styles.sourceCell}>
          {!inGroup && (
            <div className={styles.folderLine} title={r.source_folder || undefined}>
              <Icon name="folder" size={13} /> {humanizeFolder(r.source_folder)}
            </div>
          )}
          <div className={styles.fileLine} title={r.source_path}>
            {fileName(r)}
          </div>
        </td>
        <td>
          <span className={styles.kind}>{kindLabel(r.ingest_kind)}</span>
        </td>
        <td>
          <ConfMeter value={r.overall_confidence} filled={r.filled_field_count ?? 0} />
        </td>
        <td className={styles.dateCell} title={r.processed_at ? new Date(r.processed_at).toLocaleString() : undefined}>
          {timeAgo(r.processed_at)}
        </td>
      </tr>
    );
  }

  const TILES: { key: Filter; label: string; icon: string; tone?: string }[] = [
    { key: "all", label: "All documents", icon: "file" },
    { key: "needs_review", label: "Needs review", icon: "eye", tone: "warn" },
    { key: "extracted", label: "Extracted", icon: "sparkles", tone: "info" },
    { key: "approved", label: "Approved", icon: "check", tone: "ok" },
    { key: "not_relevant", label: "Not relevant", icon: "scan" },
  ];

  return (
    <main
      className={styles.shell}
      onDragEnter={onDragEnter}
      onDragOver={(e) => e.dataTransfer.types.includes("Files") && e.preventDefault()}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {dragging && (
        <div className={styles.dropOverlay}>
          <div className={styles.dropCard}>
            <Icon name="upload" size={28} />
            <strong>Drop to add to {project?.name || "this project"}</strong>
            <span>PDF, Word, Excel, images and text files</span>
          </div>
        </div>
      )}

      <div className={styles.hero}>
        <div className={styles.heroText}>
          <h1>{project?.name || " "}</h1>
          <div className={styles.heroMeta}>
            {project && (
              <>
                <span className={styles.templateChip}>
                  <Icon name="layers" size={13} /> {project.template.name}
                </span>
                <span>{project.template.fields.length} fields</span>
                <span>·</span>
                <span>last run {timeAgo(project.last_run_at)}</span>
              </>
            )}
          </div>
        </div>
        <div className={styles.actions}>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              e.target.value = "";
              uploadFiles(files);
            }}
          />
          <button type="button" className="btn" onClick={() => fileInputRef.current?.click()} disabled={!!uploading}>
            <Icon name="upload" size={15} />
            {uploading ? `Uploading ${uploading.done}/${uploading.total}` : "Upload"}
          </button>
          <a href={api.standardizedExportUrl(projectId)} className="btn" title="Approved documents only, this project's own columns">
            <Icon name="download" size={15} /> Export Excel
          </a>
          <button type="button" className="btn btn-primary" onClick={startRun} disabled={busy} title="Fetch from sources and process any new files">
            {busy ? <span className={styles.spinner} /> : <Icon name="play" size={14} />}
            {busy ? "Processing…" : "Run pipeline"}
          </button>
          <div className={styles.menuWrap}>
            <button
              type="button"
              className="btn"
              aria-label="More actions"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((o) => !o);
              }}
            >
              <Icon name="more" size={16} />
            </button>
            {menuOpen && (
              <div className={styles.menu} onClick={(e) => e.stopPropagation()}>
                <Link href={`/projects/${projectId}/import`} className={styles.menuItem}>
                  <Icon name="folderIn" size={15} /> Import a folder…
                </Link>
                <Link href={`/projects/${projectId}/test`} className={styles.menuItem}>
                  <Icon name="flask" size={15} /> Test a file (dry run)
                </Link>
                <Link href={`/projects/${projectId}/settings`} className={styles.menuItem}>
                  <Icon name="sliders" size={15} /> Settings & template
                </Link>
                <div className={styles.menuSep} />
                <button
                  type="button"
                  className={styles.menuItem}
                  disabled={busy}
                  onClick={() => {
                    setMenuOpen(false);
                    reprocessAll();
                  }}
                >
                  <Icon name="refresh" size={15} /> Reprocess everything
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {(busy ||
        !!prog?.pending.length ||
        (prog?.run &&
          prog.run.started_at !== runDismissed &&
          (prog.run.running || Date.now() / 1000 - (prog.run.finished_at ?? 0) < 1800))) && (
        <RunProgress
          projectId={projectId}
          progress={prog}
          busy={busy}
          onProcessNow={startRun}
          onDismiss={() => setRunDismissed(prog?.run?.started_at ?? null)}
        />
      )}
      {!busy && project?.status === "error" && project.last_run_summary && (
        <div className={styles.errorBanner}>
          <Icon name="alert" size={16} />
          <div>
            <strong>Last run didn&apos;t finish.</strong> <span>{project.last_run_summary}</span>
          </div>
          <button type="button" className="btn btn-sm" onClick={startRun}>
            Run again
          </button>
        </div>
      )}

      {!busy && recheckable.length > 0 && (
        <div className={styles.skipBanner}>
          <Icon name="alert" size={16} />
          <div>
            <strong>
              {recheckable.length} document{recheckable.length === 1 ? "" : "s"} with fields the AI didn&apos;t answer.
            </strong>{" "}
            <span>
              The model stopped early, so those blanks aren&apos;t &quot;not in the document&quot;. A re-check reads them
              again. Documents you corrected or approved are left alone.
            </span>
          </div>
          <button type="button" className="btn btn-sm" onClick={() => reprocess({ scope: "skipped" })}>
            <Icon name="refresh" size={14} /> Re-check {recheckable.length}
          </button>
        </div>
      )}

      <div className={styles.tiles}>
        {TILES.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`${styles.tile} ${filter === t.key ? styles.tileActive : ""}`}
            onClick={() => setFilter(t.key)}
          >
            <span className={styles.tileLabel}>
              <Icon name={t.icon} size={14} /> {t.label}
            </span>
            <span className={`${styles.tileValue} ${t.tone ? styles[`tone_${t.tone}`] : ""}`}>
              {loading ? "·" : (counts[t.key] ?? 0).toLocaleString()}
            </span>
          </button>
        ))}
        <div className={`${styles.tile} ${styles.tileStatic}`}>
          <span className={styles.tileLabel}>
            <Icon name="zap" size={14} /> Avg. confidence
          </span>
          <span className={styles.tileValue}>{filledRows.length ? `${Math.round(avgConf * 100)}%` : "—"}</span>
        </div>
      </div>

      <div className={styles.distribution}>
        <StatusBar counts={counts} height={6} />
      </div>

      {firstToReview && (
        <Link
          href={`${reviewHref(firstToReview)}?queue=needs_review`}
          className={styles.reviewCta}
          onClick={() => {
            const pending = rows.filter((r) => r.status === "needs_review");
            pending.sort((a, b) => (b.processed_at || "").localeCompare(a.processed_at || ""));
            saveOrder(projectId, { ids: pending.map((r) => r.id), label: "Needs review", returnUrl: queueUrl });
          }}
        >
          <span className={styles.reviewCtaIcon}>
            <Icon name="eye" size={18} />
          </span>
          <span className={styles.reviewCtaText}>
            <strong>
              {counts.needs_review} document{counts.needs_review === 1 ? "" : "s"} waiting for review
            </strong>
            <span>Walk through them one by one with keyboard shortcuts: approve, fix, next.</span>
          </span>
          <span className="btn btn-primary btn-sm">
            Start reviewing <Icon name="arrowRight" size={14} />
          </span>
        </Link>
      )}

      <div className={styles.toolbar}>
        <div className={styles.search}>
          <Icon name="search" size={15} />
          <input
            placeholder="Search title, ID, file or folder…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} aria-label="Clear search">
              <Icon name="x" size={13} />
            </button>
          )}
        </div>
        <div className={styles.segmented} role="radiogroup" aria-label="Layout">
          <button type="button" role="radio" aria-checked={groupByFolder} className={groupByFolder ? styles.segActive : ""} onClick={() => setGroupByFolder(true)}>
            <Icon name="folder" size={14} /> Folders
          </button>
          <button type="button" role="radio" aria-checked={!groupByFolder} className={!groupByFolder ? styles.segActive : ""} onClick={() => setGroupByFolder(false)}>
            <Icon name="table" size={14} /> Flat
          </button>
        </div>
        <span className={styles.resultCount}>
          {searched.length} of {rows.length}
        </span>
      </div>
      {folder !== null && (
        <div className={styles.folderFilter}>
          <Icon name="folder" size={14} /> Showing only <strong>{humanizeFolder(folder)}</strong>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFolder(null)}>
            <Icon name="x" size={13} /> Show all folders
          </button>
        </div>
      )}

      {!loading && rows.length === 0 && !busy && !prog?.pending.length ? (
        <button type="button" className={styles.emptyDrop} onClick={() => fileInputRef.current?.click()}>
          <span className={styles.emptyIcon}>
            <Icon name="upload" size={24} />
          </span>
          <strong>Drop documents here, or click to upload</strong>
          <span>PDFs, scans, Word, Excel and images. Then hit Run pipeline.</span>
          <span className={styles.emptyLinks}>
            <Link href={`/projects/${projectId}/import`} onClick={(e) => e.stopPropagation()}>
              Import a whole folder
            </Link>
            ·
            <Link href={`/projects/${projectId}/test`} onClick={(e) => e.stopPropagation()}>
              Test one file first
            </Link>
          </span>
        </button>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <colgroup>
              <col style={{ width: 132 }} />
              <col style={{ width: 150 }} />
              <col />
              <col style={{ width: 190 }} />
              <col style={{ width: 84 }} />
              <col style={{ width: 138 }} />
              <col style={{ width: 104 }} />
            </colgroup>
            <thead>
              <tr>
                <SortHeader label="Status" sortKey="status" active={sortKey} dir={sortDir} onSort={handleSort} />
                <SortHeader label="ID" sortKey="id" active={sortKey} dir={sortDir} onSort={handleSort} />
                <SortHeader label="Document" sortKey="title" active={sortKey} dir={sortDir} onSort={handleSort} />
                {groupByFolder ? (
                  <th>File</th>
                ) : (
                  <SortHeader label="Source" sortKey="folder" active={sortKey} dir={sortDir} onSort={handleSort} />
                )}
                <SortHeader label="Type" sortKey="kind" active={sortKey} dir={sortDir} onSort={handleSort} />
                <SortHeader label="Confidence" sortKey="confidence" active={sortKey} dir={sortDir} onSort={handleSort} />
                <SortHeader label="Processed" sortKey="date" active={sortKey} dir={sortDir} onSort={handleSort} />
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`sk-${i}`} className={styles.skeletonRow}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j}>
                        <span className={styles.skeleton} />
                      </td>
                    ))}
                  </tr>
                ))}
              {groupByFolder &&
                pageGroups.map((g) => {
                  const isCollapsed = collapsed.has(g.key);
                  return (
                    <Fragment key={g.key}>
                      <tr className={styles.groupRow}>
                        <td colSpan={7}>
                          <div className={styles.groupInner}>
                            <button
                              type="button"
                              className={styles.collapseBtn}
                              onClick={() => toggleCollapsed(g.key)}
                              aria-expanded={!isCollapsed}
                              aria-label={isCollapsed ? "Expand folder" : "Collapse folder"}
                            >
                              <Icon name="chevronRight" size={14} style={{ transform: isCollapsed ? undefined : "rotate(90deg)" }} />
                            </button>
                            <Icon name="folder" size={15} className={styles.groupFolderIcon} />
                            <button
                              type="button"
                              className={styles.groupName}
                              title={`${g.key} — show only this folder`}
                              onClick={() => setFolder(g.key === NO_FOLDER ? "" : g.key)}
                            >
                              {humanizeFolder(g.key === NO_FOLDER ? null : g.key)}
                            </button>
                            <span className={styles.groupCount}>{g.rows.length} files</span>
                            <span className={styles.groupBar}>
                              <StatusBar counts={g.counts} height={5} />
                            </span>
                            {g.key !== NO_FOLDER && (
                              <button
                                type="button"
                                className={`btn btn-ghost btn-sm ${styles.groupAction}`}
                                onClick={() => reprocess({ scope: "folder", folder: g.key })}
                                disabled={busy}
                                title="Re-run ingest + triage + extract for every file in this folder"
                              >
                                <Icon name="refresh" size={13} /> Reprocess
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {!isCollapsed && g.rows.map((r) => renderRow(r, true))}
                    </Fragment>
                  );
                })}
              {!groupByFolder && pageRows.map((r) => renderRow(r, false))}
              {!loading && searched.length === 0 && (
                <tr>
                  <td colSpan={7} className={styles.noMatch}>
                    {rows.length === 0
                      ? "Nothing processed yet. Documents appear here as each one finishes."
                      : `Nothing matches${search ? ` “${search}”` : ""} in ${filter === "all" ? "this project" : statusLabel(filter).toLowerCase()}.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button type="button" className="btn btn-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}>
            <Icon name="chevronLeft" size={14} /> Prev
          </button>
          <span>
            Page {safePage} of {totalPages}
            <span className={styles.dim}> · {groupByFolder ? `${groups.length} folders` : `${flatRows.length} documents`}</span>
          </span>
          <button type="button" className="btn btn-sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>
            Next <Icon name="chevronRight" size={14} />
          </button>
        </div>
      )}
    </main>
  );
}

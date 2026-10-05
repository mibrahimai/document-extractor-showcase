"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { api, DocDetail, DocRow, FieldSource, LocateResult } from "@/lib/api";
import { loadOrder, loadQueueUrl, ReviewOrder, setLastOpened } from "@/lib/nav";
import { humanizeFolder, kindLabel, statusLabel, timeAgo } from "@/lib/format";
import { DocumentViewer } from "@/components/DocumentViewer";
import { EvidenceText } from "@/components/EvidenceText";
import { Icon } from "@/components/Icon";
import { useShell } from "@/components/ShellContext";
import styles from "./review.module.css";

function display(raw: unknown): string {
  if (raw == null) return "";
  return Array.isArray(raw) ? raw.join(", ") : String(raw);
}

function sourceTitle(src: FieldSource) {
  if (src.strategy === "evidence") return "Located using the passage the model quoted during extraction";
  if (src.strategy === "fuzzy") return "Located by a close (not word-for-word) match of the value";
  return "Located by finding the value word-for-word";
}

function isTyping(el: EventTarget | null) {
  const t = el as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
}

export default function ReviewPage() {
  const params = useParams<{ projectId: string; id: string }>();
  const router = useRouter();
  const { toast, refreshProjects, setPageCrumbs } = useShell();
  const projectId = params.projectId;
  const id = decodeURIComponent(params.id);

  const [doc, setDoc] = useState<DocDetail | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [original, setOriginal] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [reprocessing, setReprocessing] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"original" | "text">("original");
  const [queueParam, setQueueParam] = useState<string | null>(null);
  const [allRows, setAllRows] = useState<DocRow[]>([]);
  const [order, setOrder] = useState<ReviewOrder | null>(null);
  const [returnUrl, setReturnUrl] = useState(`/projects/${projectId}`);
  const [siblingsOpen, setSiblingsOpen] = useState(false);
  const [sources, setSources] = useState<LocateResult | null>(null);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [jump, setJump] = useState(0);
  const [locVersion, setLocVersion] = useState(0);
  const initialField = useRef<string | null>(null);
  const skipJump = useRef(false);
  // Replies can arrive out of order (e.g. a reload after Save racing the
  // first load); only the newest request for each is allowed to set state.
  // Requests are deliberately not cancelled: on Windows, aborted connections
  // trip a Python 3.10 asyncio bug that breaks the requests that follow.
  const docSeq = useRef(0);
  const srcSeq = useRef(0);

  const loadSources = useCallback(() => {
    const seq = ++srcSeq.current;
    api
      .locate(projectId, id)
      .then((r) => seq === srcSeq.current && setSources(r))
      .catch(() => seq === srcSeq.current && setSources(null));
  }, [projectId, id]);

  useEffect(() => {
    setSources(null);
    setActiveField(null);
    loadSources();
    const seq = srcSeq; // invalidate this load's reply on unmount / doc change
    return () => {
      seq.current++;
    };
  }, [loadSources]);

  const loadDoc = useCallback(() => {
    const seq = ++docSeq.current;
    api
      .getDocument(projectId, id)
      .then((d) => {
        if (seq !== docSeq.current) return;
        setDoc(d);
        const names = d.template?.fields?.map((f) => f.name) || (d.extraction ? Object.keys(d.extraction) : []);
        const next: Record<string, string> = {};
        const orig: Record<string, string> = {};
        for (const name of names) {
          orig[name] = display(d.extraction?.[name]?.value);
          next[name] = display(d.human_corrections?.[name] ?? d.extraction?.[name]?.value);
        }
        setDraft(next);
        setOriginal(orig);
      })
      .catch((e) => seq === docSeq.current && setError(String(e.message || e)));
  }, [projectId, id]);

  useEffect(() => {
    loadDoc();
    const seq = docSeq; // invalidate this load's reply on unmount / doc change
    return () => {
      seq.current++;
    };
  }, [loadDoc]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    initialField.current = params.get("field");
    setQueueParam(params.get("queue"));
    const remembered = loadOrder(projectId);
    setOrder(remembered && remembered.ids.includes(id) ? remembered : null);
    setReturnUrl(remembered?.ids.includes(id) ? remembered.returnUrl : loadQueueUrl(projectId));
    setLastOpened(projectId, id);
    setSiblingsOpen(false);
    let alive = true;
    api
      .listDocuments(projectId)
      .then((rows) => alive && setAllRows(rows))
      .catch(() => alive && setAllRows([]));
    return () => {
      alive = false;
    };
  }, [projectId, id]);

  useEffect(() => {
    if (!reprocessing) return;
    const t = setInterval(async () => {
      const p = await api.getProject(projectId).catch(() => null);
      if (!p || p.status === "running") return;
      setReprocessing(false);
      toast({ title: "Reprocessed", description: p.last_run_summary || undefined, tone: p.status === "error" ? "error" : "success" });
      loadDoc();
      loadSources();
      setLocVersion((v) => v + 1);
    }, 2000);
    return () => clearInterval(t);
  }, [reprocessing, projectId, loadDoc, loadSources, toast]);

  // Prev/Next walk the exact list the reviewer opened this document from
  // (remembered by the queue page); without one, fall back to the status
  // queue in the URL, newest first.
  const fallbackIds = useMemo(() => {
    const list = queueParam ? allRows.filter((r) => r.status === queueParam) : [...allRows];
    list.sort((a, b) => (b.processed_at || "").localeCompare(a.processed_at || ""));
    return list.map((r) => r.id);
  }, [allRows, queueParam]);
  const ids = order ? order.ids : fallbackIds;
  const orderLabel = order ? order.label : queueParam ? statusLabel(queueParam) : "All documents";
  const position = ids.indexOf(id);
  const prevDoc = position > 0 ? ids[position - 1] : null;
  const nextDoc = position >= 0 ? ids[position + 1] || null : ids.find((x) => x !== id) || null;
  const qs = !order && queueParam ? `?queue=${queueParam}` : "";
  const hrefFor = (docId: string) => `/projects/${projectId}/review/${encodeURIComponent(docId)}${qs}`;
  useEffect(() => {
    if (!siblingsOpen) return;
    const close = () => setSiblingsOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [siblingsOpen]);

  const pathname = usePathname();
  const docFolder = doc?.source_folder ?? null;
  const docFile = doc ? doc.source_path.split(/[/\\]/).pop() || doc.id : null;
  useEffect(() => {
    if (!docFile) return;
    setPageCrumbs(pathname, [
      { label: orderLabel, href: returnUrl },
      { label: humanizeFolder(docFolder), href: `/projects/${projectId}?folder=${encodeURIComponent(docFolder || "")}` },
      { label: docFile },
    ]);
    return () => setPageCrumbs(pathname, null);
  }, [pathname, orderLabel, returnUrl, docFolder, docFile, projectId, setPageCrumbs]);

  const siblings = useMemo(
    () =>
      doc
        ? allRows
            .filter((r) => (r.source_folder || "") === (doc.source_folder || ""))
            .sort((a, b) => (a.file_name || "").localeCompare(b.file_name || "", undefined, { numeric: true }))
        : [],
    [allRows, doc]
  );

  const fieldDefs = doc?.template?.fields || [];
  const titleKey = fieldDefs.find((f) => f.name === "title" || f.name === "description")?.name || fieldDefs[1]?.name;
  const fileUrl = useMemo(() => api.fileUrl(projectId, id, true), [projectId, id]);
  const sourcePath = doc?.source_path || "";
  const fileName = sourcePath.split(/[/\\]/).pop() || "—";
  const editedCount = Object.keys(draft).filter((k) => (draft[k] || "") !== (original[k] || "")).length;
  const labels: Record<string, string> = Object.fromEntries(fieldDefs.map((f) => [f.name, f.label || f.name]));
  const htmlAnchors = useMemo(
    () => Object.entries(sources?.fields || {}).filter(([, s]) => s.in_html).map(([n]) => n),
    [sources]
  );
  const locatedCount = Object.values(sources?.fields || {}).filter((s) => s.status === "found").length;
  const locatableCount = Object.keys(sources?.fields || {}).length;

  useEffect(() => {
    setTab("original");
  }, [id]);

  // Show a field's source: stay on the current tab if it can show it,
  // otherwise switch to the one that can, then scroll there.
  function goToSource(name: string) {
    setActiveField(name);
    const src = sources?.fields[name];
    if (!sources || !src || src.status !== "found") return;
    const visual = sources.layer === "pages" ? src.pages.length > 0 : sources.layer === "html" ? src.in_html : false;
    const canStay = (tab === "original" && visual) || (tab === "text" && src.in_text);
    if (!canStay) {
      if (visual) setTab("original");
      else if (src.in_text) setTab("text");
    }
    setJump((j) => j + 1);
  }

  // Clicked a highlight in the document: select that field in the form
  // without scrolling the document away from where the reviewer is looking.
  function pickFromDocument(name: string) {
    setActiveField(name);
    const input = document.getElementById(`f-${name}`);
    if (!input || document.activeElement === input) return; // no focus event will fire to consume the skip
    skipJump.current = true;
    input.focus({ preventScroll: false });
  }

  function onFieldFocus(name: string) {
    if (skipJump.current) {
      skipJump.current = false;
      return;
    }
    goToSource(name);
  }

  // ?field=name deep link: wait until both the fields (doc) and their
  // sources have rendered, otherwise there's nothing to scroll to yet.
  useEffect(() => {
    const f = initialField.current;
    if (!sources || !doc || !f) return;
    initialField.current = null;
    goToSource(f);
    requestAnimationFrame(() => document.getElementById(`f-${f}`)?.scrollIntoView({ block: "center" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources, doc]);

  async function save(approve: boolean, thenNext = false) {
    if (!doc || saving) return;
    setSaving(true);
    const fields: Record<string, unknown> = {};
    const typeByName = Object.fromEntries(fieldDefs.map((f) => [f.name, f.type]));
    for (const [k, v] of Object.entries(draft)) {
      const t = typeByName[k] || "string";
      if (t === "string_list") fields[k] = v.trim() ? v.split(/[,\n]/).map((s) => s.trim()).filter(Boolean) : null;
      else if (t === "number") fields[k] = v.trim() === "" ? null : Number(v);
      else fields[k] = v.trim() === "" ? null : v;
    }
    try {
      const updated = await api.correct(projectId, id, fields, approve);
      setDoc((prev) => ({ ...updated, template: prev?.template }));
      refreshProjects();
      loadSources();
      setLocVersion((v) => v + 1);
      if (approve && thenNext) {
        if (nextDoc) {
          toast({ title: "Approved", description: "Moving to the next document.", tone: "success" });
          router.push(hrefFor(nextDoc));
        } else {
          toast({ title: "Queue cleared", description: "Nothing left to review here.", tone: "success" });
          router.push(`/projects/${projectId}`);
        }
      } else {
        toast({ title: approve ? "Approved" : "Corrections saved", tone: "success" });
      }
    } catch (e) {
      toast({ title: "Couldn't save", description: String((e as Error).message || e), tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  const saveRef = useRef(save);
  saveRef.current = save;
  const navRef = useRef({ prevDoc, nextDoc });
  navRef.current = { prevDoc, nextDoc };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === "Enter") {
        e.preventDefault();
        saveRef.current(true, true);
      } else if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveRef.current(false);
      } else if (!mod && !e.altKey && !isTyping(e.target)) {
        if (e.key === "j" && navRef.current.nextDoc) router.push(hrefFor(navRef.current.nextDoc));
        if (e.key === "k" && navRef.current.prevDoc) router.push(hrefFor(navRef.current.prevDoc));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, projectId, queueParam]);

  async function handleReprocess() {
    setReprocessing(true);
    try {
      await api.reprocess(projectId, { scope: "document", doc_id: id });
    } catch (e) {
      setReprocessing(false);
      toast({ title: "Couldn't reprocess", description: String((e as Error).message || e), tone: "error" });
    }
  }

  async function handleCreateTask() {
    setCreatingTask(true);
    try {
      const task = await api.createTask(projectId, id);
      router.push(`/projects/${projectId}/tasks/${task.id}`);
    } catch (e) {
      toast({ title: "Couldn't create task", description: String((e as Error).message || e), tone: "error" });
      setCreatingTask(false);
    }
  }

  async function openLocal(kind: "folder" | "file") {
    try {
      if (kind === "folder") await api.openFolder(projectId, id);
      else await api.openFile(projectId, id);
      toast({ title: kind === "folder" ? "Opened in Explorer" : "Opened in its default app", tone: "info" });
    } catch (e) {
      toast({ title: "Couldn't open", description: String((e as Error).message || e), tone: "error" });
    }
  }

  if (error) {
    return (
      <main className={styles.shell}>
        <div className={styles.errorState}>
          <Icon name="alert" size={22} />
          <p>{error}</p>
          <Link href={returnUrl} className="btn">
            Back to the queue
          </Link>
        </div>
      </main>
    );
  }

  if (!doc) {
    return (
      <main className={styles.shell}>
        <div className={styles.loading}>
          <span className={styles.spinner} /> Loading document…
        </div>
      </main>
    );
  }

  const title = (titleKey && draft[titleKey]) || fileName;
  const truncated = Boolean(doc.reading?.truncated);
  const ingestWarnings = (doc.validation_flags || []).filter((f) => f.startsWith("ingest_warning"));
  const otherFlags = (doc.validation_flags || []).filter((f) => !f.startsWith("ingest_warning") && !f.startsWith("not_relevant"));

  return (
    <main className={styles.shell}>
      <Link href={returnUrl} className={styles.backLink} title="Back to the list you opened this document from">
        <Icon name="chevronLeft" size={14} /> {orderLabel}
        {position >= 0 && <span className={styles.backPos}>document {position + 1} of {ids.length}</span>}
      </Link>
      <header className={styles.top}>
        <div className={styles.titleBlock}>
          <div className={styles.titleRow}>
            <span className={`badge badge-${doc.status}`}>{statusLabel(doc.status)}</span>
            <h1 title={title}>{title}</h1>
          </div>
          <div className={styles.meta}>
            <span>{kindLabel(doc.ingest_kind)}</span>
            <span>·</span>
            <span>{doc.filled_field_count ?? 0} of {fieldDefs.length} fields filled</span>
            {(doc.filled_field_count ?? 0) > 0 && (
              <>
                <span>·</span>
                <span>{Math.round(doc.overall_confidence * 100)}% avg confidence</span>
              </>
            )}
            {doc.metrics?.elapsed_sec != null && (
              <>
                <span>·</span>
                <span>extracted in {String(doc.metrics.elapsed_sec)}s</span>
              </>
            )}
            {doc.processed_at && (
              <>
                <span>·</span>
                <span title={new Date(doc.processed_at).toLocaleString()}>{timeAgo(doc.processed_at)}</span>
              </>
            )}
          </div>
        </div>
        <div className={styles.topActions}>
          <div className={styles.pager}>
            <button
              type="button"
              className={styles.pagerBtn}
              disabled={!prevDoc}
              onClick={() => prevDoc && router.push(hrefFor(prevDoc))}
              title="Previous (K)"
            >
              <Icon name="chevronLeft" size={16} />
            </button>
            <span className={styles.pagerText}>
              {position >= 0 ? position + 1 : "–"} / {ids.length}
              <span className={styles.pagerQueue} title={orderLabel}>
                {orderLabel.length > 16 ? orderLabel.slice(0, 15) + "…" : orderLabel}
              </span>
            </span>
            <button
              type="button"
              className={styles.pagerBtn}
              disabled={!nextDoc}
              onClick={() => nextDoc && router.push(hrefFor(nextDoc))}
              title="Next (J)"
            >
              <Icon name="chevronRight" size={16} />
            </button>
          </div>
          <button type="button" className="btn btn-sm" onClick={handleReprocess} disabled={reprocessing} title="Re-run ingest + triage + extract on just this document">
            {reprocessing ? <span className={styles.spinner} /> : <Icon name="refresh" size={14} />}
            {reprocessing ? "Reprocessing…" : "Reprocess"}
          </button>
          {doc.status === "approved" && (
            <button type="button" className="btn btn-sm btn-primary" onClick={handleCreateTask} disabled={creatingTask}>
              <Icon name="truck" size={14} /> {creatingTask ? "Creating…" : "Create procurement task"}
            </button>
          )}
        </div>
      </header>

      <div className={styles.sourceBar}>
        <div className={styles.siblingWrap} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className={styles.sourcePathBtn}
            onClick={() => setSiblingsOpen((o) => !o)}
            aria-expanded={siblingsOpen}
            title={`${doc.source_folder || ""} — click to see every file in this folder`}
          >
            <span className={styles.sourceItem}>
              <Icon name="folder" size={14} /> {humanizeFolder(doc.source_folder)}
            </span>
            <Icon name="chevronRight" size={12} className={styles.sourceSep} />
            <span className={styles.sourceFile} title={sourcePath}>
              <Icon name="file" size={14} /> {fileName}
            </span>
            {siblings.length > 1 && <span className={styles.siblingCount}>{siblings.length} files</span>}
            <Icon name="chevronDown" size={13} />
          </button>
          {siblingsOpen && (
            <div className={styles.siblingMenu}>
              <div className={styles.siblingHead}>Files in {humanizeFolder(doc.source_folder)}</div>
              {siblings.map((s) => (
                <Link
                  key={s.id}
                  href={hrefFor(s.id)}
                  className={`${styles.siblingItem} ${s.id === id ? styles.siblingCurrent : ""}`}
                  onClick={() => setSiblingsOpen(false)}
                >
                  <span className={`badge badge-${s.status}`}>{statusLabel(s.status)}</span>
                  <span className={styles.siblingName}>{s.file_name || s.id}</span>
                  {s.id === id && <span className={styles.youAreHere}>you are here</span>}
                </Link>
              ))}
              <Link
                href={`/projects/${projectId}?folder=${encodeURIComponent(doc.source_folder || "")}`}
                className={styles.siblingFoot}
              >
                Show this folder in the queue <Icon name="arrowRight" size={13} />
              </Link>
            </div>
          )}
        </div>
        <span className={styles.sourceActions}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => openLocal("folder")}>
            <Icon name="folder" size={13} /> Show in folder
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => openLocal("file")}>
            <Icon name="externalLink" size={13} /> Open in app
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              navigator.clipboard?.writeText(sourcePath).then(
                () => toast({ title: "Path copied", tone: "info" }),
                () => toast({ title: "Couldn't copy", tone: "error" })
              );
            }}
          >
            Copy path
          </button>
        </span>
      </div>

      {(doc.error || doc.status === "not_relevant" || truncated || ingestWarnings.length > 0 || otherFlags.length > 0) && (
        <div className={styles.notices}>
          {doc.error && (
            <div className={`${styles.notice} ${styles.noticeBad}`}>
              <Icon name="alert" size={15} /> <span>{doc.error}</span>
            </div>
          )}
          {doc.status === "not_relevant" && (
            <div className={styles.notice}>
              <Icon name="scan" size={15} />
              <span>
                Read successfully, but <strong>out of scope</strong> for this project
                {doc.document_kind ? ` (${doc.document_kind.replace(/_/g, " ")})` : ""}.
                {doc.related_to ? ` ${doc.related_to}` : ""}
              </span>
            </div>
          )}
          {truncated && (
            <div className={`${styles.notice} ${styles.noticeWarn}`}>
              <Icon name="scan" size={15} />
              <span>
                <strong>Only part of this document was read.</strong> {doc.reading?.notes.join(" ")} Fields that
                appear later may be missing — check the original, or raise the limits in{" "}
                <Link href={`/projects/${projectId}/settings`}>project settings</Link> and reprocess.
              </span>
            </div>
          )}
          {ingestWarnings.map((w) => (
            <div key={w} className={`${styles.notice} ${styles.noticeWarn}`}>
              <Icon name="alert" size={15} /> <span>{w.replace(/^ingest_warning:\s*/, "Reading issue: ")}</span>
            </div>
          ))}
          {otherFlags.length > 0 && (
            <div className={`${styles.notice} ${styles.noticeWarn}`}>
              <Icon name="eye" size={15} /> <span>{otherFlags.join(" · ")}</span>
            </div>
          )}
        </div>
      )}

      <div className={styles.grid}>
        <section className={`${styles.panel} ${styles.previewPanel}`}>
          <div className={styles.panelHead}>
            <div className={styles.tabs} role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={tab === "original"}
                className={tab === "original" ? styles.tabActive : ""}
                onClick={() => setTab("original")}
              >
                <Icon name="eye" size={14} /> Original
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "text"}
                className={tab === "text" ? styles.tabActive : ""}
                onClick={() => setTab("text")}
              >
                <Icon name="file" size={14} /> Extracted text
              </button>
            </div>
            <a href={fileUrl} download={fileName} className={styles.panelLink} title="Download the original file">
              <Icon name="download" size={12} /> Download
            </a>
          </div>
          <div className={styles.previewBody}>
            {tab === "original" && (
              <DocumentViewer
                projectId={projectId}
                docId={id}
                onShowText={() => setTab("text")}
                boxes={sources?.boxes}
                htmlAnchors={htmlAnchors}
                labels={labels}
                activeField={activeField}
                jump={jump}
                version={locVersion}
                onPickField={pickFromDocument}
              />
            )}
            {tab === "text" && (
              <EvidenceText
                text={sources?.text ?? doc.text_preview ?? ""}
                spans={sources?.text_spans ?? []}
                labels={labels}
                activeField={activeField}
                jump={jump}
                onPickField={pickFromDocument}
              />
            )}
          </div>
        </section>

        <section className={`${styles.panel} ${styles.fieldsPanel}`}>
          <div className={styles.panelHead}>
            <h2>
              Fields <span className={styles.panelCount}>{doc.template?.name}</span>
            </h2>
            <span className={styles.headPills}>
              {locatableCount > 0 && (
                <span
                  className={styles.sourcePill}
                  title="Fields whose value was found in the original. Click a field, or its chip, to jump there."
                >
                  <Icon name="scan" size={12} /> {locatedCount}/{locatableCount} located
                </span>
              )}
              {editedCount > 0 && <span className={styles.editedPill}>{editedCount} edited</span>}
            </span>
          </div>
          <div className={styles.fieldList}>
            {fieldDefs.map((f) => {
              const name = f.name;
              const meta = doc.extraction?.[name];
              const low = doc.low_confidence_fields?.includes(name);
              const required = doc.template?.required?.includes(name);
              // Lists (skills, part numbers) get a multi-line box sized to their
              // content — in a one-line input most of a long list is hidden.
              const isList = f.type === "string_list";
              const long = isList || (f.type === "string" && /description|summary|notes|obligations|what/.test(name));
              const value = draft[name] || "";
              const edited = value !== (original[name] || "");
              const conf = meta ? Math.round(meta.confidence * 100) : null;
              const missingRequired = required && !value.trim();
              const src = sources?.fields[name];
              const active = activeField === name;
              return (
                <div
                  key={name}
                  className={`${styles.field} ${low ? styles.fieldLow : ""} ${missingRequired ? styles.fieldMissing : ""} ${active ? styles.fieldActive : ""}`}
                >
                  <div className={styles.fieldHead}>
                    <label htmlFor={`f-${name}`}>
                      {f.label || name}
                      {required && <span className={styles.req} title="Required">*</span>}
                    </label>
                    <span className={styles.fieldTags}>
                      {edited && <span className={styles.tagEdited}>edited</span>}
                      {low && !edited && value && <span className={styles.tagLow}>check</span>}
                      {!edited && !value && (
                        <span
                          className={styles.tagAbsent}
                          title={conf != null ? `The model is ${conf}% sure this isn't in the document` : undefined}
                        >
                          not in doc
                        </span>
                      )}
                      {src && value && src.status === "found" && (
                        <button
                          type="button"
                          className={`${styles.srcChip} ${active ? styles.srcChipActive : ""}`}
                          onClick={() => goToSource(name)}
                          title={sourceTitle(src)}
                        >
                          <Icon name="scan" size={11} />
                          {src.pages.length
                            ? `p.${src.pages[0]}${src.pages.length > 1 ? ` +${src.pages.length - 1}` : ""}`
                            : "source"}
                        </button>
                      )}
                      {src && value && src.status === "ambiguous" && (
                        <span
                          className={styles.srcAmbig}
                          title={`This value appears ${src.count} times, so it can't be pinned to one place. Reprocessing the document adds the model's quoted passage, which can.`}
                        >
                          {src.count}× in doc
                        </span>
                      )}
                      {src && value && src.status === "not_found" && !edited && (
                        <span
                          className={styles.srcMissing}
                          title="Not found word-for-word in the original. It may be reformatted, combined from several places, or summarized."
                        >
                          not located
                        </span>
                      )}
                      {conf != null && !edited && value && (
                        <span className={styles.confNum} title="How clearly the value appears in the document">
                          {conf}%
                        </span>
                      )}
                    </span>
                  </div>
                  {long ? (
                    <textarea
                      id={`f-${name}`}
                      rows={isList ? Math.min(8, Math.max(2, Math.ceil((draft[name] || "").length / 55))) : 3}
                      value={value}
                      placeholder="Not found"
                      onFocus={() => onFieldFocus(name)}
                      onChange={(e) => setDraft((d) => ({ ...d, [name]: e.target.value }))}
                    />
                  ) : (
                    <input
                      id={`f-${name}`}
                      value={value}
                      placeholder={f.type === "string_list" ? "Comma-separated" : f.type === "date" ? "YYYY-MM-DD" : "Not found"}
                      onFocus={() => onFieldFocus(name)}
                      onChange={(e) => setDraft((d) => ({ ...d, [name]: e.target.value }))}
                    />
                  )}
                  {active && value && src?.snippet && (
                    <div className={styles.sourceSnippet}>
                      <span className={styles.sourceSnippetHead}>
                        <Icon name="scan" size={12} />
                        Source{src.pages.length ? ` · page ${src.pages.join(", ")}` : ""}
                        {src.strategy === "evidence" && " · quoted by the model"}
                      </span>
                      <span>
                        …{src.snippet.before}
                        <mark>{src.snippet.match}</mark>
                        {src.snippet.after}…
                      </span>
                    </div>
                  )}
                  {active && value && src && src.status !== "found" && src.evidence && (
                    <div className={styles.sourceSnippet}>
                      <span className={styles.sourceSnippetHead}>Model&apos;s quote (couldn&apos;t be matched in the text)</span>
                      <span>“{src.evidence}”</span>
                    </div>
                  )}
                  {conf != null && !edited && value && (
                    <div className={styles.fieldMeter}>
                      <span className={low ? styles.mLow : conf >= 80 ? styles.mOk : styles.mMid} style={{ width: `${conf}%` }} />
                    </div>
                  )}
                  {meta?.null_reason && !value && <div className={styles.nullReason}>{meta.null_reason}</div>}
                </div>
              );
            })}
          </div>
          <div className={styles.actionBar}>
            <div className={styles.shortcuts}>
              <span><span className="kbd">Ctrl</span>+<span className="kbd">Enter</span> approve &amp; next</span>
              <span><span className="kbd">Ctrl</span>+<span className="kbd">S</span> save</span>
              <span><span className="kbd">J</span>/<span className="kbd">K</span> next/prev</span>
            </div>
            <div className={styles.actionButtons}>
              <button type="button" className="btn" onClick={() => save(false)} disabled={saving}>
                Save
              </button>
              <button type="button" className="btn" onClick={() => save(true)} disabled={saving}>
                <Icon name="check" size={14} /> Approve
              </button>
              <button type="button" className="btn btn-primary" onClick={() => save(true, true)} disabled={saving}>
                Approve &amp; next <Icon name="arrowRight" size={14} />
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

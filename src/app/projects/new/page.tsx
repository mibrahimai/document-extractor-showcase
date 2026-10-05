"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ProjectCreateBody } from "@/lib/api";
import { PRESETS, parseTemplateFile } from "@/lib/presets";
import { Icon } from "@/components/Icon";
import { useShell } from "@/components/ShellContext";
import styles from "./new.module.css";

const FIELD_TYPES = [
  { id: "string", label: "Text" },
  { id: "number", label: "Number" },
  { id: "date", label: "Date" },
  { id: "email", label: "Email" },
  { id: "string_list", label: "List" },
  { id: "naics", label: "NAICS code" },
] as const;

type SourceKind = "manual_upload" | "folder_watch" | "sam_gov";

type Row = { _key: number; name: string; label: string; type: string; required: boolean; nameTouched: boolean };

let nextKey = 0;
const blankRow = (): Row => ({ _key: nextKey++, name: "", label: "", type: "string", required: false, nameTouched: false });

function toKey(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function rowsFrom(body: ProjectCreateBody): Row[] {
  const req = new Set(body.required || []);
  return body.fields.map((f) => ({
    _key: nextKey++,
    name: f.name,
    label: f.label || f.name,
    type: f.type,
    required: req.has(f.name),
    nameTouched: true,
  }));
}

export default function NewProjectPage() {
  const router = useRouter();
  const { toast, refreshProjects } = useShell();
  const importRef = useRef<HTMLInputElement>(null);

  const [origin, setOrigin] = useState<string>("blank");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [relevanceScope, setRelevanceScope] = useState("");
  const [systemExtra, setSystemExtra] = useState("");
  const [confThreshold, setConfThreshold] = useState(0.55);
  const [rows, setRows] = useState<Row[]>([
    { ...blankRow(), name: "title", label: "Title", nameTouched: true, required: true },
    blankRow(),
  ]);
  const [sourceKind, setSourceKind] = useState<SourceKind>("manual_upload");
  const [folderPath, setFolderPath] = useState("");
  const [samKeyword, setSamKeyword] = useState("");
  const [samDays, setSamDays] = useState(21);
  const [samApiKey, setSamApiKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadBody(body: ProjectCreateBody, from: string) {
    setOrigin(from);
    setName(body.name || "");
    setDescription(body.description || "");
    setRelevanceScope(body.relevance_scope || "");
    setSystemExtra(body.system_extra || "");
    if (typeof body.conf_threshold === "number") setConfThreshold(body.conf_threshold);
    setRows(rowsFrom(body));
    setError(null);
  }

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("preset");
    const preset = PRESETS.find((p) => p.id === id);
    if (preset) loadBody(preset.body, preset.id);
  }, []);

  function pickBlank() {
    setOrigin("blank");
    setName("");
    setDescription("");
    setRelevanceScope("");
    setSystemExtra("");
    setRows([{ ...blankRow(), name: "title", label: "Title", nameTouched: true, required: true }, blankRow()]);
  }

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const body = parseTemplateFile(await file.text());
      loadBody(body, "import");
      toast({ title: "Template imported", description: `${body.fields.length} fields from ${file.name}`, tone: "success" });
    } catch (err) {
      toast({ title: "Couldn't read that file", description: String((err as Error).message || err), tone: "error" });
    }
  }

  function update(key: number, patch: Partial<Row>) {
    setRows((list) =>
      list.map((r) => {
        if (r._key !== key) return r;
        const next = { ...r, ...patch };
        if (patch.label !== undefined && !r.nameTouched) next.name = toKey(patch.label);
        return next;
      })
    );
  }

  function move(key: number, dir: -1 | 1) {
    setRows((list) => {
      const i = list.findIndex((r) => r._key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return list;
      const copy = [...list];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }

  const cleanFields = rows.map((r) => ({ ...r, name: r.name.trim() })).filter((r) => r.name);
  const dupes = cleanFields.map((r) => r.name).filter((n, i, all) => all.indexOf(n) !== i);

  async function submit() {
    setError(null);
    if (!name.trim()) return setError("Give the project a name.");
    if (cleanFields.length === 0) return setError("Add at least one field to extract.");
    if (dupes.length) return setError(`Duplicate field keys: ${Array.from(new Set(dupes)).join(", ")}`);
    setSubmitting(true);
    try {
      const project = await api.createProject({
        name: name.trim(),
        description: description.trim(),
        relevance_scope: relevanceScope.trim(),
        system_extra: systemExtra.trim(),
        required: cleanFields.filter((f) => f.required).map((f) => f.name),
        fields: cleanFields.map(({ name: n, type, label }) => ({ name: n, type, label: label || n })),
        conf_threshold: confThreshold,
      });
      if (sourceKind === "folder_watch" && folderPath.trim()) {
        await api.addSource(project.id, "folder_watch", { watch_path: folderPath.trim() });
      } else if (sourceKind === "sam_gov") {
        await api.addSource(project.id, "sam_gov", {
          keyword: samKeyword.trim() || undefined,
          days: samDays,
          api_key: samApiKey.trim() || undefined,
        });
      }
      refreshProjects();
      toast({ title: `Created “${project.name}”`, description: "Upload or drop documents to get started.", tone: "success" });
      router.push(`/projects/${project.id}`);
    } catch (e) {
      setError(String((e as Error).message || e));
      setSubmitting(false);
    }
  }

  const required = cleanFields.filter((f) => f.required);

  return (
    <main className={styles.shell}>
      <div className={styles.head}>
        <div>
          <h1>New project</h1>
          <p>Pick a starting point, adjust anything, and create. You can change all of this later in Settings.</p>
        </div>
        <div className={styles.headActions}>
          <button type="button" className={`btn ${origin === "blank" ? styles.headActive : ""}`} onClick={pickBlank}>
            <Icon name="plus" size={15} /> Blank
          </button>
          <button
            type="button"
            className={`btn ${origin === "import" ? styles.headActive : ""}`}
            onClick={() => importRef.current?.click()}
            title="Load a template exported from another project or install"
          >
            <Icon name="braces" size={15} /> Import JSON
          </button>
          <input ref={importRef} type="file" accept=".json,application/json" hidden onChange={onImport} />
        </div>
      </div>

      <section className={styles.starts}>
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`${styles.start} ${origin === p.id ? styles.startActive : ""}`}
            onClick={() => loadBody(p.body, p.id)}
            title={p.blurb}
          >
            <span className={styles.startIcon}>
              <Icon name={p.icon} size={17} />
            </span>
            <span className={styles.startName}>{p.name}</span>
          </button>
        ))}
      </section>

      <div className={styles.layout}>
        <div className={styles.formCol}>
          <section className={styles.section}>
            <h2>
              <span className={styles.stepNo}>1</span> Basics
            </h2>
            <div className={styles.row2}>
              <label className={styles.field}>
                <span>Project name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Supplier invoices" />
              </label>
              <label className={styles.field}>
                <span>One-line description</span>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What kind of documents this handles"
                />
              </label>
            </div>
            <label className={styles.field}>
              <span>What counts as relevant?</span>
              <textarea
                rows={4}
                value={relevanceScope}
                onChange={(e) => setRelevanceScope(e.target.value)}
                placeholder={"IN SCOPE: …\nOUT OF SCOPE: …"}
              />
              <small>
                Plain English. The AI reads this first and skips anything out of scope, so attachments like
                terms &amp; conditions never pollute your data.
              </small>
            </label>
            <details className={styles.advanced}>
              <summary>Advanced</summary>
              <label className={styles.field}>
                <span>Extra instructions for the AI</span>
                <textarea
                  rows={2}
                  value={systemExtra}
                  onChange={(e) => setSystemExtra(e.target.value)}
                  placeholder="e.g. Amounts are in EUR unless stated otherwise."
                />
              </label>
              <label className={styles.field}>
                <span>
                  Review threshold <strong>{Math.round(confThreshold * 100)}%</strong>
                </span>
                <input
                  type="range"
                  min={0.2}
                  max={0.95}
                  step={0.05}
                  value={confThreshold}
                  onChange={(e) => setConfThreshold(Number(e.target.value))}
                />
                <small>Fields the AI is less sure about than this go to a human instead of being auto-accepted.</small>
              </label>
            </details>
          </section>

          <section className={styles.section}>
            <h2>
              <span className={styles.stepNo}>2</span> Fields to extract
              <span className={styles.h2Meta}>{cleanFields.length} fields</span>
            </h2>
            <div className={styles.fieldsHead}>
              <span>Label</span>
              <span>Key</span>
              <span>Type</span>
              <span title="Documents missing a required field go to review">Required</span>
              <span />
            </div>
            <div className={styles.fieldList}>
              {rows.map((r, i) => (
                <div key={r._key} className={styles.fieldRow}>
                  <input
                    value={r.label}
                    onChange={(e) => update(r._key, { label: e.target.value })}
                    placeholder="e.g. Invoice number"
                  />
                  <input
                    className={`${styles.keyInput} ${dupes.includes(r.name.trim()) ? styles.keyDupe : ""}`}
                    value={r.name}
                    onChange={(e) => update(r._key, { name: e.target.value, nameTouched: true })}
                    placeholder="invoice_number"
                  />
                  <select value={r.type} onChange={(e) => update(r._key, { type: e.target.value })}>
                    {FIELD_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <label className={styles.toggle}>
                    <input
                      type="checkbox"
                      checked={r.required}
                      onChange={(e) => update(r._key, { required: e.target.checked })}
                    />
                    <span />
                  </label>
                  <div className={styles.rowActions}>
                    <button type="button" onClick={() => move(r._key, -1)} disabled={i === 0} aria-label="Move up">
                      <Icon name="chevronDown" size={14} style={{ transform: "rotate(180deg)" }} />
                    </button>
                    <button type="button" onClick={() => move(r._key, 1)} disabled={i === rows.length - 1} aria-label="Move down">
                      <Icon name="chevronDown" size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRows((list) => list.filter((x) => x._key !== r._key))}
                      aria-label="Remove field"
                      className={styles.removeBtn}
                    >
                      <Icon name="x" size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-sm" onClick={() => setRows((list) => [...list, blankRow()])}>
              <Icon name="plus" size={14} /> Add field
            </button>
          </section>

          <section className={styles.section}>
            <h2>
              <span className={styles.stepNo}>3</span> Where documents come from
            </h2>
            <div className={styles.sources}>
              {(
                [
                  ["manual_upload", "upload", "Upload", "Drag files in or pick them from your computer."],
                  ["folder_watch", "folderIn", "Watched folder", "Pull new files from a local or synced folder."],
                  ["sam_gov", "landmark", "SAM.gov API", "Fetch federal procurement notices automatically."],
                ] as const
              ).map(([id, icon, title, body]) => (
                <button
                  key={id}
                  type="button"
                  className={`${styles.source} ${sourceKind === id ? styles.sourceActive : ""}`}
                  onClick={() => setSourceKind(id)}
                >
                  <Icon name={icon} size={18} />
                  <span className={styles.sourceTitle}>{title}</span>
                  <span className={styles.sourceBody}>{body}</span>
                </button>
              ))}
            </div>
            {sourceKind === "folder_watch" && (
              <label className={styles.field}>
                <span>Folder path</span>
                <input
                  value={folderPath}
                  onChange={(e) => setFolderPath(e.target.value)}
                  placeholder="C:\Users\you\Dropbox\incoming-docs"
                />
              </label>
            )}
            {sourceKind === "sam_gov" && (
              <div className={styles.row3}>
                <label className={styles.field}>
                  <span>Title keyword</span>
                  <input value={samKeyword} onChange={(e) => setSamKeyword(e.target.value)} placeholder="e.g. aviation" />
                </label>
                <label className={styles.field}>
                  <span>Posted within (days)</span>
                  <input type="number" value={samDays} onChange={(e) => setSamDays(Number(e.target.value))} />
                </label>
                <label className={styles.field}>
                  <span>API key (optional)</span>
                  <input value={samApiKey} onChange={(e) => setSamApiKey(e.target.value)} placeholder="Uses the server .env if blank" />
                </label>
              </div>
            )}
          </section>
        </div>

        <aside className={styles.summary}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>Summary</div>
            <div className={styles.summaryName}>{name.trim() || "Untitled project"}</div>
            <div className={styles.summaryDesc}>{description.trim() || "No description yet"}</div>
            <dl className={styles.summaryList}>
              <div>
                <dt>Fields</dt>
                <dd>{cleanFields.length}</dd>
              </div>
              <div>
                <dt>Required</dt>
                <dd>{required.length ? required.map((f) => f.label || f.name).join(", ") : "None"}</dd>
              </div>
              <div>
                <dt>Relevance rules</dt>
                <dd>{relevanceScope.trim() ? "Set" : <span className={styles.warnText}>Not set — every file will be extracted</span>}</dd>
              </div>
              <div>
                <dt>Review below</dt>
                <dd>{Math.round(confThreshold * 100)}% confidence</dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd>{sourceKind === "manual_upload" ? "Upload" : sourceKind === "folder_watch" ? "Watched folder" : "SAM.gov API"}</dd>
              </div>
            </dl>
            {error && <p className={styles.error}>{error}</p>}
            <button type="button" className="btn btn-primary" onClick={submit} disabled={submitting} style={{ width: "100%", justifyContent: "center" }}>
              {submitting ? "Creating…" : "Create project"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => router.push("/projects")} style={{ width: "100%", justifyContent: "center" }}>
              Cancel
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}

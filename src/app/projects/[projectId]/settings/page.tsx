"use client";

import { Fragment, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, ProjectCreateBody, ProjectInfo, ReadingLimits, SourceInfo, TemplateField } from "@/lib/api";
import { toTemplateFile } from "@/lib/presets";
import { Icon } from "@/components/Icon";
import { ReadingLimitsEditor } from "@/components/ReadingLimitsEditor";
import { useShell } from "@/components/ShellContext";
import styles from "./settings.module.css";

const NO_LIMITS: ReadingLimits = {
  max_pdf_pages: null,
  scanned_ocr_pages: null,
  extract_chars: null,
  triage_chars: null,
};

const FIELD_TYPES = ["string", "number", "date", "email", "naics", "string_list"] as const;

type FieldRow = TemplateField & { required: boolean; _key: number };

let nextRowId = 0;
function rowFromField(f: TemplateField, required: boolean): FieldRow {
  return { ...f, required, _key: nextRowId++ };
}

export default function ProjectSettingsPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const { toast, refreshProjects } = useShell();
  const projectId = params.projectId;

  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [relevanceScope, setRelevanceScope] = useState("");
  const [confThreshold, setConfThreshold] = useState(0.55);
  const [fields, setFields] = useState<FieldRow[]>([]);
  const [sources, setSources] = useState<SourceInfo[]>([]);
  const [reading, setReading] = useState<ReadingLimits>(NO_LIMITS);
  const [savedVersion, setSavedVersion] = useState(0);

  const [newSourceType, setNewSourceType] = useState<"folder_watch" | "sam_gov">("folder_watch");
  const [folderPath, setFolderPath] = useState("");
  const [samKeyword, setSamKeyword] = useState("");
  const [samDays, setSamDays] = useState(21);
  const [samApiKey, setSamApiKey] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    api
      .getProject(projectId)
      .then((p) => {
        setProject(p);
        setName(p.name);
        setDescription(p.template.description || "");
        setRelevanceScope(p.template.relevance_scope || "");
        setConfThreshold(p.conf_threshold);
        setReading({ ...NO_LIMITS, ...(p.template.reading || {}) });
        setFields(
          p.template.fields.map((f) => rowFromField(f, p.template.required.includes(f.name)))
        );
      })
      .catch((e) => setError(String(e.message || e)));
    refreshSources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  function refreshSources() {
    api
      .listSources(projectId)
      .then(setSources)
      .catch(() => undefined);
  }

  function updateField(key: number, patch: Partial<FieldRow>) {
    setFields((rows) => rows.map((r) => (r._key === key ? { ...r, ...patch } : r)));
  }

  function addField() {
    setFields((rows) => [...rows, rowFromField({ name: "", type: "string", label: "" }, false)]);
  }

  function removeField(key: number) {
    setFields((rows) => rows.filter((r) => r._key !== key));
  }

  async function save() {
    setError(null);
    setMsg(null);
    const clean = fields.map((f) => ({ ...f, name: f.name.trim() })).filter((f) => f.name);
    if (clean.length === 0) {
      setError("Add at least one field.");
      return;
    }
    setSaving(true);
    try {
      const updated = await api.updateProject(projectId, {
        name: name.trim(),
        description: description.trim(),
        relevance_scope: relevanceScope.trim(),
        required: clean.filter((f) => f.required).map((f) => f.name),
        fields: clean.map(({ name: n, type, label, description: d }) => ({
          name: n,
          type,
          label: label || n,
          description: (d || "").trim(),
        })),
        conf_threshold: confThreshold,
        reading,
      });
      setProject(updated);
      if (updated.template.reading) setReading({ ...NO_LIMITS, ...updated.template.reading });
      setSavedVersion((v) => v + 1);
      setMsg("Saved.");
      refreshProjects();
      toast({ title: "Settings saved", tone: "success" });
    } catch (e) {
      setError(String((e as Error).message || e));
    } finally {
      setSaving(false);
    }
  }

  function currentBody(): ProjectCreateBody {
    const clean = fields.map((f) => ({ ...f, name: f.name.trim() })).filter((f) => f.name);
    return {
      name: name.trim(),
      description: description.trim(),
      relevance_scope: relevanceScope.trim(),
      system_extra: project?.template.system_extra || "",
      required: clean.filter((f) => f.required).map((f) => f.name),
      fields: clean.map(({ name: n, type, label, description: d }) => ({
          name: n,
          type,
          label: label || n,
          description: (d || "").trim(),
        })),
      conf_threshold: confThreshold,
      reading,
    };
  }

  function exportTemplate() {
    const file = toTemplateFile(currentBody());
    const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project?.slug || "project"}.template.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Template exported", description: "Import it from New project → Import JSON on any install.", tone: "success" });
  }

  async function duplicateProject() {
    try {
      const copy = await api.createProject({ ...currentBody(), name: `${name.trim()} (copy)` });
      refreshProjects();
      toast({ title: `Created “${copy.name}”`, description: "Same fields and rules, no documents.", tone: "success" });
      router.push(`/projects/${copy.id}/settings`);
    } catch (e) {
      toast({ title: "Couldn't duplicate", description: String((e as Error).message || e), tone: "error" });
    }
  }

  async function addSource() {
    setError(null);
    try {
      if (newSourceType === "folder_watch") {
        if (!folderPath.trim()) {
          setError("Enter a folder path first.");
          return;
        }
        await api.addSource(projectId, "folder_watch", { watch_path: folderPath.trim() });
        setFolderPath("");
      } else {
        await api.addSource(projectId, "sam_gov", {
          keyword: samKeyword.trim() || undefined,
          days: samDays,
          api_key: samApiKey.trim() || undefined,
        });
        setSamKeyword("");
        setSamApiKey("");
      }
      refreshSources();
    } catch (e) {
      setError(String((e as Error).message || e));
    }
  }

  async function removeSource(id: number) {
    await api.deleteSource(id);
    refreshSources();
  }

  if (!project) {
    return (
      <main className={styles.shell}>
        <p>{error || "Loading…"}</p>
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <div className={styles.headRow}>
        <div>
          <h1>Settings</h1>
          <p className={styles.headSub}>Template, relevance rules and document sources for {project.name}.</p>
        </div>
        <div className={styles.headActions}>
          <button type="button" className="btn" onClick={exportTemplate} title="Download this project's template as a portable JSON file">
            <Icon name="download" size={15} /> Export template
          </button>
          <button type="button" className="btn" onClick={duplicateProject} title="New project with the same fields and rules">
            <Icon name="layers" size={15} /> Duplicate
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      <div className={styles.section}>
        <h2>Basics</h2>
        <div className={styles.row}>
          <label htmlFor="name">Project name</label>
          <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className={styles.row}>
          <label htmlFor="description">Description</label>
          <input
            id="description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className={styles.row}>
          <label htmlFor="scope">
            Relevant-document rules (what makes a document IN or OUT of scope)
          </label>
          <textarea
            id="scope"
            rows={4}
            value={relevanceScope}
            onChange={(e) => setRelevanceScope(e.target.value)}
          />
        </div>
        <div className={styles.row}>
          <label htmlFor="conf">Confidence threshold ({confThreshold.toFixed(2)})</label>
          <input
            id="conf"
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={confThreshold}
            onChange={(e) => setConfThreshold(Number(e.target.value))}
          />
        </div>
      </div>

      <div className={styles.section}>
        <h2>Fields to extract</h2>
        <table className={styles.fieldsTable}>
          <thead>
            <tr>
              <th>Field name</th>
              <th>Label</th>
              <th>Type</th>
              <th>Required</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {fields.map((f) => (
              <Fragment key={f._key}>
              <tr className={styles.fieldRow}>
                <td>
                  <input
                    type="text"
                    value={f.name}
                    onChange={(e) => updateField(f._key, { name: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={f.label}
                    onChange={(e) => updateField(f._key, { label: e.target.value })}
                  />
                </td>
                <td>
                  <select
                    value={f.type}
                    onChange={(e) => updateField(f._key, { type: e.target.value })}
                  >
                    {FIELD_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={styles.centerCell}>
                  <input
                    type="checkbox"
                    checked={f.required}
                    onChange={(e) => updateField(f._key, { required: e.target.checked })}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={() => removeField(f._key)}
                    aria-label="Remove field"
                  >
                    ✕
                  </button>
                </td>
              </tr>
              <tr className={styles.descRow}>
                <td colSpan={5}>
                  <textarea
                    rows={1}
                    value={f.description || ""}
                    placeholder="What it means for the AI: where it's usually found, and what it is not (optional)"
                    aria-label={`What ${f.label || f.name || "this field"} means`}
                    onChange={(e) => updateField(f._key, { description: e.target.value })}
                  />
                </td>
              </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
        <button type="button" className={styles.addBtn} onClick={addField}>
          + Add field
        </button>
        <p className={styles.hint}>
          Changes here only affect documents processed <em>after</em> saving — already-processed
          documents keep the field values they were extracted with.
        </p>
      </div>

      <div className={styles.section}>
        <h2>Reading limits</h2>
        <p className={styles.hint}>
          How much of each document this project reads. Leave a box empty to use the default.
        </p>
        <ReadingLimitsEditor projectId={projectId} value={reading} onChange={setReading} savedVersion={savedVersion} />
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.saveBtn} onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button type="button" className={styles.ghostBtn} onClick={() => router.push(`/projects/${projectId}`)}>
          Back to queue
        </button>
        {msg && <span className={styles.meta}>{msg}</span>}
      </div>
      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.section}>
        <h2>Document sources</h2>
        {sources.length === 0 && (
          <p className={styles.hint}>
            No configured sources yet — manual upload from the project page always works
            regardless.
          </p>
        )}
        <ul className={styles.sourceList}>
          {sources.map((s) => (
            <li key={s.id}>
              <span>
                <strong>{s.type}</strong> — <code>{JSON.stringify(s.config)}</code>
              </span>
              <button type="button" className={styles.removeBtn} onClick={() => removeSource(s.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
        <div className={styles.addSource}>
          <select
            value={newSourceType}
            onChange={(e) => setNewSourceType(e.target.value as "folder_watch" | "sam_gov")}
          >
            <option value="folder_watch">Watched folder</option>
            <option value="sam_gov">SAM.gov API</option>
          </select>
          {newSourceType === "folder_watch" ? (
            <input
              type="text"
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              placeholder="C:\path\to\folder"
            />
          ) : (
            <>
              <input
                type="text"
                value={samKeyword}
                onChange={(e) => setSamKeyword(e.target.value)}
                placeholder="keyword (optional)"
              />
              <input
                type="number"
                value={samDays}
                onChange={(e) => setSamDays(Number(e.target.value))}
                placeholder="days"
              />
              <input
                type="text"
                value={samApiKey}
                onChange={(e) => setSamApiKey(e.target.value)}
                placeholder="API key (optional)"
              />
            </>
          )}
          <button type="button" className={styles.addBtn} onClick={addSource}>
            + Add source
          </button>
        </div>
      </div>
    </main>
  );
}

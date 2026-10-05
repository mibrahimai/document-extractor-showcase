export type TemplateField = {
  name: string;
  type: string;
  label: string;
  hint?: unknown;
  // What the field means, for the AI: where it's found, what it is not.
  description?: string;
};

export type TemplateInfo = {
  id: string;
  name: string;
  description: string;
  relevance_scope?: string;
  system_extra?: string;
  required: string[];
  fields: TemplateField[];
  reading?: ReadingLimits;
};

// Per-project reading limits; null = use the default.
export type ReadingLimits = {
  max_pdf_pages: number | null;
  scanned_ocr_pages: number | null;
  extract_chars: number | null;
  triage_chars: number | null;
};

export type LimitKey = keyof ReadingLimits;

export type LimitsInfo = {
  project: ReadingLimits;
  defaults: Record<LimitKey, number>;
  bounds: Record<LimitKey, [number, number]>;
  effective: Record<LimitKey, number> & { num_ctx: number; timeout_sec: number; notes: string[] };
  machine: { num_ctx: number; timeout_sec: number; max_chars: number };
  chars_per_page: number;
};

// What was actually read from a document, and under which limits.
export type ReadingInfo = {
  pages_total: number | null;
  pages_read: number | null;
  ocr_pages: number;
  chars_total: number;
  chars_triage: number;
  chars_extracted: number | null;
  truncated: boolean;
  notes: string[];
  limits: Record<string, number>;
};

export type ProjectInfo = {
  id: number;
  slug: string;
  name: string;
  conf_threshold: number;
  status: string;
  last_run_at: string | null;
  last_run_summary: string | null;
  doc_count: number;
  status_counts?: Record<string, number>;
  template: TemplateInfo;
};

export type PreviewInfo =
  | { kind: "pages"; pages: { w: number; h: number }[] }
  | { kind: "html" }
  | { kind: "none"; reason: string };

export type RunFile = {
  name: string;
  folder: string;
  state: "queued" | "active" | "done" | "failed";
  stage: string | null;
  result: string | null;
  doc_id: string | null;
  elapsed: number | null;
  error: string | null;
};

export type RunProgress = {
  status: string;
  run: {
    running: boolean;
    started_at: number;
    finished_at: number | null;
    total: number;
    done: number;
    skipped: number;
    eta_seconds: number | null;
    files: RunFile[];
  } | null;
  pending: { name: string; folder: string }[];
};

export type HealthInfo = {
  ok: boolean;
  llm?: { provider: string; model: string; reachable: boolean; model_available: boolean };
};

export type DocRow = {
  id: string;
  status: string;
  ingest_kind: string;
  template_id?: string;
  source_path: string;
  source_folder?: string | null;
  file_name?: string | null;
  overall_confidence: number;
  filled_field_count?: number;
  low_confidence_fields: string[];
  solicitation_number: string | null;
  title: string | null;
  relevant?: boolean | null;
  document_kind?: string | null;
  related_to?: string | null;
  processed_at?: string | null;
  truncated?: boolean;
  // Fields the model never answered (a re-run usually fixes them).
  skipped_fields?: number;
  corrected?: boolean;
};

export type FieldResult = {
  value: unknown;
  confidence: number;
  null_reason?: string | null;
  source_hint?: string | null;
};

export type EvidenceBox = {
  field: string;
  kind: "value" | "context";
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type FieldSource = {
  status: "found" | "ambiguous" | "not_found";
  strategy: "" | "evidence" | "value" | "fuzzy";
  count: number;
  pages: number[];
  in_html: boolean;
  in_text: boolean;
  snippet: { before: string; match: string; after: string } | null;
  evidence: string | null;
};

export type LocateResult = {
  layer: "pages" | "html" | "none";
  fields: Record<string, FieldSource>;
  boxes: EvidenceBox[];
  text: string;
  text_spans: { field: string; kind: "value" | "context"; start: number; end: number }[];
  error?: string;
};

export type DocDetail = {
  id: string;
  status: string;
  ingest_kind: string;
  template_id?: string;
  source_path: string;
  source_folder?: string | null;
  text_preview: string;
  overall_confidence: number;
  filled_field_count?: number;
  low_confidence_fields: string[];
  validation_flags: string[];
  human_corrections: Record<string, unknown>;
  extraction: Record<string, FieldResult> | null;
  metrics: Record<string, unknown>;
  error?: string | null;
  relevant?: boolean | null;
  document_kind?: string | null;
  related_to?: string | null;
  processed_at?: string | null;
  reading?: ReadingInfo | null;
  template?: TemplateInfo;
};

export type ProjectCreateBody = {
  name: string;
  description?: string;
  relevance_scope?: string;
  system_extra?: string;
  required?: string[];
  fields: TemplateField[];
  conf_threshold?: number;
  reading?: ReadingLimits;
};

export type ProjectUpdateBody = Partial<ProjectCreateBody>;

export type SourceInfo = {
  id: number;
  type: string;
  config: Record<string, unknown>;
};

export type TestExtractResult = {
  reading?: ReadingInfo;
  file_name: string | null;
  ingest_kind: string;
  ingest_warning?: string | null;
  text_chars: number;
  text_preview: string;
  status: string;
  error?: string | null;
  relevant?: boolean | null;
  document_kind?: string | null;
  related_to?: string | null;
  extraction: Record<string, FieldResult> | null;
  validation_flags?: string[];
  low_confidence_fields?: string[];
  overall_confidence?: number;
  filled_field_count?: number;
  metrics?: Record<string, unknown>;
};

export type Vendor = {
  id: number;
  name: string;
  email: string | null;
  notes: string | null;
};

export type Quote = {
  id: number;
  vendor_id: number;
  rfq_email_draft: string | null;
  price: number | null;
  lead_time_days: number | null;
  notes: string | null;
};

export type TaskEvent = {
  event: string;
  detail: string | null;
  created_at: string;
};

export type TaskSummary = {
  id: number;
  doc_id: string;
  title: string;
  stage: string;
  selected_quote_id: number | null;
  invoice_amount: number | null;
  invoice_note: string | null;
  doc_status: string | null;
};

export type TaskDetail = TaskSummary & {
  document: { id: string; status: string; extraction_summary: string } | null;
  quotes: Quote[];
  events: TaskEvent[];
};

// Direct API origin (see next.config.ts); "" means same-origin relative URLs.
// Relay path hosting uses e.g. "/extractor" so calls become "/extractor/api/...".
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/$/, "");
const u = (path: string) => `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

// Identical GETs in flight at the same moment share one network request.
// React dev mode runs every loader twice, and during in-app navigation the
// second of two identical concurrent requests intermittently came back as a
// synthetic empty 204 (no "server: uvicorn" header, so not from the API) —
// the page then showed an error screen that looked frozen until a refresh.
const inflight = new Map<string, Promise<unknown>>();

function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (init?.method && init.method !== "GET") return send<T>(path, init);
  const existing = inflight.get(path);
  if (existing) return existing as Promise<T>;
  const p = send<T>(path, init).finally(() => inflight.delete(path));
  inflight.set(path, p);
  return p;
}

async function send<T>(path: string, init?: RequestInit, retried = false): Promise<T> {
  let r: Response;
  try {
    r = await fetch(u(path), { cache: "no-store", ...init });
  } catch (e) {
    // One retry, after a beat, for a dropped connection; a second failure is real.
    if (!retried) {
      await new Promise((res) => setTimeout(res, 300));
      return send<T>(path, init, true);
    }
    throw e;
  }
  if (!r.ok) {
    let detail = "";
    try {
      const body = await r.json();
      detail = body?.detail ? `: ${body.detail}` : "";
    } catch {
      // ignore — not every error body is JSON
    }
    throw new Error(`API ${r.status}${detail}`);
  }
  const text = await r.text();
  if (!text) {
    // Every endpoint returns a JSON body, so an empty 2xx is a transport glitch
    // (seen through the Next dev proxy). Retry once.
    if (!retried) {
      await new Promise((res) => setTimeout(res, 300));
      return send<T>(path, init, true);
    }
    throw new Error("The server sent an empty reply. Try again.");
  }
  return JSON.parse(text) as T;
}

export const api = {
  health: () => request<HealthInfo>("/api/health"),
  listProjects: () => request<ProjectInfo[]>("/api/projects"),
  getProject: (id: number | string) => request<ProjectInfo>(`/api/projects/${id}`),
  createProject: (body: ProjectCreateBody) =>
    request<ProjectInfo>("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  updateProject: (id: number | string, body: ProjectUpdateBody) =>
    request<ProjectInfo>(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  deleteProject: (id: number | string) =>
    request<{ deleted: number }>(`/api/projects/${id}`, { method: "DELETE" }),
  listSources: (projectId: number | string) =>
    request<SourceInfo[]>(`/api/projects/${projectId}/sources`),
  addSource: (projectId: number | string, type: string, config: Record<string, unknown>) =>
    request<SourceInfo>(`/api/projects/${projectId}/sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, config }),
    }),
  deleteSource: (sourceId: number) =>
    request<{ deleted: number }>(`/api/sources/${sourceId}`, { method: "DELETE" }),
  upload: async (projectId: number | string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    const r = await fetch(u(`/api/projects/${projectId}/upload`), { method: "POST", body: form });
    if (!r.ok) throw new Error(`Upload failed (${r.status})`);
    return r.json() as Promise<{ saved: string }>;
  },
  limits: (projectId: number | string) => request<LimitsInfo>(`/api/projects/${projectId}/limits`),
  progress: (projectId: number | string) => request<RunProgress>(`/api/projects/${projectId}/progress`),
  run: (projectId: number | string) =>
    request<{ status: string }>(`/api/projects/${projectId}/run`, { method: "POST" }),
  importFolder: (projectId: number | string, folderPath: string) =>
    request<{ status: string }>(`/api/projects/${projectId}/import-folder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder_path: folderPath }),
    }),
  testExtract: async (projectId: number | string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    const r = await fetch(u(`/api/projects/${projectId}/test-extract`), { method: "POST", body: form });
    if (!r.ok) {
      let detail = "";
      try {
        const body = await r.json();
        detail = body?.detail ? `: ${body.detail}` : "";
      } catch {
        // ignore
      }
      throw new Error(`Test failed (${r.status})${detail}`);
    }
    return r.json() as Promise<TestExtractResult>;
  },
  reprocess: (
    projectId: number | string,
    body: { scope: "document" | "folder" | "all" | "skipped"; doc_id?: string; folder?: string }
  ) =>
    request<{ status: string }>(`/api/projects/${projectId}/reprocess`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  listDocuments: (projectId: number | string, status?: string) =>
    request<DocRow[]>(`/api/projects/${projectId}/documents${status ? `?status=${status}` : ""}`),
  getDocument: (projectId: number | string, docId: string) =>
    request<DocDetail>(`/api/projects/${projectId}/documents/${encodeURIComponent(docId)}`),
  fileUrl: (projectId: number | string, docId: string, download = false) =>
    u(`/api/projects/${projectId}/documents/${encodeURIComponent(docId)}/file${download ? "?download=1" : ""}`),
  locate: (projectId: number | string, docId: string) =>
    request<LocateResult>(`/api/projects/${projectId}/documents/${encodeURIComponent(docId)}/locate`),
  previewInfo: (projectId: number | string, docId: string) =>
    request<PreviewInfo>(`/api/projects/${projectId}/documents/${encodeURIComponent(docId)}/preview`),
  previewPageUrl: (projectId: number | string, docId: string, page: number, scale: number) =>
    u(`/api/projects/${projectId}/documents/${encodeURIComponent(docId)}/preview/page/${page}?scale=${scale}`),
  previewHtmlUrl: (projectId: number | string, docId: string, theme: string) =>
    u(`/api/projects/${projectId}/documents/${encodeURIComponent(docId)}/preview/html?theme=${theme}`),
  standardizedExportUrl: (projectId: number | string) =>
    u(`/api/projects/${projectId}/export-standardized`),
  openFolder: (projectId: number | string, docId: string) =>
    request<{ opened_folder_for: string }>(
      `/api/projects/${projectId}/documents/${encodeURIComponent(docId)}/open-folder`,
      { method: "POST" }
    ),
  openFile: (projectId: number | string, docId: string) =>
    request<{ opened: string }>(
      `/api/projects/${projectId}/documents/${encodeURIComponent(docId)}/open-file`,
      { method: "POST" }
    ),
  correct: (
    projectId: number | string,
    docId: string,
    fields: Record<string, unknown>,
    approve: boolean
  ) =>
    request<DocDetail>(
      `/api/projects/${projectId}/documents/${encodeURIComponent(docId)}/correct`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields, approve }),
      }
    ),

  // ---- Procurement workflow (mocked) ----
  listVendors: (projectId: number | string) =>
    request<Vendor[]>(`/api/projects/${projectId}/vendors`),
  addVendor: (projectId: number | string, name: string, email?: string, notes?: string) =>
    request<Vendor>(`/api/projects/${projectId}/vendors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email: email || null, notes: notes || null }),
    }),
  deleteVendor: (vendorId: number) =>
    request<{ deleted: number }>(`/api/vendors/${vendorId}`, { method: "DELETE" }),
  listTasks: (projectId: number | string) =>
    request<TaskSummary[]>(`/api/projects/${projectId}/tasks`),
  createTask: (projectId: number | string, docId: string) =>
    request<TaskSummary>(
      `/api/projects/${projectId}/documents/${encodeURIComponent(docId)}/create-task`,
      { method: "POST" }
    ),
  getTask: (taskId: number | string) => request<TaskDetail>(`/api/tasks/${taskId}`),
  inviteVendor: (taskId: number | string, vendorId: number) =>
    request<{ id: number; vendor_id: number }>(`/api/tasks/${taskId}/quotes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendor_id: vendorId }),
    }),
  draftEmail: (quoteId: number) =>
    request<{ rfq_email_draft: string }>(`/api/quotes/${quoteId}/draft-email`, {
      method: "POST",
    }),
  updateQuote: (
    quoteId: number,
    body: { price?: number; lead_time_days?: number; notes?: string }
  ) =>
    request<{ id: number }>(`/api/quotes/${quoteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  selectQuote: (taskId: number | string, quoteId: number) =>
    request<TaskSummary>(`/api/tasks/${taskId}/select-quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quote_id: quoteId }),
    }),
  advanceTask: (taskId: number | string, stage: string) =>
    request<TaskSummary>(`/api/tasks/${taskId}/advance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    }),
  updateTaskInvoice: (
    taskId: number | string,
    body: { invoice_amount?: number; invoice_note?: string }
  ) =>
    request<TaskSummary>(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
};

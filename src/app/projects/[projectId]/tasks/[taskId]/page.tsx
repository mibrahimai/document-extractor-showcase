"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, TaskDetail, Vendor } from "@/lib/api";
import styles from "./task.module.css";

type QuoteDraft = { price: string; lead_time_days: string; notes: string };

const STAGE_ORDER = ["sourcing", "ordered", "shipped", "delivered", "invoiced", "closed"];

export default function TaskDetailPage() {
  const params = useParams<{ projectId: string; taskId: string }>();
  const projectId = params.projectId;
  const taskId = params.taskId;

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [inviteVendorId, setInviteVendorId] = useState<string>("");
  const [drafts, setDrafts] = useState<Record<number, QuoteDraft>>({});
  const [draftingEmail, setDraftingEmail] = useState<number | null>(null);
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceNote, setInvoiceNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTask = useCallback(() => {
    api
      .getTask(taskId)
      .then((t) => {
        setTask(t);
        setDrafts((prev) => {
          const next = { ...prev };
          for (const q of t.quotes) {
            if (!next[q.id]) {
              next[q.id] = {
                price: q.price != null ? String(q.price) : "",
                lead_time_days: q.lead_time_days != null ? String(q.lead_time_days) : "",
                notes: q.notes || "",
              };
            }
          }
          return next;
        });
        if (t.invoice_amount != null) setInvoiceAmount(String(t.invoice_amount));
        if (t.invoice_note) setInvoiceNote(t.invoice_note);
      })
      .catch((e) => setError(String(e.message || e)));
  }, [taskId]);

  useEffect(() => {
    loadTask();
    api.listVendors(projectId).then(setVendors).catch(() => {});
  }, [loadTask, projectId]);

  const invitedVendorIds = useMemo(
    () => new Set((task?.quotes || []).map((q) => q.vendor_id)),
    [task]
  );
  const availableVendors = vendors.filter((v) => !invitedVendorIds.has(v.id));
  const vendorName = (id: number) => vendors.find((v) => v.id === id)?.name || `Vendor #${id}`;

  async function withBusy(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      loadTask();
    } catch (e) {
      setError(String((e as Error).message || e));
    } finally {
      setBusy(false);
    }
  }

  function handleInvite() {
    if (!inviteVendorId) return;
    withBusy(() => api.inviteVendor(taskId, Number(inviteVendorId))).then(() =>
      setInviteVendorId("")
    );
  }

  function handleDraftEmail(quoteId: number) {
    setDraftingEmail(quoteId);
    withBusy(() => api.draftEmail(quoteId)).finally(() => setDraftingEmail(null));
  }

  function handleLogQuote(quoteId: number) {
    const d = drafts[quoteId];
    if (!d) return;
    withBusy(() =>
      api.updateQuote(quoteId, {
        price: d.price.trim() ? Number(d.price) : undefined,
        lead_time_days: d.lead_time_days.trim() ? Number(d.lead_time_days) : undefined,
        notes: d.notes.trim() || undefined,
      })
    );
  }

  function handleSelectQuote(quoteId: number) {
    if (!window.confirm("Select this vendor as the winner and move this task to 'ordered'?")) return;
    withBusy(() => api.selectQuote(taskId, quoteId));
  }

  function handleAdvance(stage: string) {
    withBusy(() => api.advanceTask(taskId, stage));
  }

  function handleLogInvoice() {
    if (!invoiceAmount.trim()) return;
    withBusy(() =>
      api.updateTaskInvoice(taskId, {
        invoice_amount: Number(invoiceAmount),
        invoice_note: invoiceNote.trim() || undefined,
      })
    );
  }

  if (error && !task) {
    return (
      <main className={styles.shell}>
        <p className={styles.error}>{error}</p>
        <Link href={`/projects/${projectId}/tasks`}>Back to tasks</Link>
      </main>
    );
  }

  if (!task) {
    return (
      <main className={styles.shell}>
        <p>Loading…</p>
      </main>
    );
  }

  const stageIdx = STAGE_ORDER.indexOf(task.stage);
  const winningQuote = task.quotes.find((q) => q.id === task.selected_quote_id);

  return (
    <main className={styles.shell}>
      <Link href={`/projects/${projectId}/tasks`} className={styles.back}>
        ← Tasks
      </Link>
      <div className={styles.top}>
        <h1>{task.title}</h1>
        <span className={`${styles.badge} ${styles[`stage_${task.stage}`] || ""}`}>
          {task.stage}
        </span>
      </div>

      <ol className={styles.stepper} aria-label="Task progress">
        {STAGE_ORDER.map((s, i) => (
          <li
            key={s}
            className={`${styles.stepItem} ${i < stageIdx || task.stage === "closed" ? styles.stepDone : ""} ${i === stageIdx && task.stage !== "closed" ? styles.stepCurrent : ""}`}
            aria-current={i === stageIdx ? "step" : undefined}
          >
            <span className={styles.stepDot}>{i < stageIdx || task.stage === "closed" ? "✓" : i + 1}</span>
            <span className={styles.stepName}>{s}</span>
          </li>
        ))}
      </ol>

      {error && <p className={styles.error}>{error}</p>}

      <section className={styles.panel}>
        <h2>Linked RFQ</h2>
        <pre className={styles.summary}>
          {task.document?.extraction_summary || "(document not found)"}
        </pre>
      </section>

      {task.stage === "sourcing" && (
        <section className={styles.panel}>
          <h2>Invite a vendor</h2>
          <div className={styles.row}>
            <select value={inviteVendorId} onChange={(e) => setInviteVendorId(e.target.value)}>
              <option value="">Choose a vendor…</option>
              {availableVendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            <button type="button" className={styles.ghostBtn} onClick={handleInvite} disabled={busy}>
              Invite
            </button>
            {vendors.length === 0 && (
              <span className={styles.meta}>
                No vendors yet — <Link href={`/projects/${projectId}/vendors`}>add some first</Link>.
              </span>
            )}
          </div>
        </section>
      )}

      {task.quotes.length > 0 && (
        <section className={styles.panel}>
          <h2>Quotes</h2>
          {task.quotes.map((q) => {
            const d = drafts[q.id] || { price: "", lead_time_days: "", notes: "" };
            const isWinner = q.id === task.selected_quote_id;
            const canEdit = task.stage === "sourcing";
            return (
              <div key={q.id} className={styles.quoteCard}>
                <div className={styles.quoteHead}>
                  <strong>{vendorName(q.vendor_id)}</strong>
                  {isWinner && <span className={styles.winnerTag}>Selected</span>}
                </div>

                {!q.rfq_email_draft ? (
                  canEdit && (
                    <button
                      type="button"
                      className={styles.ghostBtn}
                      onClick={() => handleDraftEmail(q.id)}
                      disabled={busy || draftingEmail === q.id}
                    >
                      {draftingEmail === q.id ? "Drafting…" : "Draft RFQ email"}
                    </button>
                  )
                ) : (
                  <details className={styles.emailDetails}>
                    <summary>RFQ email draft</summary>
                    <pre className={styles.emailPreview}>{q.rfq_email_draft}</pre>
                  </details>
                )}

                <div className={styles.quoteFields}>
                  <label>
                    Price
                    <input
                      type="number"
                      value={d.price}
                      disabled={!canEdit}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [q.id]: { ...d, price: e.target.value } }))
                      }
                    />
                  </label>
                  <label>
                    Lead time (days)
                    <input
                      type="number"
                      value={d.lead_time_days}
                      disabled={!canEdit}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [q.id]: { ...d, lead_time_days: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className={styles.notesLabel}>
                    Notes
                    <input
                      value={d.notes}
                      disabled={!canEdit}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [q.id]: { ...d, notes: e.target.value } }))
                      }
                    />
                  </label>
                </div>

                {canEdit && (
                  <div className={styles.quoteActions}>
                    <button
                      type="button"
                      className={styles.ghostBtn}
                      onClick={() => handleLogQuote(q.id)}
                      disabled={busy}
                    >
                      Log quote
                    </button>
                    <button
                      type="button"
                      className={styles.primaryBtn}
                      onClick={() => handleSelectQuote(q.id)}
                      disabled={busy || q.price == null}
                      title={q.price == null ? "Log a price before selecting this vendor" : undefined}
                    >
                      Select as winner
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {stageIdx >= 1 && task.stage !== "closed" && (
        <section className={styles.panel}>
          <h2>Fulfillment</h2>
          {winningQuote && (
            <p className={styles.meta}>
              Ordered from <strong>{vendorName(winningQuote.vendor_id)}</strong> at{" "}
              {winningQuote.price?.toLocaleString()}
            </p>
          )}
          <div className={styles.row}>
            {task.stage === "ordered" && (
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => handleAdvance("shipped")}
                disabled={busy}
              >
                Mark shipped
              </button>
            )}
            {task.stage === "shipped" && (
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => handleAdvance("delivered")}
                disabled={busy}
              >
                Mark delivered
              </button>
            )}
          </div>

          {task.stage === "delivered" && (
            <div className={styles.invoiceForm}>
              <h3>Financial closure</h3>
              <div className={styles.row}>
                <label>
                  Invoice amount
                  <input
                    type="number"
                    value={invoiceAmount}
                    onChange={(e) => setInvoiceAmount(e.target.value)}
                  />
                </label>
                <label className={styles.notesLabel}>
                  Note
                  <input value={invoiceNote} onChange={(e) => setInvoiceNote(e.target.value)} />
                </label>
              </div>
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={handleLogInvoice}
                disabled={busy || !invoiceAmount.trim()}
              >
                Log invoice
              </button>
              {task.invoice_amount != null && (
                <button
                  type="button"
                  className={styles.primaryBtn}
                  style={{ marginLeft: "0.5rem" }}
                  onClick={() => handleAdvance("invoiced")}
                  disabled={busy}
                >
                  Mark invoiced
                </button>
              )}
            </div>
          )}

          {task.stage === "invoiced" && (
            <div className={styles.invoiceForm}>
              <p className={styles.meta}>
                Invoice: {task.invoice_amount?.toLocaleString()} — {task.invoice_note || "(no note)"}
              </p>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => handleAdvance("closed")}
                disabled={busy}
              >
                Close task
              </button>
            </div>
          )}
        </section>
      )}

      {task.stage === "closed" && (
        <section className={styles.panel}>
          <h2>Closed</h2>
          <p className={styles.meta}>
            {winningQuote && (
              <>
                Fulfilled by <strong>{vendorName(winningQuote.vendor_id)}</strong> at{" "}
                {winningQuote.price?.toLocaleString()}.{" "}
              </>
            )}
            Invoice: {task.invoice_amount?.toLocaleString()} — {task.invoice_note || "(no note)"}
          </p>
        </section>
      )}

      <section className={styles.panel}>
        <h2>Event timeline</h2>
        <ul className={styles.timeline}>
          {task.events.map((e, i) => (
            <li key={i}>
              <span className={styles.meta}>{new Date(e.created_at).toLocaleString()}</span> —{" "}
              <strong>{e.event}</strong>
              {e.detail ? `: ${e.detail}` : ""}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

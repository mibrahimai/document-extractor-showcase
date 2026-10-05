"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, Vendor } from "@/lib/api";
import styles from "./vendors.module.css";

export default function VendorsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.listVendors(projectId).then(setVendors).catch((e) => setError(String(e.message || e)));
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api.addVendor(projectId, name.trim(), email.trim(), notes.trim());
      setName("");
      setEmail("");
      setNotes("");
      load();
    } catch (err) {
      setError(String((err as Error).message || err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Remove this vendor? Existing quotes referencing it are kept.")) return;
    try {
      await api.deleteVendor(id);
      load();
    } catch (err) {
      setError(String((err as Error).message || err));
    }
  }

  return (
    <main className={styles.shell}>
      <Link href={`/projects/${projectId}`} className={styles.back}>
        ← Queue
      </Link>
      <h1>Vendors</h1>
      <p>
        A reusable directory for this project — add a vendor once, then invite them to quote on
        any procurement task.
      </p>

      <form className={styles.section} onSubmit={handleAdd}>
        <div className={styles.row}>
          <input
            placeholder="Vendor name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            placeholder="Email (optional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <input
          className={styles.notesInput}
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <button type="submit" className={styles.runBtn} disabled={saving}>
          {saving ? "Adding…" : "Add vendor"}
        </button>
        {error && <p className={styles.error}>{error}</p>}
      </form>

      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Notes</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {vendors.map((v) => (
            <tr key={v.id}>
              <td>{v.name}</td>
              <td className={styles.meta}>{v.email || "—"}</td>
              <td className={styles.meta}>{v.notes || "—"}</td>
              <td>
                <button type="button" className={styles.ghostBtn} onClick={() => handleDelete(v.id)}>
                  Remove
                </button>
              </td>
            </tr>
          ))}
          {vendors.length === 0 && (
            <tr>
              <td colSpan={4} className={styles.meta}>
                No vendors yet — add one above.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}

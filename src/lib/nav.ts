// Per-tab memory of how the reviewer reached a document, so Back returns to
// the exact queue view (filters, search, folder, page) and Prev/Next walk the
// same list, in the same order, that they were looking at.

export type ReviewOrder = {
  ids: string[];
  label: string; // e.g. "Needs review", "BAFS CCTV Replacement", "Search “cctv”"
  returnUrl: string; // the queue URL (with its filters) to go back to
};

const key = (projectId: string | number, kind: string) => `dx:${kind}:${projectId}`;

function read<T>(k: string): T | null {
  try {
    const s = sessionStorage.getItem(k);
    return s ? (JSON.parse(s) as T) : null;
  } catch {
    return null;
  }
}

function write(k: string, v: unknown) {
  try {
    sessionStorage.setItem(k, JSON.stringify(v));
  } catch {
    // storage unavailable (private mode, quota) — navigation still works, just without memory
  }
}

export const saveOrder = (pid: string | number, order: ReviewOrder) => write(key(pid, "order"), order);
export const loadOrder = (pid: string | number) => read<ReviewOrder>(key(pid, "order"));

export const saveQueueUrl = (pid: string | number, url: string) => write(key(pid, "queue"), url);
export const loadQueueUrl = (pid: string | number) => read<string>(key(pid, "queue")) || `/projects/${pid}`;

export const setLastOpened = (pid: string | number, docId: string) => write(key(pid, "last"), docId);
export const getLastOpened = (pid: string | number) => read<string>(key(pid, "last"));

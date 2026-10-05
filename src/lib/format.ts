// SAM.gov downloads land in folders named "<32-hex notice id>_<Title_Words>".
// The id is useful as a tooltip, not as the thing a human scans for.
const NOTICE_PREFIX = /^[0-9a-f]{32}_/i;

export function humanizeFolder(folder: string | null | undefined): string {
  // Files dropped straight into a project's raw/ root (uploads) have no subfolder.
  if (!folder || folder === "raw" || folder === "(no folder)") return "Uploaded files";
  const stripped = folder.replace(NOTICE_PREFIX, "");
  return stripped.replace(/[_+]/g, " ").replace(/\s+/g, " ").trim() || folder;
}

export function statusLabel(status: string): string {
  switch (status) {
    case "needs_review":
      return "Needs review";
    case "not_relevant":
      return "Not relevant";
    case "extracted":
      return "Extracted";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "new":
      return "New";
    default:
      return status;
  }
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const s = Math.round((Date.now() - then) / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function kindLabel(kind: string): string {
  switch (kind) {
    case "digital_pdf":
      return "PDF";
    case "scanned_pdf":
      return "Scanned PDF";
    case "docx":
      return "Word";
    case "xlsx":
      return "Excel";
    case "image":
      return "Image";
    case "text":
      return "Text";
    default:
      return kind;
  }
}

import type { NextConfig } from "next";

// Relay production build (path under NatCat DNS):
//   NEXT_BASE_PATH=/extractor NEXT_PUBLIC_API_BASE=/extractor NEXT_DIST_DIR=.next-relay
// Local `next dev` leaves these unset: UI on :3000, API at 127.0.0.1:8787.
const basePath = process.env.NEXT_BASE_PATH?.trim() || "";
const distDir = process.env.NEXT_DIST_DIR?.trim() || ".next";

const defaultApiBase = basePath
  ? basePath.replace(/\/$/, "")
  : "http://127.0.0.1:8787";

const nextConfig: NextConfig = {
  ...(basePath ? { basePath } : {}),
  distDir,
  // The browser calls the API directly rather than through the rewrite below:
  // the dev proxy turned cancel-then-retry requests into empty 204 replies,
  // and it made API calls share the page's own connection pool. Set
  // NEXT_PUBLIC_API_BASE="" to go back through the proxy (e.g. when the UI is
  // served to other machines, where 127.0.0.1 would be *their* machine).
  // Relay: NEXT_PUBLIC_API_BASE=/extractor → browser hits /extractor/api/...
  env: {
    NEXT_PUBLIC_API_BASE:
      process.env.NEXT_PUBLIC_API_BASE !== undefined
        ? process.env.NEXT_PUBLIC_API_BASE
        : defaultApiBase,
  },
  // The dev-only route badge sits bottom-left, on top of the sidebar's theme switch.
  devIndicators: { appIsrStatus: false, buildActivityPosition: "bottom-right" },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8787/api/:path*",
      },
    ];
  },
};

export default nextConfig;

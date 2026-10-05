import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { BRAND } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description: BRAND.tagline,
};

// Runs before first paint so a saved dark/light choice never flashes the
// other theme. "system" (nothing saved) leaves the attribute off entirely.
const themeScript = `try{var t=localStorage.getItem("theme");if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      {/* Extensions (e.g. ColorZilla's cz-shortcut-listen) stamp attributes on
          <body> before React hydrates; this only silences attribute diffs on
          this one element, not anything inside it. */}
      <body suppressHydrationWarning>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

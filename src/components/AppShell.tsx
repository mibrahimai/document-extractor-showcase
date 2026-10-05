"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api, HealthInfo, ProjectInfo } from "@/lib/api";
import { BRAND } from "@/lib/brand";
import { CommandPalette } from "./CommandPalette";
import { Icon } from "./Icon";
import { Crumb, ShellContext, ToastInput } from "./ShellContext";
import styles from "./AppShell.module.css";

type Theme = "system" | "light" | "dark";
type Toast = ToastInput & { id: number };

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  try {
    if (theme === "system") localStorage.removeItem("theme");
    else localStorage.setItem("theme", theme);
  } catch {
    // storage blocked — theme still applies for this session
  }
}

function effectiveDark(theme: Theme) {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

const PROJECT_NAV = [
  { href: "", label: "Review queue", icon: "inbox", countKey: "needs_review" },
  { href: "/tasks", label: "Procurement tasks", icon: "tasks" },
  { href: "/vendors", label: "Vendors", icon: "users" },
  { href: "/import", label: "Import a folder", icon: "folderIn" },
  { href: "/test", label: "Test a file", icon: "flask" },
  { href: "/settings", label: "Settings", icon: "sliders" },
];

const SUBPAGE_LABEL: Record<string, string> = {
  review: "Review",
  settings: "Settings",
  tasks: "Tasks",
  vendors: "Vendors",
  import: "Import a folder",
  test: "Test a file",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [health, setHealth] = useState<HealthInfo | null | "offline">(null);
  const [theme, setTheme] = useState<Theme>("system");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pageCrumbs, setPageCrumbsState] = useState<{ path: string; crumbs: Crumb[] } | null>(null);
  const toastId = useRef(0);
  const setPageCrumbs = useCallback(
    (path: string, crumbs: Crumb[] | null) => setPageCrumbsState(crumbs ? { path, crumbs } : null),
    []
  );

  const match = pathname.match(/^\/projects\/(\d+)(?:\/([^/]+))?(?:\/([^/]+))?/);
  const activeProjectId = match ? match[1] : null;
  const activeProject = projects.find((p) => String(p.id) === activeProjectId) || null;

  const refreshProjects = useCallback(() => {
    api
      .listProjects()
      .then(setProjects)
      .catch(() => {});
  }, []);

  // Only when the active project changes — refetching every project's counts
  // on each document-to-document step just adds to the request pile-up.
  // Pages that change counts (save, approve, run) call refreshProjects().
  useEffect(() => {
    refreshProjects();
  }, [refreshProjects, activeProjectId]);

  useEffect(() => {
    let alive = true;
    const check = () =>
      api
        .health()
        .then((h) => alive && setHealth(h))
        .catch(() => alive && setHealth("offline"));
    check();
    const t = setInterval(check, 20000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("theme");
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setMobileNav(false);
    setSwitcherOpen(false);
  }, [pathname]);

  const setThemeAndApply = (t: Theme) => {
    setTheme(t);
    applyTheme(t);
  };

  const toggleTheme = () => setThemeAndApply(effectiveDark(theme) ? "light" : "dark");

  const toast = useCallback((t: ToastInput) => {
    const id = ++toastId.current;
    setToasts((list) => [...list, { ...t, id }]);
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), t.action ? 8000 : 4500);
  }, []);

  const crumbs = useMemo(() => {
    const out: { label: string; href?: string }[] = [];
    if (pathname === "/") return [{ label: "Home" }];
    if (pathname.startsWith("/projects")) {
      out.push({ label: "Projects", href: "/projects" });
      if (pathname === "/projects/new") out.push({ label: "New project" });
      if (activeProjectId) {
        out.push({ label: activeProject?.name || "…", href: `/projects/${activeProjectId}` });
        if (pageCrumbs && pageCrumbs.path === pathname) return [...out, ...pageCrumbs.crumbs];
        const sub = match?.[2];
        if (sub && SUBPAGE_LABEL[sub]) {
          out.push({
            label: SUBPAGE_LABEL[sub],
            href: sub === "review" ? undefined : `/projects/${activeProjectId}/${sub}`,
          });
          if (sub === "tasks" && match?.[3]) out.push({ label: `Task #${match[3]}` });
        }
      }
    }
    return out;
  }, [pathname, activeProjectId, activeProject, match, pageCrumbs]);

  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  const llm = health && health !== "offline" ? health.llm : undefined;
  const apiDot = health === "offline" ? "bad" : health ? "ok" : "idle";
  const llmDot = !llm ? "idle" : !llm.reachable ? "bad" : !llm.model_available ? "warn" : "ok";
  const llmText = !llm
    ? "Checking model…"
    : !llm.reachable
      ? `${llm.provider} not reachable`
      : !llm.model_available
        ? `Model missing: ${llm.model}`
        : llm.provider === "ollama"
          ? `${llm.model} ready`
          : `${llm.model} · ${llm.provider}`;

  return (
    <ShellContext.Provider
      value={{ projects, refreshProjects, toast, openPalette: () => setPaletteOpen(true), health, setPageCrumbs }}
    >
      <div className={styles.shell}>
        <aside className={`${styles.sidebar} ${mobileNav ? styles.sidebarOpen : ""}`}>
          <Link href="/" className={styles.brand}>
            <span className={styles.logo}>
              <Icon name="scan" size={18} strokeWidth={2.2} />
            </span>
            <span>
              <span className={styles.brandName}>{BRAND.name}</span>
              <span className={styles.brandSub}>self-hosted · local AI</span>
            </span>
          </Link>

          <button type="button" className={styles.searchBtn} onClick={() => setPaletteOpen(true)}>
            <Icon name="search" size={15} />
            <span>Search or jump to…</span>
            <span className="kbd">Ctrl K</span>
          </button>

          <nav className={styles.nav}>
            <Link href="/" className={`${styles.navItem} ${isActive("/", true) ? styles.navActive : ""}`}>
              <Icon name="home" /> Home
            </Link>
            <Link
              href="/projects"
              className={`${styles.navItem} ${pathname === "/projects" ? styles.navActive : ""}`}
            >
              <Icon name="layers" /> Projects
              <span className={styles.count}>{projects.length || ""}</span>
            </Link>
            <Link
              href="/projects/new"
              className={`${styles.navItem} ${isActive("/projects/new") ? styles.navActive : ""}`}
            >
              <Icon name="plus" /> New project
            </Link>
          </nav>

          {activeProjectId && (
            <div className={styles.projectBlock}>
              <div className={styles.sectionLabel}>Project</div>
              <div className={styles.switcher}>
                <button
                  type="button"
                  className={styles.switcherBtn}
                  onClick={() => setSwitcherOpen((o) => !o)}
                  aria-expanded={switcherOpen}
                >
                  <span className={styles.switcherAvatar}>
                    {(activeProject?.name || "?").slice(0, 1).toUpperCase()}
                  </span>
                  <span className={styles.switcherText}>
                    <span className={styles.switcherName}>{activeProject?.name || "…"}</span>
                    <span className={styles.switcherMeta}>
                      {activeProject ? `${activeProject.doc_count} documents` : ""}
                    </span>
                  </span>
                  <Icon name="chevronDown" size={14} />
                </button>
                {switcherOpen && (
                  <div className={styles.switcherMenu}>
                    {projects.map((p) => (
                      <Link
                        key={p.id}
                        href={`/projects/${p.id}`}
                        className={`${styles.switcherItem} ${String(p.id) === activeProjectId ? styles.switcherItemActive : ""}`}
                      >
                        <span className={styles.switcherAvatarSm}>{p.name.slice(0, 1).toUpperCase()}</span>
                        <span className={styles.switcherItemName}>{p.name}</span>
                        {String(p.id) === activeProjectId && <Icon name="check" size={14} />}
                      </Link>
                    ))}
                    <Link href="/projects/new" className={styles.switcherItem}>
                      <Icon name="plus" size={14} /> New project
                    </Link>
                  </div>
                )}
              </div>
              <nav className={styles.nav}>
                {PROJECT_NAV.map((item) => {
                  const href = `/projects/${activeProjectId}${item.href}`;
                  const active =
                    item.href === ""
                      ? pathname === href || pathname.startsWith(`${href}/review`)
                      : isActive(href);
                  const count = item.countKey ? activeProject?.status_counts?.[item.countKey] : undefined;
                  return (
                    <Link
                      key={item.label}
                      href={href}
                      className={`${styles.navItem} ${active ? styles.navActive : ""}`}
                    >
                      <Icon name={item.icon} /> {item.label}
                      {count ? (
                        <span className={`${styles.count} ${styles.countWarn}`} title="Needs review">
                          {count}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </nav>
            </div>
          )}

          <div className={styles.footer}>
            <div className={styles.statusLine} title="FastAPI backend on port 8787">
              <span className={`${styles.dot} ${styles[`dot_${apiDot}`]}`} />
              {health === "offline" ? "API offline — start uvicorn" : health ? "API online" : "Checking API…"}
            </div>
            <div className={styles.statusLine} title="Local LLM used for triage and extraction">
              <span className={`${styles.dot} ${styles[`dot_${llmDot}`]}`} />
              <span className={styles.statusText}>{llmText}</span>
            </div>
            <div className={styles.themeSwitch} role="radiogroup" aria-label="Theme">
              {(["system", "light", "dark"] as Theme[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={theme === t}
                  title={`${t[0].toUpperCase()}${t.slice(1)} theme`}
                  className={`${styles.themeBtn} ${theme === t ? styles.themeBtnActive : ""}`}
                  onClick={() => setThemeAndApply(t)}
                >
                  <Icon name={t === "system" ? "monitor" : t === "light" ? "sun" : "moon"} size={14} />
                </button>
              ))}
            </div>
          </div>
        </aside>

        {mobileNav && <div className={styles.scrim} onClick={() => setMobileNav(false)} />}

        <div className={styles.main}>
          <header className={styles.topbar}>
            <button
              type="button"
              className={styles.menuBtn}
              onClick={() => setMobileNav(true)}
              aria-label="Open navigation"
            >
              <Icon name="menu" size={18} />
            </button>
            <nav className={styles.crumbs} aria-label="Breadcrumb">
              {crumbs.map((c, i) => (
                <span key={i} className={styles.crumb}>
                  {i > 0 && <Icon name="chevronRight" size={13} className={styles.crumbSep} />}
                  {c.href && i < crumbs.length - 1 ? (
                    <Link href={c.href}>{c.label}</Link>
                  ) : (
                    <span className={styles.crumbCurrent}>{c.label}</span>
                  )}
                </span>
              ))}
            </nav>
            <button type="button" className={styles.topSearch} onClick={() => setPaletteOpen(true)}>
              <Icon name="search" size={15} />
              <span className="kbd">Ctrl K</span>
            </button>
          </header>
          <div className={styles.content}>{children}</div>
        </div>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        projects={projects}
        activeProjectId={activeProjectId}
        onToggleTheme={toggleTheme}
      />

      <div className={styles.toasts} aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`${styles.toast} ${styles[`toast_${t.tone || "info"}`]}`}>
            <Icon
              name={t.tone === "error" ? "alert" : t.tone === "success" ? "check" : "sparkles"}
              size={16}
              className={styles.toastIcon}
            />
            <div className={styles.toastBody}>
              <div className={styles.toastTitle}>{t.title}</div>
              {t.description && <div className={styles.toastDesc}>{t.description}</div>}
            </div>
            {t.action && (
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => {
                  t.action?.onClick();
                  setToasts((list) => list.filter((x) => x.id !== t.id));
                }}
              >
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              className={styles.toastClose}
              aria-label="Dismiss"
              onClick={() => setToasts((list) => list.filter((x) => x.id !== t.id))}
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ShellContext.Provider>
  );
}

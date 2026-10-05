"use client";

import { createContext, useContext } from "react";
import type { HealthInfo, ProjectInfo } from "@/lib/api";

export type ToastTone = "success" | "error" | "info";

export type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
  action?: { label: string; onClick: () => void };
};

export type Crumb = { label: string; href?: string };

export type ShellValue = {
  // A page's own trail after "Projects › <project>", tied to its pathname so a
  // stale trail never shows on another page.
  setPageCrumbs: (path: string, crumbs: Crumb[] | null) => void;
  projects: ProjectInfo[];
  refreshProjects: () => void;
  toast: (t: ToastInput) => void;
  openPalette: () => void;
  health: HealthInfo | null | "offline";
};

export const ShellContext = createContext<ShellValue>({
  setPageCrumbs: () => {},
  projects: [],
  refreshProjects: () => {},
  toast: () => {},
  openPalette: () => {},
  health: null,
});

export function useShell() {
  return useContext(ShellContext);
}

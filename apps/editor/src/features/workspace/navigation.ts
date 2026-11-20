import { useCallback, useEffect, useState } from "react";

export const workspacePages = [
  "home",
  "new",
  "revise",
  "drafts",
  "taxonomy",
  "series",
  "connection",
  "edit",
] as const;
export type WorkspacePage = (typeof workspacePages)[number];

function currentPage(): WorkspacePage {
  const value = window.location.hash.replace(/^#\/?/u, "").split("/")[0];
  return workspacePages.includes(value as WorkspacePage) ? (value as WorkspacePage) : "home";
}

export function useWorkspaceNavigation() {
  const [page, setPage] = useState<WorkspacePage>(currentPage);
  useEffect(() => {
    const update = () => setPage(currentPage());
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  const navigate = useCallback((next: WorkspacePage) => {
    if (currentPage() === next) setPage(next);
    else window.location.hash = "/" + next;
  }, []);
  return { page, navigate };
}

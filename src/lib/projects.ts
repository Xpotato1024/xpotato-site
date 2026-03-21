import type { CollectionEntry } from "astro:content";

export function hasVisibleRepoLink(project: CollectionEntry<"projects">) {
  return Boolean(project.data.repoUrl && project.data.showRepoLink);
}

export function getRepoLinkLabel(repoUrl?: string) {
  if (!repoUrl) {
    return "Repository";
  }

  return repoUrl.includes("github.com") ? "GitHub" : "Repository";
}

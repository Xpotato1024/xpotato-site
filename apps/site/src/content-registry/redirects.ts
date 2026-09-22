import { applicationRedirectRecordSchema } from "@xpotato/content-contracts";

// Application path redirects only. WordPress query identities are provider requirements.
export const applicationRedirects = [
  { id: "legacy-prime-factorizer", sourcePath: "/blog/prime-factorizer/", targetPath: "/tools/prime-factorizer/", contentId: "bca48f98-c89a-457f-84d8-168f941fe469", reason: "content_route_change" },
  { id: "legacy-blog-tools", sourcePath: "/blog/category/tools/", targetPath: "/tools/", reason: "legacy_path" },
  // Legacy display categories do not partition the accepted vNext taxonomy.
  // The Blog union archive preserves access without falsely assigning mixed diary entries.
  { id: "legacy-blog-diary", sourcePath: "/blog/category/diary/", targetPath: "/blog/", reason: "site_structure_change" },
  { id: "legacy-blog-infra", sourcePath: "/blog/category/infra/", targetPath: "/blog/", reason: "site_structure_change" },
  { id: "legacy-blog-network", sourcePath: "/blog/category/network/", targetPath: "/blog/", reason: "site_structure_change" },
  { id: "legacy-tool-calculation", sourcePath: "/tools/category/calculation/", targetPath: "/tools/", reason: "site_structure_change" },
].map((record) => applicationRedirectRecordSchema.parse({ ...record, status: 301, statusLifecycle: "active" }));

export const redirectArtifact = (): string => applicationRedirects
  .filter((record) => record.statusLifecycle === "active")
  .slice().sort((a, b) => a.sourcePath < b.sourcePath ? -1 : 1)
  .map((record) => `${record.sourcePath} ${record.targetPath} ${record.status}\n`).join("");

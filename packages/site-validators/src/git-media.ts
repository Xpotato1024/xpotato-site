import { extname } from "node:path";

const deniedExtensions = new Set([".heic", ".heif", ".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif", ".tif", ".tiff"]);
const allowedRasterControls = [/^apps\/site\/public\/(?:favicon|icon)-[^/]+\.png$/u, /^tests\/fixtures\/synthetic-media\/[^/]+\.png$/u];

export interface GitMediaDecision {
  readonly allowed: boolean;
  readonly reason: string;
}

export const validateGitMediaAddition = (repositoryPath: string): GitMediaDecision => {
  const path = repositoryPath.replaceAll("\\", "/");
  if (path === "apps/site/public/search/search-index.json" || /(?:^|\/)dist\//u.test(path) || path.startsWith(".local/")) {
    return { allowed: false, reason: "generated/private artifact must not be committed" };
  }
  const extension = extname(path).toLowerCase();
  if (!deniedExtensions.has(extension)) return { allowed: true, reason: "not a guarded raster source" };
  if (allowedRasterControls.some((pattern) => pattern.test(path))) return { allowed: true, reason: "explicit synthetic/control raster candidate" };
  return { allowed: false, reason: "raster content media is object-storage first regardless of file size" };
};

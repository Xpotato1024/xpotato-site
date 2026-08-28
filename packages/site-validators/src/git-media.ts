import { extname } from "node:path";

export const FROZEN_LEGACY_BASELINE = "c9535fdad2d2c9c30ea8d7201eb759ede7afa12e";

const deniedExtensions = new Set([".heic", ".heif", ".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif", ".tif", ".tiff"]);
const allowedRasterControls = [
  /^apps\/site\/public\/(?:favicon|icon)-[^/]+\.png$/u,
  /^tests\/fixtures\/synthetic-media\/[^/]+\.png$/u,
];

export type GitChangeKind = "A" | "M" | "D" | "R" | "C";

export interface GitChangedPath {
  readonly kind: GitChangeKind;
  readonly path: string;
  readonly previousPath?: string;
}

export interface GitMediaDecision {
  readonly allowed: boolean;
  readonly reason: string;
}

export interface LegacyRemovalGateEvidence {
  readonly immutableAnnotatedTagVerified: boolean;
  readonly exactInventoryVerified: boolean;
  readonly legacyBuildReproduced: boolean;
  readonly contentParityVerified: boolean;
  readonly mediaParityVerified: boolean;
  readonly routeParityVerified: boolean;
  readonly providerReadinessVerified: boolean;
  readonly recoveryVerified: boolean;
  readonly rollbackVerified: boolean;
}

const normalizePath = (path: string): string => path.replaceAll("\\", "/");

export const validateGitMediaChange = (change: GitChangedPath): GitMediaDecision => {
  const path = normalizePath(change.path);
  if (change.kind === "D") return { allowed: true, reason: "deletion adds no Git media bytes" };
  if (path === "apps/site/public/search/search-index.json" || /(?:^|\/)dist\//u.test(path) || path.startsWith(".local/")) {
    return { allowed: false, reason: "generated/private artifact must not be committed" };
  }
  const extension = extname(path).toLowerCase();
  if (!deniedExtensions.has(extension)) return { allowed: true, reason: "not a guarded raster source" };
  if (allowedRasterControls.some((pattern) => pattern.test(path))) {
    return { allowed: true, reason: "explicit synthetic/control raster candidate" };
  }
  return {
    allowed: false,
    reason: `new/changed raster media is forbidden repository-wide; unchanged legacy bytes are grandfathered only from ${FROZEN_LEGACY_BASELINE}`,
  };
};

export const validateGitMediaAddition = (repositoryPath: string): GitMediaDecision =>
  validateGitMediaChange({ kind: "A", path: repositoryPath });

export const validateLegacyRemoval = (
  change: GitChangedPath,
  evidence?: LegacyRemovalGateEvidence,
): GitMediaDecision => {
  const path = normalizePath(change.path);
  const legacyActivePath =
    path.startsWith("src/") ||
    path.startsWith("public/") ||
    ["astro.config.mjs", "tailwind.config.mjs", "wrangler.jsonc"].includes(path);
  if (change.kind !== "D" || !legacyActivePath) return { allowed: true, reason: "not a legacy active implementation removal" };
  if (
    evidence?.immutableAnnotatedTagVerified &&
    evidence.exactInventoryVerified &&
    evidence.legacyBuildReproduced &&
    evidence.contentParityVerified &&
    evidence.mediaParityVerified &&
    evidence.routeParityVerified &&
    evidence.providerReadinessVerified &&
    evidence.recoveryVerified &&
    evidence.rollbackVerified
  ) {
    return { allowed: true, reason: "legacy preservation, parity, provider, recovery, and rollback prerequisites verified" };
  }
  return {
    allowed: false,
    reason: "legacy removal blocked until preservation, content/media/route parity, provider readiness, recovery, and rollback are verified",
  };
};

export const parseGitNameStatus = (output: string): readonly GitChangedPath[] =>
  output
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => {
      const fields = line.split("\t");
      const status = fields[0] ?? "";
      const kind = status[0] as GitChangeKind;
      if (kind === "R" || kind === "C") {
        if (!fields[1] || !fields[2]) throw new Error(`Invalid git name-status record: ${line}`);
        return { kind, previousPath: normalizePath(fields[1]), path: normalizePath(fields[2]) };
      }
      if (!(["A", "M", "D"] as const).includes(kind as "A" | "M" | "D") || !fields[1]) {
        throw new Error(`Unsupported git name-status record: ${line}`);
      }
      return { kind: kind as "A" | "M" | "D", path: normalizePath(fields[1]) };
    });

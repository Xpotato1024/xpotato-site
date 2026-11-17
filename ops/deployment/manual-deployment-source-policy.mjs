import { stop } from "./manual-deployment-provider.mjs";
// Only the current layout is executable. Historical recovery uses its pinned Git revision.
export const currentGuardPaths = Object.freeze([
  "site-validators/src/repository-cli.ts",
  "site-validators/src/delivery/site-output.ts",
  "site-validators/src/delivery/route-runtime.ts",
  "portable-content/src/publication-holds.mjs",
]);
const order = (a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
function entries(body, code) {
  const rows = body?.tree;
  if (
    body?.truncated !== false ||
    !Array.isArray(rows) ||
    new Set(rows.map((r) => r?.path)).size !== rows.length ||
    rows.some(
      (r) =>
        typeof r?.path !== "string" ||
        !r.path ||
        /[\\\0\r\n]/.test(r.path) ||
        r.path.split("/").some((p) => !p || p === "." || p === "..") ||
        !/^[a-f0-9]{40}$/.test(r.sha) ||
        !(
          (r.type === "tree" && r.mode === "040000") ||
          (r.type === "blob" && ["100644", "100755"].includes(r.mode))
        ),
    )
  )
    stop(code);
  return rows;
}
const signature = (rows) =>
  JSON.stringify(
    rows
      .slice()
      .sort(order)
      .map((r) => [r.path, r.mode, r.type, r.sha]),
  );
const regular = (rows, path) =>
  rows.some((r) => r.path === path && r.type === "blob" && r.mode === "100644");
export function assertPackageSourceParity(trees) {
  if (!Array.isArray(trees) || trees.length !== 2) stop("PACKAGE_SOURCE_INCOMPLETE");
  const rows = trees.map((body) =>
    entries(body, "PACKAGE_SOURCE_INCOMPLETE").filter((r) => r.type !== "tree"),
  );
  for (const list of rows)
    if (!currentGuardPaths.every((path) => regular(list, path)))
      stop("REPOSITORY_GUARD_PATH_OR_MODE");
  if (
    currentGuardPaths.some(
      (path) =>
        rows[0].find((r) => r.path === path).sha !== rows[1].find((r) => r.path === path).sha,
    )
  )
    stop("UNREVIEWED_REPOSITORY_GUARD_CHANGE");
  if (signature(rows[0]) !== signature(rows[1])) stop("PUBLIC_PACKAGE_INPUTS_CHANGED");
  return { repositoryGuard: "UNCHANGED", layout: "current" };
}
const requiredTrees = [
  "apps",
  "packages",
  "content",
  "config",
  "ops",
  "templates",
  "vendor",
  "tests",
  "docs",
  ".github",
  "schemas",
];
const requiredFiles = [
  "package.json",
  "package-lock.json",
  ".node-version",
  ".gitattributes",
  ".gitignore",
  ".nvmrc",
  "tsconfig.base.json",
  "tsconfig.json",
  "vitest.config.ts",
];
const separatelyChecked = new Set(["packages", "ops", "docs", ".agents", "README.md", "AGENTS.md"]);
export function assertBuildSourceParity(trees, layout) {
  if (!Array.isArray(trees) || trees.length !== 2 || layout !== "current")
    stop("SOURCE_TREE_INCOMPLETE");
  const rows = trees.map((tree) => entries({ truncated: false, tree }, "SOURCE_TREE_INCOMPLETE"));
  for (const list of rows) {
    if (list.some((r) => ["tools", "scripts", "src", "public"].includes(r.path)))
      stop("PUBLIC_BUILD_INPUTS_CHANGED");
    for (const path of requiredTrees)
      if (!list.some((r) => r.path === path && r.type === "tree" && r.mode === "040000"))
        stop("PUBLIC_BUILD_INPUTS_CHANGED");
    for (const path of requiredFiles) if (!regular(list, path)) stop("PUBLIC_BUILD_INPUTS_CHANGED");
  }
  const remaining = rows.map((list) => list.filter((r) => !separatelyChecked.has(r.path)));
  if (signature(remaining[0]) !== signature(remaining[1])) stop("PUBLIC_BUILD_INPUTS_CHANGED");
}
const manualFiles = [
  "manual-deployment.mjs",
  "manual-deployment-provider.mjs",
  "manual-deployment-github.mjs",
  "manual-deployment-public.mjs",
  "manual-deployment-process.mjs",
  "manual-deployment-cli.mjs",
  "manual-deployment-readiness.mjs",
  "manual-deployment-workflow-policy.mjs",
  "manual-deployment-source-policy.mjs",
];
export const operationManualControlPaths = Object.freeze([
  ...manualFiles.map((name) => "deployment/" + name),
  "deployment/artifact/Read-ManualArtifactHandoff.ps1",
]);
export function assertOperationSourceParity(trees) {
  if (!Array.isArray(trees) || trees.length !== 2) stop("SCRIPTS_TREE_INCOMPLETE");
  const rows = trees.map((body) =>
    entries(body, "SCRIPTS_TREE_INCOMPLETE").filter((r) => r.type !== "tree"),
  );
  for (const list of rows)
    if (!operationManualControlPaths.every((path) => regular(list, path)))
      stop("MANUAL_CONTROL_PLANE_PATH_OR_MODE");
  const allowed = new Set(operationManualControlPaths),
    protectedRows = rows.map((list) =>
      list.filter((r) => !r.path.endsWith(".test.mjs") && !allowed.has(r.path)),
    );
  if (signature(protectedRows[0]) !== signature(protectedRows[1]))
    stop("BUILD_OR_POLICY_SCRIPTS_CHANGED");
}
export function assertDocumentationSourceParity(trees) {
  if (!Array.isArray(trees) || trees.length !== 2) stop("SOURCE_DOCUMENTS_INCOMPLETE");
  const rows = trees.map((body) => {
    const list = entries(body, "SOURCE_DOCUMENTS_INCOMPLETE");
    if (!regular(list, "operations/current-deployment-status.md"))
      stop("SOURCE_DOCUMENTS_INCOMPLETE");
    return list.filter(
      (r) => r.type !== "tree" && r.path !== "operations/current-deployment-status.md",
    );
  });
  if (signature(rows[0]) !== signature(rows[1])) stop("SOURCE_VALIDATION_DOCUMENTS_CHANGED");
}

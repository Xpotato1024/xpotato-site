from pathlib import Path

path = Path("packages/site-validators/src/phase4-content-migration-cli.ts")
text = path.read_text(encoding="utf-8")

replacements = [
    (
        'import { randomUUID } from "node:crypto";\n',
        'import { execFileSync } from "node:child_process";\nimport { randomUUID } from "node:crypto";\n',
    ),
    (
        '  phase4ContentCandidateManifestSchema,\n  phase4ContentIdentityMapSchema,\n',
        '  phase4ContentCandidateManifestSchema,\n  phase4ContentCandidateSchema,\n  phase4ContentIdentityMapSchema,\n',
    ),
    (
        'const candidateVersion = "legacy-portable-content-candidate-v1" as const;\n',
        'const candidateVersion = "legacy-portable-content-candidate-v1" as const;\nconst existingSameEntityBindings = new Map<string, string>([[\n  "tools:prime-factorizer",\n  "bca48f98-c89a-457f-84d8-168f941fe469",\n]]);\nconst existingSameEntityTargetPaths = new Map<string, string>([[\n  "apps/site/src/content/tools/prime-factorizer.mdx",\n  "tools:prime-factorizer",\n]]);\n',
    ),
    (
        '    vNextContentId: randomUUID(),\n',
        '    vNextContentId: existingSameEntityBindings.get(content.legacyContentId) ?? randomUUID(),\n',
    ),
    (
        '  const existingIds = await currentVNextContentIds();\n  for (const entry of mapping.entries) if (existingIds.has(entry.vNextContentId)) errors.push(`allocated ContentId collides with existing vNext content: ${entry.vNextContentId}`);\n',
        '''  const existingContent = await currentVNextContentRecords();
  for (const entry of mapping.entries) {
    const currentAtTarget = existingContent.byPath.get(entry.targetPath);
    const expectedSameEntity = existingSameEntityBindings.get(entry.legacyContentId);
    if (currentAtTarget) {
      const expectedLegacyId = existingSameEntityTargetPaths.get(entry.targetPath);
      if (expectedLegacyId !== entry.legacyContentId || expectedSameEntity !== currentAtTarget) {
        errors.push(`target path already contains a different vNext entity: ${entry.targetPath}`);
      }
      if (entry.vNextContentId !== currentAtTarget) {
        errors.push(`same-entity migration must reuse current ContentId at ${entry.targetPath}`);
      }
    } else if (expectedSameEntity) {
      errors.push(`expected existing same-entity binding disappeared for ${entry.legacyContentId}`);
    }
    const currentPathForId = existingContent.byId.get(entry.vNextContentId);
    if (currentPathForId && currentPathForId !== entry.targetPath) {
      errors.push(`allocated ContentId collides with another current vNext entity: ${entry.vNextContentId}`);
    }
  }
''',
    ),
    (
        '''const currentVNextContentIds = async (): Promise<Set<string>> => {
  const base = join(repositoryRoot, "apps/site/src/content");
  const files = (await walk(base)).filter((path) => [".md", ".mdx"].includes(extname(path)));
  const ids = new Set<string>();
  for (const path of files) {
    const bytes = await readFile(path);
    const { data } = splitLegacyContentSource(bytes, relative(repositoryRoot, path).replaceAll("\\\\", "/"));
    if (typeof data.id === "string") ids.add(data.id);
  }
  return ids;
};

const readLegacyBlob = (legacyPath: string): Buffer => {
  const { execFileSync } = require("node:child_process") as typeof import("node:child_process");
  return execFileSync("git", ["cat-file", "blob", `${LEGACY_COMMIT}:${legacyPath}`], {
''',
        '''const currentVNextContentRecords = async (): Promise<Readonly<{ byPath: ReadonlyMap<string, string>; byId: ReadonlyMap<string, string> }>> => {
  const base = join(repositoryRoot, "apps/site/src/content");
  const files = (await walk(base)).filter((path) => [".md", ".mdx"].includes(extname(path)));
  const byPath = new Map<string, string>();
  const byId = new Map<string, string>();
  for (const path of files) {
    const repositoryPath = relative(repositoryRoot, path).replaceAll("\\\\", "/");
    const bytes = await readFile(path);
    const { data } = splitLegacyContentSource(bytes, repositoryPath);
    if (typeof data.id !== "string") continue;
    byPath.set(repositoryPath, data.id);
    byId.set(data.id, repositoryPath);
  }
  return { byPath, byId };
};

const readLegacyBlob = (legacyPath: string): Buffer => {
  return execFileSync("git", ["cat-file", "blob", `${LEGACY_COMMIT}:${legacyPath}`], {
''',
    ),
    (
        '    const candidate = phase4ContentCandidateManifestSchema.shape.candidates.element.parse({\n',
        '    const candidate = phase4ContentCandidateSchema.parse({\n',
    ),
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"expected one replacement, found {count}: {old[:120]!r}")
    text = text.replace(old, new)

path.write_text(text, encoding="utf-8", newline="\n")

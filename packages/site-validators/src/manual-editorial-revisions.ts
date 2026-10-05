import { fingerprint, sha256 } from "@xpotato/content-contracts/canonical";
import { parse } from "yaml";
import { manualEditorialRevisionLedgerSchema, pageFrontmatterSchema, type ManualEditorialRevisionLedger } from "@xpotato/content-contracts";

const frontmatter = (source: string): Record<string, unknown> => {
  const match = /^---\n([\s\S]*?)\n---\n/u.exec(source);
  if (!match) throw new Error("Editorial revision requires canonical LF frontmatter");
  return parse(match[1]!) as Record<string, unknown>;
};
const protectedMetadata = (data: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(data).filter(([key]) => !["description", "updatedDate"].includes(key)));
const bindings = (source: string) => [...source.matchAll(/media:[a-z0-9-]+|<Demo\b[^>]*>/gu)].map(match => match[0]);

export const validateManualEditorialRevisions = (
  baseline: ReadonlyMap<string, string>,
  actual: ReadonlyMap<string, string>,
  input: unknown,
): ManualEditorialRevisionLedger => {
  const ledger = manualEditorialRevisionLedgerSchema.parse(input);
  const revisions = new Map(ledger.revisions.map(record => [record.targetPath, record]));
  if (revisions.size !== ledger.revisions.length) throw new Error("Duplicate editorial revision target");
  const created = new Set<string>();
  for (const record of ledger.createdPages) {
    const match = /^apps\/site\/src\/content\/pages\/([^/]+)\.mdx$/u.exec(record.targetPath);
    if (!match || baseline.has(record.targetPath) || created.has(record.targetPath)) throw new Error("Manual page creation must be new and unique");
    created.add(record.targetPath);
    const source = actual.get(record.targetPath);
    if (!source) throw new Error("Manual page creation missing");
    const data = pageFrontmatterSchema.parse(frontmatter(source));
    const content = record.provenance.content;
    if (data.draft || data.id !== record.provenance.contentId || content.route !== `/${match[1]}/` || content.mdxSha256 !== sha256(source) || content.frontmatterSha256 !== fingerprint(data)) throw new Error("Manual page creation identity/content mismatch");
  }
  for (const record of ledger.revisions) {
    if (!/^apps\/site\/src\/content\/(?:pages|projects|tools|notes)\/[^/]+\.mdx$/u.test(record.targetPath)) throw new Error("Editorial revision cannot change Blog, routes, or arbitrary files");
    const before = baseline.get(record.targetPath);
    const after = actual.get(record.targetPath);
    if (!before || !after || before === after) throw new Error(`Editorial revision target missing or unchanged: ${record.targetPath}`);
    if (sha256(before) !== record.beforeMdxSha256) throw new Error("Editorial revision migration baseline mismatch");
    const prior = frontmatter(before);
    const current = frontmatter(after);
    if (fingerprint(protectedMetadata(prior)) !== fingerprint(protectedMetadata(current))) throw new Error("Editorial revision changed identity, publication, taxonomy, or protected metadata");
    if (JSON.stringify(bindings(before)) !== JSON.stringify(bindings(after))) throw new Error("Editorial revision changed media or interactive binding");
    const [, collection, slug] = /content\/([^/]+)\/([^/]+)\.mdx$/u.exec(record.targetPath)!;
    const route = `/${collection === "pages" ? "" : `${collection}/`}${slug}/`;
    if (record.provenance.contentId !== current.id || record.provenance.content.route !== route) throw new Error("Editorial revision ContentId/route mismatch");
    if (record.provenance.content.mdxSha256 !== sha256(after) || record.provenance.content.frontmatterSha256 !== fingerprint(current)) throw new Error("Editorial revision current content hash mismatch");
  }
  for (const [path, source] of baseline) {
    if (!revisions.has(path) && actual.get(path) !== source) throw new Error(`Phase 5 taxonomy materialized content drift: ${path}`);
  }
  return ledger;
};

import { editorialProvenanceRegistrySchema } from "@xpotato/content-contracts";
import { sha256, fingerprint } from "@xpotato/content-contracts/canonical";
import { parse } from "yaml";
export function validateEditorialProvenance(value: unknown, sources: ReadonlyMap<string, string>) {
  const registry = editorialProvenanceRegistrySchema.parse(value);
  for (const row of registry.records) {
    const source = sources.get(row.path);
    if (source === undefined) throw Error("EDITORIAL_SOURCE_MISSING: " + row.path);
    const match = /^---\r?\n([\s\S]*?)\r?\n---/u.exec(source);
    if (!match) throw Error("EDITORIAL_FRONTMATTER_REQUIRED");
    const data = parse(match[1]!);
    if (
      data.id !== row.provenance.contentId ||
      sha256(source) !== row.provenance.content.mdxSha256 ||
      fingerprint(data) !== row.provenance.content.frontmatterSha256
    )
      throw Error("EDITORIAL_PROVENANCE_MISMATCH: " + row.path);
  }
  return registry;
}

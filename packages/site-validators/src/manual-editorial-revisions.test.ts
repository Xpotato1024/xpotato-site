import { describe, expect, it } from "vitest";
import { fingerprint, sha256 } from "@xpotato/content-contracts/canonical";
import { validateManualEditorialRevisions } from "./manual-editorial-revisions.js";

const path = "apps/site/src/content/pages/about.mdx";
const id = "f3f79a24-4d24-449d-907c-f4ced4924b29";
const metadata = { id, title: "About", description: "Original", draft: false };
const before = `---\nid: ${id}\ntitle: About\ndescription: Original\ndraft: false\n---\n\nOriginal body.\n`;
const after = before.replace("Original body.", "Revised body.");
const ledger = () => ({ schemaVersion: 1, baseline: "phase5-taxonomy-materialization-v1", createdPages: [], revisions: [{
  targetPath: path, beforeMdxSha256: sha256(before), summary: "Manual fixed-page revision",
  provenance: { schemaVersion: 1, contentId: id, origin: "manual", content: { mdxSha256: sha256(after), frontmatterSha256: fingerprint(metadata), route: "/about/" }, sourceRefs: [], materialClaims: [], exportedAt: "2026-10-05T00:00:00Z" },
}] });
const check = (current = after, input: unknown = ledger(), baselinePath = path) =>
  validateManualEditorialRevisions(new Map([[baselinePath, before]]), new Map([[baselinePath, current]]), input);

describe("manual fixed-page revisions over immutable migration evidence", () => {
  it("accepts a bound manual revision and continues exact checks for unchanged files", () => {
    expect(check().revisions).toHaveLength(1);
    expect(check(before, { ...ledger(), revisions: [] }).revisions).toHaveLength(0);
  });
  it("rejects unrecorded edits, missing files, duplicate records, and unchanged revisions", () => {
    expect(() => check(after, { ...ledger(), revisions: [] })).toThrow("drift");
    expect(() => validateManualEditorialRevisions(new Map([[path, before]]), new Map(), ledger())).toThrow("missing");
    const input = ledger(); input.revisions.push(input.revisions[0]!);
    expect(() => check(after, input)).toThrow("Duplicate");
    expect(() => check(before)).toThrow("unchanged");
  });
  it("rejects a rewritten baseline or current hash", () => {
    const input = ledger(); input.revisions[0]!.beforeMdxSha256 = "0".repeat(64);
    expect(() => check(after, input)).toThrow("baseline");
    expect(() => check(after + "tamper")).toThrow("hash");
  });
  it.each(["id", "draft", "title", "tags", "seo"])("rejects protected %s metadata changes", key => {
    const current = key === "id" ? after.replace(id, "325e1e0e-acd3-469f-a27d-476cf84b48fc") : key === "title" ? after.replace("title: About", "title: Changed") : after.replace("draft: false", key === "draft" ? "draft: true" : `draft: false\n${key}: changed`);
    expect(() => check(current)).toThrow("protected metadata");
  });
  it("rejects Blog edits even with a matching hash", () => {
    const input = ledger(); const blog = path.replace("pages/about", "blog/article"); input.revisions[0]!.targetPath = blog;
    expect(() => check(after, input, blog)).toThrow("cannot change Blog");
  });
  it("rejects route changes and new interactive/media bindings", () => {
    const input = ledger(); input.revisions[0]!.provenance.content.route = "/renamed/";
    expect(() => check(after, input)).toThrow("route");
    expect(() => check(after + '<Demo module="new-module" />')).toThrow("binding");
    expect(() => check(after + "media:new-asset")).toThrow("binding");
  });
  it("binds a new manual Page and rejects tampering or pretending an existing entry is new", () => {
    const newPath = "apps/site/src/content/pages/education.mdx";
    const record = ledger().revisions[0]!.provenance;
    const created = { targetPath: newPath, provenance: { ...record, content: { ...record.content, route: "/education/" } } };
    const input = { ...ledger(), revisions: [], createdPages: [created] };
    const baseline = new Map([[path, before]]);
    const actual = new Map([[path, before], [newPath, after]]);
    expect(validateManualEditorialRevisions(baseline, actual, input).createdPages).toHaveLength(1);
    actual.set(newPath, after + "tamper");
    expect(() => validateManualEditorialRevisions(baseline, actual, input)).toThrow("mismatch");
    expect(() => check(after, { ...input, createdPages: [{ ...created, targetPath: path }] })).toThrow("new and unique");
  });
});

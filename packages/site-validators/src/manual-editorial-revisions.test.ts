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
  const titledRevision = () => {
    const current = after.replace("title: About", "title: About this site");
    const input = { ...ledger(), revisions: [{ ...ledger().revisions[0]!, titleRevision: { before: "About", after: "About this site" } }] };
    input.revisions[0]!.provenance.content = { ...input.revisions[0]!.provenance.content, mdxSha256: sha256(current), frontmatterSha256: fingerprint({ ...metadata, title: "About this site" }) };
    return { current, input };
  };
  it("accepts an explicit title revision bound to baseline, current title and content hashes", () => {
    const { current, input } = titledRevision();
    expect(check(current, input).revisions[0]!.titleRevision).toEqual({ before: "About", after: "About this site" });
    expect(() => check(current + "tamper", input)).toThrow("hash");
    const wrongHash = titledRevision(); wrongHash.input.revisions[0]!.provenance.content.frontmatterSha256 = "0".repeat(64);
    expect(() => check(wrongHash.current, wrongHash.input)).toThrow("hash");
  });
  it.each(["before", "after"] as const)("rejects a mismatched %s title in the revision record", key => {
    const { current, input } = titledRevision(); input.revisions[0]!.titleRevision[key] = "Another title";
    expect(() => check(current, input)).toThrow("title revision does not match");
  });
  it("rejects an unchanged title record and unknown metadata authorizations", () => {
    const same = titledRevision(); same.input.revisions[0]!.titleRevision.after = "About";
    expect(() => check(same.current, same.input)).toThrow("must change the title");
    const { current, input } = titledRevision();
    expect(() => check(current, { ...input, revisions: [{ ...input.revisions[0], titleRevision: { ...input.revisions[0]!.titleRevision, draft: false } }] })).toThrow();
  });
  it.each(["id", "draft", "pubDate", "tags", "seo"])("keeps %s protected with an explicit title revision", key => {
    const { current, input } = titledRevision();
    const changed = key === "id" ? current.replace(id, "325e1e0e-acd3-469f-a27d-476cf84b48fc") : current.replace("draft: false", key === "draft" ? "draft: true" : `draft: false\n${key}: changed`);
    expect(() => check(changed, input)).toThrow("protected metadata");
  });
  it("keeps route, identity and interactive bindings checked with a title revision", () => {
    const { current, input } = titledRevision();
    expect(() => check(current + '<Demo module="new-module" />', input)).toThrow("binding");
    const wrongIdentity = titledRevision(); wrongIdentity.input.revisions[0]!.provenance.contentId = "325e1e0e-acd3-469f-a27d-476cf84b48fc";
    expect(() => check(wrongIdentity.current, wrongIdentity.input)).toThrow("ContentId/route");
    const wrongRoute = titledRevision(); wrongRoute.input.revisions[0]!.provenance.content.route = "/renamed/";
    expect(() => check(wrongRoute.current, wrongRoute.input)).toThrow("ContentId/route");
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

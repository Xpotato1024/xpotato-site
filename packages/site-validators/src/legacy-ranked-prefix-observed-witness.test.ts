import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LEGACY_COMMIT, splitLegacyContentSource } from "./legacy-inventory.js";
import {
  proveRankedPrefixBoundaryTie,
  type RankedPrefixRecord,
} from "./legacy-ranked-prefix-equivalence.js";

interface ObservedWitness {
  readonly schemaVersion: 1;
  readonly provenance: Readonly<{
    workflowRunId: number;
    artifactId: number;
    frozenCommit: string;
    path: string;
  }>;
  readonly build1: Readonly<{
    selected: readonly string[];
    materials: Readonly<Record<string, string>>;
  }>;
  readonly build2: Readonly<{
    selected: readonly string[];
    materials: Readonly<Record<string, string>>;
  }>;
}

const fixtureUrl = new URL("../../../tests/fixtures/migration/legacy-adr0031-observed-boundary-witness.json", import.meta.url);
const witness = JSON.parse(readFileSync(fixtureUrl, "utf8")) as ObservedWitness;
const toMaterials = (value: Readonly<Record<string, string>>): ReadonlyMap<string, string> => new Map(Object.entries(value));
const rawStringValues = (value: unknown): readonly string[] => typeof value === "string" && value.length > 0
  ? [value]
  : Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
const gitBuffer = (args: readonly string[]): Buffer => execFileSync("git", ["-c", "core.quotepath=false", ...args], {
  encoding: "buffer",
  maxBuffer: 128 * 1024 * 1024,
});

const buildExactFrozenBlogCatalog = (): ReadonlyMap<string, RankedPrefixRecord> => {
  const paths = gitBuffer(["ls-tree", "-r", "-z", "--name-only", LEGACY_COMMIT, "--", "src/content/blog"])
    .toString("utf8")
    .split("\0")
    .filter((path) => /^src\/content\/blog\/.+\.mdx?$/u.test(path))
    .sort();
  const records = new Map<string, RankedPrefixRecord>();
  for (const path of paths) {
    const match = /^src\/content\/blog\/(.+)\.mdx?$/u.exec(path);
    if (!match?.[1]) continue;
    const { data } = splitLegacyContentSource(gitBuffer(["cat-file", "blob", `${LEGACY_COMMIT}:${path}`]), path);
    const pubDate = data.pubDate;
    const pubDateMs = pubDate instanceof Date ? pubDate.getTime() : new Date(String(pubDate ?? "")).getTime();
    const title = data.title;
    if (!Number.isFinite(pubDateMs) || typeof title !== "string" || title.length === 0) throw new Error(`Invalid frozen Blog ranking source: ${path}`);
    const route = `/blog/${match[1]}/`;
    const description = typeof data.description === "string" ? data.description : undefined;
    const category = typeof data.category === "string" ? data.category : undefined;
    records.set(route, {
      route,
      collection: "blog",
      title,
      pubDateMs,
      tags: rawStringValues(data.tags),
      draft: data.draft === true,
      ...(description !== undefined ? { description } : {}),
      ...(category !== undefined ? { category } : {}),
    });
  }
  return records;
};

describe("ADR-0031 observed PR #49 failure witness", () => {
  it("proves the actual failed related-post boundary pair against the complete frozen Blog universe", () => {
    expect(witness.schemaVersion).toBe(1);
    expect(witness.provenance).toMatchObject({
      workflowRunId: 33794765738,
      artifactId: 9908740089,
      frozenCommit: LEGACY_COMMIT,
      path: "blog/2025-10-06/index.html",
    });

    const catalog = buildExactFrozenBlogCatalog();
    expect(catalog.size).toBe(44);
    const current = catalog.get("/blog/2025-10-06/");
    expect(current).toBeDefined();
    const proof = proveRankedPrefixBoundaryTie({
      path: witness.provenance.path,
      regionKey: "/html[0]/body[1]/main[2]/div[0]/section[1]/div[3]",
      kind: "related",
      current: current!,
      firstIdentities: witness.build1.selected,
      secondIdentities: witness.build2.selected,
      firstMaterials: toMaterials(witness.build1.materials),
      secondMaterials: toMaterials(witness.build2.materials),
      gaps: ["", " ", " ", ""],
      catalog,
    });

    expect(proof).toBeDefined();
    expect(proof?.evidence.strictPrefixIdentities).toEqual([
      "/blog/codex-sqlite-write-amplification-mitigation/",
    ]);
    expect(proof?.evidence.boundaryCandidateIdentities).toContain("/blog/gale-adaptive-conservative-planner/");
    expect(proof?.evidence.boundaryCandidateIdentities).toContain("/blog/gale-adaptive-multi-run-review/");
    expect(proof?.evidence.boundaryCandidateIdentities).toContain("/blog/gale-adaptive-review-checklist/");
    expect(proof?.evidence.selectedFromBoundaryCount).toBe(2);
    expect(proof?.evidence.membershipDeltaIdentities).toEqual([
      "/blog/gale-adaptive-multi-run-review/",
      "/blog/gale-adaptive-review-checklist/",
    ]);
  });
});

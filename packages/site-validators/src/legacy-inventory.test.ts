import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { MigrationInventory } from "@xpotato/content-contracts";
import {
  LEGACY_COMMIT,
  LEGACY_HASH_RULE_VERSION,
  LEGACY_INVENTORY_GENERATOR_VERSION,
  LEGACY_REPOSITORY,
  LEGACY_TAG,
  computeInventoryPayloadSha256,
  extractLegacyMediaLocators,
  validateMigrationInventoryInvariants,
  verifyLegacyTagIdentity,
} from "./legacy-inventory.js";

const hash = (character: string): string => character.repeat(64);

const createInventory = (): MigrationInventory => {
  const withoutDigest: Omit<MigrationInventory, "inventoryPayloadSha256"> = {
    schemaVersion: 1,
    hashRuleVersion: LEGACY_HASH_RULE_VERSION,
    snapshot: {
      repository: LEGACY_REPOSITORY,
      commitSha: LEGACY_COMMIT,
      tag: LEGACY_TAG,
      generatedAt: "2026-08-28T00:00:00.000Z",
      generatorVersion: LEGACY_INVENTORY_GENERATOR_VERSION,
    },
    content: [{
      collection: "blog",
      legacyPath: "src/content/blog/a.mdx",
      legacyContentId: "blog:a",
      title: "A",
      draft: false,
      bodySha256: hash("a"),
      frontmatterSha256: hash("b"),
      referencedMediaPaths: ["/wp-content/a.png"],
      referencedInteractiveComponents: ["src/components/A.tsx"],
    }],
    contentMappings: [],
    routes: [{ urlPath: "/blog/a/", sourceKind: "content" }],
    routeParity: [],
    media: [{
      verificationStatus: "git_verified",
      legacyPath: "public/wp-content/a.png",
      sourceFileSha256: hash("c"),
      sizeBytes: 1,
      detectedFormat: "png",
      referencedByContentIds: ["blog:a"],
      likelyOrigin: "wordpress",
    }],
    mediaMappings: [],
    taxonomy: [{
      namespace: "tag",
      rawValue: "TypeScript",
      normalizedValue: "typescript",
      usageCount: 1,
      contentIds: ["blog:a"],
    }],
    interactive: [{
      componentPath: "src/components/A.tsx",
      usedByContentIds: ["blog:a"],
      framework: "React",
      hydrationDirective: "client:visible",
    }],
    legacyHtml: [{
      contentId: "blog:a",
      extractionStatus: "static",
      rawHtmlSha256: hash("d"),
      disposition: "manual_review",
    }],
  };
  return { ...withoutDigest, inventoryPayloadSha256: computeInventoryPayloadSha256(withoutDigest) };
};

describe("legacy inventory payload identity", () => {
  it("ignores generatedAt and record insertion order", () => {
    const first = createInventory();
    first.content.push({
      ...first.content[0]!,
      legacyPath: "src/content/blog/b.mdx",
      legacyContentId: "blog:b",
      title: "B",
      referencedMediaPaths: [],
      referencedInteractiveComponents: [],
    });
    first.routes.push({ urlPath: "/blog/b/", sourceKind: "content" });
    first.inventoryPayloadSha256 = computeInventoryPayloadSha256(first);
    const second = structuredClone(first);
    second.snapshot.generatedAt = "2030-01-01T00:00:00.000Z";
    second.content.reverse();
    second.routes.reverse();
    second.media.reverse();
    second.taxonomy.reverse();
    second.interactive.reverse();
    second.legacyHtml.reverse();
    expect(computeInventoryPayloadSha256(second)).toBe(first.inventoryPayloadSha256);
  });

  it("changes when meaningful source identity changes", () => {
    const first = createInventory();
    const changed = structuredClone(first);
    changed.content[0]!.bodySha256 = hash("e");
    expect(computeInventoryPayloadSha256(changed)).not.toBe(first.inventoryPayloadSha256);
  });

  it("preserves r2 and WordPress locators exactly", () => {
    const source = Buffer.from(`---\ntitle: Test\nheroImage: "r2:/blog/my-first-post/GDCH3152.JPG"\n---\n\nimport LegacyHtml from "../../components/ui/LegacyHtml.astro";\n\n<LegacyHtml html={"<p><img src=\\"/wp-content/uploads/2025/09/img_7.jpg\\" /></p>"} />\n`, "utf8");
    expect(extractLegacyMediaLocators(source, "src/content/blog/test.mdx")).toEqual([
      "/wp-content/uploads/2025/09/img_7.jpg",
      "r2:/blog/my-first-post/GDCH3152.JPG",
    ]);
  });
});

describe("legacy inventory cross-record invariants", () => {
  it("rejects duplicate LegacyContentId", () => {
    const inventory = createInventory();
    inventory.content.push({ ...inventory.content[0]!, legacyPath: "src/content/blog/b.mdx" });
    inventory.inventoryPayloadSha256 = computeInventoryPayloadSha256(inventory);
    expect(validateMigrationInventoryInvariants(inventory)).toContain("duplicate LegacyContentId: blog:a");
  });

  it("rejects duplicate routes and media records", () => {
    const inventory = createInventory();
    inventory.routes.push({ ...inventory.routes[0]! });
    inventory.media.push({ ...inventory.media[0]! });
    inventory.inventoryPayloadSha256 = computeInventoryPayloadSha256(inventory);
    const errors = validateMigrationInventoryInvariants(inventory).join("\n");
    expect(errors).toContain("duplicate route: /blog/a/");
    expect(errors).toContain("duplicate media path: public/wp-content/a.png");
  });

  it("rejects broken media content references", () => {
    const inventory = createInventory();
    inventory.media[0]!.referencedByContentIds = ["blog:missing"];
    inventory.inventoryPayloadSha256 = computeInventoryPayloadSha256(inventory);
    expect(validateMigrationInventoryInvariants(inventory).join("\n")).toContain("references missing content blog:missing");
  });

  it("rejects taxonomy count mismatch", () => {
    const inventory = createInventory();
    inventory.taxonomy[0]!.usageCount = 2;
    inventory.inventoryPayloadSha256 = computeInventoryPayloadSha256(inventory);
    expect(validateMigrationInventoryInvariants(inventory).join("\n")).toContain("usageCount 2 != 1");
  });

  it("rejects dangling interactive references", () => {
    const inventory = createInventory();
    inventory.interactive[0]!.usedByContentIds = ["blog:missing"];
    inventory.inventoryPayloadSha256 = computeInventoryPayloadSha256(inventory);
    expect(validateMigrationInventoryInvariants(inventory).join("\n")).toContain("references missing content blog:missing");
  });

  it("rejects dangling LegacyHtml references", () => {
    const inventory = createInventory();
    inventory.legacyHtml[0]!.contentId = "blog:missing";
    inventory.inventoryPayloadSha256 = computeInventoryPayloadSha256(inventory);
    expect(validateMigrationInventoryInvariants(inventory).join("\n")).toContain("LegacyHtml references missing content blog:missing");
  });
});

const git = (repository: string, args: readonly string[]): string =>
  execFileSync("git", args, { cwd: repository, encoding: "utf8" }).trim();

const createTagRepository = (): Readonly<{ repository: string; first: string; second: string; tagObject: string }> => {
  const repository = mkdtempSync(join(tmpdir(), "xpotato-tag-test-"));
  git(repository, ["init"]);
  git(repository, ["config", "user.name", "Test"]);
  git(repository, ["config", "user.email", "test@example.invalid"]);
  writeFileSync(join(repository, "fixture.txt"), "first\n", "utf8");
  git(repository, ["add", "fixture.txt"]);
  git(repository, ["commit", "-m", "first"]);
  const first = git(repository, ["rev-parse", "HEAD"]);
  git(repository, ["tag", "-a", LEGACY_TAG, first, "-m", "freeze"]);
  const tagObject = git(repository, ["rev-parse", `refs/tags/${LEGACY_TAG}`]);
  writeFileSync(join(repository, "fixture.txt"), "second\n", "utf8");
  git(repository, ["add", "fixture.txt"]);
  git(repository, ["commit", "-m", "second"]);
  const second = git(repository, ["rev-parse", "HEAD"]);
  return { repository, first, second, tagObject };
};

describe("legacy annotated tag identity", () => {
  it("accepts the exact annotated tag object and commit", () => {
    const fixture = createTagRepository();
    try {
      expect(verifyLegacyTagIdentity(fixture.repository, {
        tag: LEGACY_TAG,
        tagObjectSha: fixture.tagObject,
        commitSha: fixture.first,
      })).toEqual([]);
    } finally {
      rmSync(fixture.repository, { recursive: true, force: true });
    }
  });

  it("rejects a lightweight replacement", () => {
    const fixture = createTagRepository();
    try {
      git(fixture.repository, ["tag", "-d", LEGACY_TAG]);
      git(fixture.repository, ["tag", LEGACY_TAG, fixture.first]);
      expect(verifyLegacyTagIdentity(fixture.repository, {
        tag: LEGACY_TAG,
        tagObjectSha: fixture.tagObject,
        commitSha: fixture.first,
      }).join("\n")).toContain("must be annotated");
    } finally {
      rmSync(fixture.repository, { recursive: true, force: true });
    }
  });

  it("rejects a moved/replaced tag", () => {
    const fixture = createTagRepository();
    try {
      git(fixture.repository, ["tag", "-f", "-a", LEGACY_TAG, fixture.second, "-m", "moved"]);
      const errors = verifyLegacyTagIdentity(fixture.repository, {
        tag: LEGACY_TAG,
        tagObjectSha: fixture.tagObject,
        commitSha: fixture.first,
      }).join("\n");
      expect(errors).toContain("tag object mismatch");
      expect(errors).toContain("peeled commit mismatch");
    } finally {
      rmSync(fixture.repository, { recursive: true, force: true });
    }
  });

  it("rejects an annotated tag at the wrong legacy commit", () => {
    const fixture = createTagRepository();
    try {
      git(fixture.repository, ["tag", "-f", "-a", LEGACY_TAG, fixture.second, "-m", "wrong"]);
      const wrongObject = git(fixture.repository, ["rev-parse", `refs/tags/${LEGACY_TAG}`]);
      expect(verifyLegacyTagIdentity(fixture.repository, {
        tag: LEGACY_TAG,
        tagObjectSha: wrongObject,
        commitSha: fixture.first,
      }).join("\n")).toContain("peeled commit mismatch");
    } finally {
      rmSync(fixture.repository, { recursive: true, force: true });
    }
  });
});

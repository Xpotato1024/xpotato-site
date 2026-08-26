import { describe, expect, it } from "vitest";
import {
  articleJobSpecSchema,
  blogFrontmatterSchema,
  contentMediaRegistrySchema,
  contentIdSchema,
  generatedSchemaRegistry,
  mediaObjectRefSchema,
  mediaRightsRecordSchema,
  publicationProvenanceRecordSchema,
  semanticContentModulePropsSchemas,
} from "./index.js";

const contentId = "f8a847d4-8f5d-4bb0-a387-750f096479f2";
const hash = "a".repeat(64);

describe("frozen content contracts", () => {
  it("accepts only canonical lowercase UUIDv4 ContentIds", () => {
    expect(contentIdSchema.parse(contentId)).toBe(contentId);
    expect(() => contentIdSchema.parse(contentId.toUpperCase())).toThrow();
    expect(() => contentIdSchema.parse("f8a847d4-8f5d-1bb0-a387-750f096479f2")).toThrow();
  });

  it("rejects an updatedDate before pubDate", () => {
    expect(() =>
      blogFrontmatterSchema.parse({
        id: contentId,
        title: "fixture",
        description: "fixture",
        pubDate: "2026-08-26",
        updatedDate: "2026-08-25",
        category: "software",
        tags: [],
        draft: false,
      }),
    ).toThrow();
  });

  it("keeps create and update Article Job fields distinct", () => {
    const base = {
      schemaVersion: 1 as const,
      jobId: "job-1",
      operation: "create" as const,
      target: {
        collection: "blog" as const,
        contentId,
        existingContentId: contentId,
        workingTitle: "fixture",
        articleMode: "explanation" as const,
      },
      reader: { outcome: "understand", assumedKnowledge: [], language: "ja" as const },
      inputs: { userNotes: [], repositoryRefs: [], localSourceRefs: [], seedUrls: [], sourceDiscoveryQueries: [] },
      externalAiDisclosure: { policy: { policyId: "article-external-ai-disclosure-v1", policySha256: hash }, explicitAuthorizations: [] },
      constraints: { requiredClaims: [], forbiddenClaims: [], requiredSections: [], forbiddenPublicationPatterns: [] },
      taxonomyHints: { tagIds: [] },
      media: { suppliedMediaRefs: [], heroPreference: "auto" as const, requiredInlineVisuals: [] },
      permissions: {
        networkAccess: false,
        externalTextAI: false,
        externalImageAI: false,
        localMediaProcessing: true,
        privateCanonicalMediaStorage: false,
        publicMediaUpload: false,
        protectedMediaOperation: false,
        repositoryExport: false,
      },
    };
    expect(() => articleJobSpecSchema.parse(base)).toThrow(/create job/);
  });

  it("never authorizes unknown media rights", () => {
    expect(() =>
      mediaRightsRecordSchema.parse({
        schemaVersion: 1,
        rightsId: "rights-1",
        basis: "unknown",
        publicationAuthorized: true,
        confirmedBy: "user",
        confirmedAt: "2026-08-26T00:00:00Z",
      }),
    ).toThrow();
  });

  it("registers the milestone machine schemas", () => {
    expect(Object.keys(generatedSchemaRegistry).length).toBeGreaterThanOrEqual(30);
  });

  it("binds public media object keys to the exact content hash", () => {
    expect(() =>
      mediaObjectRefSchema.parse({
        sha256: hash,
        objectKey: `media/v1/objects/sha256/bb/${"b".repeat(64)}.webp`,
        format: "webp",
        sizeBytes: 1,
      }),
    ).toThrow(/exact content SHA/);
  });

  it("rejects duplicate semantic media IDs", () => {
    const object = { sha256: hash, objectKey: `media/v1/objects/sha256/aa/${hash}.webp`, format: "webp" as const, sizeBytes: 1 };
    const asset = {
      assetId: "hero-1",
      role: "hero" as const,
      origin: "deterministic_cover" as const,
      delivery: { mode: "fixed" as const, master: object, variants: [] },
      provenanceRef: "provenance-1",
      rightsRef: "rights-1",
      status: "active" as const,
    };
    expect(() => contentMediaRegistrySchema.parse({ schemaVersion: 1, contentId, assets: [asset, asset] })).toThrow(/unique/);
  });

  it("requires cleanup-safe Article Job provenance lineage", () => {
    expect(() =>
      publicationProvenanceRecordSchema.parse({
        schemaVersion: 1,
        contentId,
        origin: "article_job",
        content: { mdxSha256: hash, frontmatterSha256: hash, route: "/fixture/" },
        sourceRefs: [],
        materialClaims: [],
        exportedAt: "2026-08-26T00:00:00Z",
      }),
    ).toThrow(/lineage/);
  });

  it("uses the frozen semantic content-module prop names", () => {
    expect(semanticContentModulePropsSchemas.Figure.parse({ asset: "hero", alt: "説明" })).toEqual({ asset: "hero", alt: "説明" });
    expect(() => semanticContentModulePropsSchemas.Figure.parse({ assetId: "hero", alt: "説明" })).toThrow();
    expect(semanticContentModulePropsSchemas.Demo.parse({ module: "prime-factorizer" })).toEqual({ module: "prime-factorizer" });
    expect(() => semanticContentModulePropsSchemas.Demo.parse({ moduleId: "prime-factorizer" })).toThrow();
    expect(() => semanticContentModulePropsSchemas.Callout.parse({ title: "missing kind" })).toThrow();
    expect(semanticContentModulePropsSchemas.Comparison.parse({ leftLabel: "左", rightLabel: "右" })).toBeDefined();
  });
});

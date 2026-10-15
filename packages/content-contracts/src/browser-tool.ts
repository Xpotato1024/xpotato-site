import { z } from "zod";

const id = z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u);
export const browserToolHashSchema = z.string().regex(/^[a-f0-9]{64}$/u);
export const browserToolPathSchema = z.string().min(1).max(180).regex(/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/u)
  .refine(value => value.split("/").every(part => part !== "" && part !== "." && part !== "..")
    && !value.includes(":") && !value.endsWith(".map"), "Unsafe distributed path");
const file = z.object({ path: browserToolPathSchema, bytes: z.number().int().nonnegative().max(2_000_000), sha256: browserToolHashSchema }).strict();
export const browserToolManifestSchema = z.object({
  schemaVersion: z.literal(1), toolId: id, version: z.string().regex(/^\d+\.\d+\.\d+$/u),
  integration: z.object({ kind: z.literal("react-island"), apiVersion: z.literal(1), entry: browserToolPathSchema,
    styles: z.array(browserToolPathSchema).max(4) }).strict(),
  runtime: z.object({ network: z.literal("none-after-ready"), storage: z.literal("memory"),
    capabilities: z.object({ fileInput: z.literal(false), download: z.literal(false), clipboard: z.literal(false),
      worker: z.literal(false), wasm: z.literal(false) }).strict(),
    maxInputBytes: z.number().int().positive().max(65_536), maxOutputBytes: z.number().int().positive().max(262_144),
    maxComputeMs: z.number().int().positive().max(100) }).strict(),
  license: z.object({ spdx: z.enum(["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC"]),
    file: browserToolPathSchema, notice: browserToolPathSchema }).strict(),
  files: z.array(file).min(4).max(100),
}).strict();
const source = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("github"), repository: z.string().regex(/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u) }).strict(),
  z.object({ kind: z.literal("local-fixture"), name: z.literal("synthetic-browser-tool") }).strict(),
]);
export const browserToolReviewSchema = z.object({
  schemaVersion: z.literal(1), source, sourceCommit: z.string().regex(/^[a-f0-9]{40}$/u),
  sourceTreeSha256: browserToolHashSchema, lockSha256: browserToolHashSchema,
  manifestSha256: browserToolHashSchema, artifactSha256: browserToolHashSchema,
  reproducibleArtifactSha256: z.tuple([browserToolHashSchema,browserToolHashSchema]),
  review: z.object({ reviewer: z.string().min(1), scope: z.enum(["fixture-only", "source-and-release"]),
    decision: z.literal("admit") }).strict(),
}).strict();
export const browserToolPinSchema = z.object({
  schemaVersion: z.literal(1), toolId: id, releaseId: id, packageName: z.string().regex(/^@xpotato-tool\/[a-z][a-z0-9-]*$/u),
  source, sourceCommit: z.string().regex(/^[a-f0-9]{40}$/u), sourceTreeSha256: browserToolHashSchema,
  lockSha256: browserToolHashSchema, manifestSha256: browserToolHashSchema, artifactSha256: browserToolHashSchema,
  reviewSha256: browserToolHashSchema,
}).strict();
export type BrowserToolManifest = z.infer<typeof browserToolManifestSchema>;
export type BrowserToolReview = z.infer<typeof browserToolReviewSchema>;
export type BrowserToolPin = z.infer<typeof browserToolPinSchema>;

import { z } from "zod";

const reserved = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu;
const id = z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u).refine(value=>!reserved.test(value),"Reserved path name");
export const browserToolHashSchema = z.string().regex(/^[a-f0-9]{64}$/u);
export const browserToolPathSchema = z.string().min(1).max(180).regex(/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/u)
  .refine(value => value.split("/").every(part => part !== "" && part !== "." && part !== ".." && !part.endsWith(".") && !reserved.test(part))
    && !value.includes(":") && !value.endsWith(".map"), "Unsafe distributed path");
const file = z.object({ path: browserToolPathSchema, bytes: z.number().int().nonnegative().max(2_000_000), sha256: browserToolHashSchema }).strict();
// Authoring tools import these values; a generated source snapshot is never a second authority.
export const browserToolReactPeers = Object.freeze({react:"19.2.8","react-dom":"19.2.8"});
export const browserToolAuthoringToolchain = Object.freeze({node:"24.22.1",npm:"11.19.0"});
export const browserToolSyncDefaults = Object.freeze({network:"none-after-ready",storage:"memory",
 capabilities:{fileInput:false,download:false,clipboard:false,worker:false,wasm:false},
 maxInputBytes:4096,maxOutputBytes:8192,maxComputeMs:50} as const);
export const browserToolThemeProperties = Object.freeze(["--bt-text","--bt-muted","--bt-surface","--bt-border","--bt-accent","--bt-on-accent","--bt-danger","--bt-focus"] as const);
const simpleRuntime = z.object({ network:z.literal("none-after-ready"),storage:z.literal("memory"),
 capabilities:z.object({fileInput:z.literal(false),download:z.literal(false),clipboard:z.literal(false),worker:z.literal(false),wasm:z.literal(false)}).strict(),
 maxInputBytes:z.number().int().positive().max(65_536),maxOutputBytes:z.number().int().positive().max(262_144),maxComputeMs:z.number().int().positive().max(100)}).strict();
const primeRuntime = z.object({profile:z.literal("prime-factorizer-async-v1"),network:z.literal("none-after-ready"),storage:z.literal("memory"),
 capabilities:z.object({fileInput:z.literal(false),download:z.literal(false),clipboard:z.literal(false),worker:z.literal(true),wasm:z.literal(true)}).strict(),
 maxInputBytes:z.literal(16384),maxOutputBytes:z.literal(262144),maxComputeMs:z.literal(100),jobMaxMs:z.literal(3600000),
 maxWorkers:z.literal(6),maxWasmBytes:z.literal(1610612736),maxTransportBytes:z.literal(67108864)}).strict();
const manifestFields = z.object({
 schemaVersion:z.literal(1),toolId:id,version:z.string().regex(/^\d+\.\d+\.\d+$/u),
 integration:z.object({kind:z.literal("react-island"),apiVersion:z.literal(1),entry:browserToolPathSchema,styles:z.array(browserToolPathSchema).max(4)}).strict(),
 runtime:z.union([simpleRuntime,primeRuntime]),
 license:z.object({spdx:z.enum(["MIT","Apache-2.0","BSD-2-Clause","BSD-3-Clause","ISC","AGPL-3.0-only"]),file:browserToolPathSchema,notice:browserToolPathSchema,additional:z.array(browserToolPathSchema).min(3).max(24).optional()}).strict(),
 files:z.array(file).min(4).max(100),
}).strict();
export const browserToolManifestConfigurationSchema = manifestFields.omit({files:true});
export const browserToolManifestSchema = manifestFields.superRefine((m,ctx)=>{
 const prime="profile" in m.runtime;
 if(prime&&(m.toolId!=="prime-factorizer"||m.license.spdx!=="AGPL-3.0-only"||!m.license.additional?.includes("SOURCE_OFFER.md")||!m.license.additional.includes("THIRD_PARTY_NOTICES.md")))
  ctx.addIssue({code:"custom",message:"Dedicated prime profile and corresponding source/license files required"});
 if(!prime&&(m.license.spdx==="AGPL-3.0-only"||m.license.additional!==undefined))
  ctx.addIssue({code:"custom",message:"Initial synchronous profile remains permissive-only"});
});
export const isPrimeAsyncManifest = (m: BrowserToolManifest): boolean => "profile" in m.runtime && m.runtime.profile==="prime-factorizer-async-v1";
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

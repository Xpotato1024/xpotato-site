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
// New opt-in capability profile. Legacy manifests remain byte-for-byte valid.
const boundedRuntime = z.object({profile:z.literal("bounded-browser-v2"),network:z.literal("none-after-ready"),storage:z.literal("memory"),
 capabilities:z.object({fileInput:z.literal(false),download:z.literal(false),clipboard:z.boolean(),worker:z.boolean(),wasm:z.boolean()}).strict(),
 clipboardPolicy:z.literal("user-gesture-write-only"),assetMode:z.literal("fixed-bundled"),
 maxInputBytes:z.number().int().positive().max(65_536),maxOutputBytes:z.number().int().positive().max(262_144),
 maxComputeMs:z.number().int().positive().max(100),jobMaxMs:z.number().int().positive().max(3_600_000),
 maxWorkers:z.number().int().nonnegative().max(6),maxWasmBytes:z.number().int().nonnegative().max(1_610_612_736),
 maxTransportBytes:z.number().int().nonnegative().max(67_108_864),
 embeddedWorkerModules:z.array(browserToolPathSchema).max(12),embeddedWasmModules:z.array(browserToolPathSchema).max(12),workerLoaderModules:z.array(browserToolPathSchema).max(6)
}).strict().superRefine((r,ctx)=>{
 if(r.capabilities.worker!==(r.maxWorkers>0)||!r.capabilities.worker&&(r.embeddedWorkerModules.length>0||r.workerLoaderModules.length>0||r.maxTransportBytes>0)
  ||r.capabilities.wasm!==(r.maxWasmBytes>0)||!r.capabilities.wasm&&r.embeddedWasmModules.length>0
  ||r.capabilities.worker&&(!r.embeddedWorkerModules.length||!r.workerLoaderModules.length)||r.capabilities.wasm&&!r.embeddedWasmModules.length
  ||[r.embeddedWorkerModules,r.embeddedWasmModules,r.workerLoaderModules].some(a=>new Set(a).size!==a.length||a.some(p=>!p.endsWith(".mjs"))))
  ctx.addIssue({code:"custom",message:"Capabilities, finite budgets and fixed assets must agree"});
});
// Optional tool-owned presentation facts; the selected manifest hash binds them to a bundle/version.
const capabilityMode = z.object({id:z.enum(["standard","optimized","wide"]),label:z.string().min(1).max(40),uiLabel:z.string().min(1).max(60),maxDigits:z.number().int().positive().max(10000),maxBits:z.number().int().positive().max(40000),experimentalAboveBits:z.number().int().positive().max(40000).optional(),timeBudgetMaxMs:z.number().int().positive().max(3600000)}).strict().superRefine((m,ctx)=>{if(m.experimentalAboveBits!==undefined&&m.experimentalAboveBits>=m.maxBits)ctx.addIssue({code:"custom",message:"Experimental threshold must be below the mode maximum"});});
export const browserToolUiCapabilitiesSchema = z.object({schemaVersion:z.literal(1),kind:z.literal("integer-factorization"),input:z.object({maxTextLength:z.number().int().positive().max(65536),minimum:z.literal("0"),scientificNotation:z.literal(true)}).strict(),defaultMode:z.enum(["standard","optimized","wide"]),completionGuaranteed:z.literal(false),smallInputRoute:z.object({modeId:z.enum(["standard","optimized","wide"]),exclusiveUpperPowerOfTwo:z.number().int().positive().max(40000),timeBudgetMaxMs:z.number().int().positive().max(3600000)}).strict().optional(),modes:z.array(capabilityMode).min(1).max(3)}).strict().superRefine((c,ctx)=>{if(c.smallInputRoute&&!c.modes.some(m=>m.id===c.smallInputRoute!.modeId&&c.smallInputRoute!.exclusiveUpperPowerOfTwo<=m.maxBits&&c.smallInputRoute!.timeBudgetMaxMs<=m.timeBudgetMaxMs))ctx.addIssue({code:"custom",message:"Small-input route must refer to a declared mode within its limits"});if(new Set(c.modes.map(m=>m.id)).size!==c.modes.length||!c.modes.some(m=>m.id===c.defaultMode))ctx.addIssue({code:"custom",message:"Capability modes must be unique and include the default"});});
export type BrowserToolUiCapabilities=z.infer<typeof browserToolUiCapabilitiesSchema>;
export const browserToolTypographyProperties=Object.freeze(["--bt-font-family","--bt-font-size","--bt-line-height","--bt-summary-font-size","--bt-summary-font-weight","--bt-help-font-size","--bt-heading-font-size","--bt-control-min-size"] as const);
const manifestFields = z.object({
 schemaVersion:z.literal(1),toolId:id,version:z.string().regex(/^\d+\.\d+\.\d+$/u),
 integration:z.object({kind:z.literal("react-island"),apiVersion:z.literal(1),entry:browserToolPathSchema,styles:z.array(browserToolPathSchema).max(4)}).strict(),
 runtime:z.union([simpleRuntime,primeRuntime,boundedRuntime]),
 uiCapabilities:browserToolUiCapabilitiesSchema.optional(),
 license:z.object({spdx:z.enum(["MIT","Apache-2.0","BSD-2-Clause","BSD-3-Clause","ISC","AGPL-3.0-only"]),file:browserToolPathSchema,notice:browserToolPathSchema,additional:z.array(browserToolPathSchema).min(1).max(24).optional()}).strict(),
 files:z.array(file).min(4).max(100),
}).strict();
export const browserToolManifestConfigurationSchema = manifestFields.omit({files:true});
export const browserToolManifestSchema = manifestFields.superRefine((m,ctx)=>{
 if(m.uiCapabilities&&(!("jobMaxMs" in m.runtime)||m.uiCapabilities.input.maxTextLength*4>m.runtime.maxInputBytes||m.uiCapabilities.modes.some(mode=>mode.timeBudgetMaxMs>("jobMaxMs" in m.runtime?m.runtime.jobMaxMs:0))))ctx.addIssue({code:"custom",message:"UI text needs a conservative UTF-8 byte envelope and mode times must fit the selected runtime"});
 const prime="profile" in m.runtime&&m.runtime.profile==="prime-factorizer-async-v1";
 const bounded="profile" in m.runtime&&m.runtime.profile==="bounded-browser-v2";
 if(prime&&((m.license.additional?.length??0)<3||m.toolId!=="prime-factorizer"||m.license.spdx!=="AGPL-3.0-only"||!m.license.additional?.includes("SOURCE_OFFER.md")||!m.license.additional.includes("THIRD_PARTY_NOTICES.md")))
  ctx.addIssue({code:"custom",message:"Dedicated prime profile and corresponding source/license files required"});
 if(!prime&&!bounded&&(m.license.spdx==="AGPL-3.0-only"||m.license.additional!==undefined))
  ctx.addIssue({code:"custom",message:"Initial synchronous profile remains permissive-only"});
 if(bounded&&m.license.spdx==="AGPL-3.0-only"&&(!m.license.additional?.includes("SOURCE_OFFER.md")||!m.license.additional.includes("THIRD_PARTY_NOTICES.md")))
  ctx.addIssue({code:"custom",message:"AGPL corresponding-source offer and third-party notices required"});
});
export const isBoundedBrowserManifest = (m: BrowserToolManifest): boolean => "profile" in m.runtime && m.runtime.profile==="bounded-browser-v2";
export const isAsyncBrowserManifest = (m: BrowserToolManifest): boolean => "profile" in m.runtime;
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
  runtimeReview:z.object({fixedEmbeddedAssets:z.literal(true),finiteResources:z.literal(true),cancelUnmountRetirement:z.literal(true),noComputeNetwork:z.literal(true),hostSeoOwnership:z.literal(true)}).strict().optional(),
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

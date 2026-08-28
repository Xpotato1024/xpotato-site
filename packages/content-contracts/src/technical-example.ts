import { z } from "zod";
import { isoDateTimeSchema, sha256Schema, stableIdSchema } from "./common.js";

export const exampleVerificationClassSchema = z.enum([
  "illustrative",
  "syntax_checked",
  "sandbox_executed",
  "evidence_observed",
  "not_verifiable",
]);
export const technicalExampleRecordSchema = z
  .object({
    exampleId: stableIdSchema,
    draftSha256: sha256Schema,
    sourceSpan: z.object({ start: z.number().int().nonnegative(), end: z.number().int().positive() }).strict(),
    kind: z.enum(["code", "shell_command", "configuration", "query", "expected_output"]),
    language: z.string().min(1).optional(),
    contentSha256: sha256Schema,
    intendedPurpose: z.string().min(1),
    requestedVerification: exampleVerificationClassSchema,
  })
  .strict()
  .refine((value) => value.sourceSpan.end > value.sourceSpan.start, {
    message: "source span end must be greater than start",
    path: ["sourceSpan", "end"],
  });
export const technicalExampleVerificationResultSchema = z
  .object({
    exampleId: stableIdSchema,
    class: exampleVerificationClassSchema,
    status: z.enum(["pass", "fail", "not_run", "blocked"]),
    verifier: z
      .object({
        kind: z.enum(["parser", "compiler", "schema", "sandbox", "evidence_binding"]),
        name: z.string().min(1),
        version: z.string().min(1),
      })
      .strict()
      .optional(),
    executionProfileId: stableIdSchema.optional(),
    inputArtifactSha256: sha256Schema.optional(),
    stdoutSha256: sha256Schema.optional(),
    stderrSha256: sha256Schema.optional(),
    exitCode: z.number().int().optional(),
    evidenceIds: z.array(stableIdSchema).optional(),
    limitations: z.array(z.string()),
    verifiedAt: isoDateTimeSchema.optional(),
  })
  .strict();

export const exampleSandboxProfileSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.literal("example-sandbox-v1"),
    network: z.literal("none"),
    user: z.literal("non-root"),
    rootFilesystem: z.literal("read-only"),
    linuxCapabilities: z.literal("none"),
    hostDevices: z.literal("none"),
    hostSockets: z.literal("none"),
    hostSecretMounts: z.literal("none"),
    workspace: z.literal("tmpfs"),
    workspaceMaxBytes: z.literal(67_108_864),
    memoryMaxBytes: z.literal(268_435_456),
    pidsMax: z.literal(32),
    cpuCoresMax: z.literal(1),
    wallTimeoutSeconds: z.literal(15),
    combinedOutputMaxBytes: z.literal(1_048_576),
    environmentAllowlist: z.tuple([
      z.literal("PATH"),
      z.literal("LANG=C.UTF-8"),
      z.literal("LC_ALL=C.UTF-8"),
      z.literal("TZ=UTC"),
      z.literal("HOME=/tmp/home"),
      z.literal("TMPDIR=/tmp"),
    ]),
  })
  .strict();

export type TechnicalExampleRecord = z.infer<typeof technicalExampleRecordSchema>;
export type TechnicalExampleVerificationResult = z.infer<typeof technicalExampleVerificationResultSchema>;

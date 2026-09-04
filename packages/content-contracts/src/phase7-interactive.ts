import { z } from "zod";
import { contentIdSchema, repositoryRelativePathSchema, sha256Schema, stableIdSchema } from "./common.js";

const gitShaSchema = z.string().regex(/^[a-f0-9]{40}$/u, "lowercase Git SHA required");
const routePathSchema = z.string().startsWith("/");
const clientAssetPathSchema = z.string().regex(/^\/_astro\/.+\.js$/u, "built client JavaScript path required");

export const phase7ClientAssetMeasurementSchema = z
  .object({
    path: clientAssetPathSchema,
    bytes: z.number().int().positive(),
    gzipBytes: z.number().int().positive(),
    sha256: sha256Schema,
  })
  .strict();

export const phase7BehaviorCaseSchema = z
  .object({
    id: stableIdSchema,
    draft: z.string(),
    browserConstraint: z.enum([
      "valid",
      "empty-allowed",
      "range-underflow",
      "step-mismatch",
      "number-control-rejects-nonnumeric",
    ]),
    accepted: z.boolean(),
    acceptedValue: z.number().finite(),
    visibleOutput: z.string().min(1),
  })
  .strict();

export const phase7IsolationRouteSchema = z
  .object({
    id: stableIdSchema,
    route: routePathSchema,
    htmlPath: repositoryRelativePathSchema,
    astroIslandCount: z.literal(0),
    executableInlineScriptBytes: z.number().int().nonnegative(),
    clientJsAssets: z.array(phase7ClientAssetMeasurementSchema).length(0),
  })
  .strict();

export const phase7InteractiveReadinessManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    profileId: z.literal("phase7-interactive-readiness-v1"),
    legacyAuthority: z
      .object({
        repository: z.literal("Xpotato1024/xpotato-site"),
        tag: z.literal("legacy-pre-vnext-2026-08-28"),
        tagObjectSha: gitShaSchema,
        commitSha: gitShaSchema,
        componentPath: repositoryRelativePathSchema,
        componentBlobSha: gitShaSchema,
        componentSourceSha256: sha256Schema,
        contentPath: repositoryRelativePathSchema,
        contentBlobSha: gitShaSchema,
        contentSourceSha256: sha256Schema,
        generatedBuildObservation: z
          .object({
            node: z.literal("24.19.0"),
            npm: z.literal("11.19.0"),
            route: z.literal("/tools/prime-factorizer/"),
            rawHtmlSha256: sha256Schema,
            astroIslandClient: z.literal("visible"),
            ssrShell: z.literal(true),
            initialInputValue: z.literal("360"),
            initialVisibleOutput: z.literal("360 = 2 × 2 × 2 × 3 × 3 × 5"),
            componentAsset: phase7ClientAssetMeasurementSchema.omit({ gzipBytes: true }),
            rendererAsset: phase7ClientAssetMeasurementSchema.omit({ gzipBytes: true }),
            acceptedNonHtmlManifestSha256: sha256Schema,
          })
          .strict(),
      })
      .strict(),
    parityBoundary: z
      .object({
        mustPreserve: z.tuple([
          z.literal("factorization-result"),
          z.literal("accepted-input-semantics"),
          z.literal("submit-state-behavior"),
          z.literal("meaningful-visible-result"),
          z.literal("core-operation-availability"),
          z.literal("keyboard-operability"),
        ]),
        mayDiffer: z.tuple([
          z.literal("tailwind-classes"),
          z.literal("colors-borders-spacing"),
          z.literal("card-appearance"),
          z.literal("heading-presentation"),
          z.literal("explanatory-prose"),
        ]),
      })
      .strict(),
    observableBehavior: z
      .object({
        initialDraft: z.literal("360"),
        initialAcceptedValue: z.literal(360),
        initialVisibleOutput: z.literal("360 = 2 × 2 × 2 × 3 × 3 × 5"),
        acceptedDomain: z.literal("Number.isInteger(Number(draft)) && Number(draft) > 1"),
        safeIntegerRequired: z.literal(false),
        numberModel: z.literal("ECMAScript IEEE-754 Number; unsafe integer text may round before factorization"),
        input: z
          .object({
            type: z.literal("number"),
            inputMode: z.literal("numeric"),
            min: z.literal(2),
            step: z.literal(1),
            required: z.literal(false),
          })
          .strict(),
        commitTrigger: z.literal("form-submit-only"),
        invalidSubmit: z.literal("retain-last-accepted-value-and-result"),
        enterSubmit: z.literal(true),
        buttonSubmitText: z.literal("分解する"),
        factorOrder: z.literal("ascending"),
        multiplicityPreserved: z.literal(true),
        outputFormat: z.literal("value = factor × factor ..."),
        unreachableFallbackText: z.literal("2以上の整数を入力してください。"),
        cases: z.array(phase7BehaviorCaseSchema).min(10),
      })
      .strict(),
    vNextBinding: z
      .object({
        toolContentId: contentIdSchema,
        moduleId: z.literal("prime-factorizer"),
        componentId: z.literal("prime-factorizer-react-v1"),
        framework: z.literal("react"),
        hydration: z.literal("visible"),
        role: z.literal("primary_tool"),
        allowedCollections: z.tuple([z.literal("tools")]),
        moduleStatus: z.literal("active"),
        bindingStatus: z.literal("active"),
        apiVersion: z.literal(1),
        budgetClass: z.literal("small"),
      })
      .strict(),
    hydrationBoundary: z
      .object({
        registryMode: z.literal("visible"),
        rendererDirective: z.literal("client:visible"),
        clientLoadAbsent: z.literal(true),
        clientOnlyAbsent: z.literal(true),
        ssrShellPresent: z.literal(true),
      })
      .strict(),
    runtimeIsolation: z
      .object({
        toolRoute: z.literal("/tools/prime-factorizer/"),
        toolHtmlPath: repositoryRelativePathSchema,
        toolAstroIslandCount: z.literal(1),
        toolExecutableInlineScriptBytes: z.number().int().positive(),
        routeClientJsAssets: z.array(phase7ClientAssetMeasurementSchema).min(2),
        routeClientJsRawBytes: z.number().int().positive(),
        routeClientJsGzipBytes: z.number().int().positive(),
        primeFactorizerChunk: phase7ClientAssetMeasurementSchema,
        reactRuntimeChunk: phase7ClientAssetMeasurementSchema,
        supportingChunks: z.array(phase7ClientAssetMeasurementSchema),
        gzipProfile: z.literal("node-zlib-gzip-default-per-asset-v1"),
        contentOnlyRoutes: z.array(phase7IsolationRouteSchema).length(6),
        unbuiltContentOnlyRouteClasses: z
          .tuple([
            z
              .object({
                id: z.literal("blog-detail"),
                status: z.literal("not-built-publication-held"),
                sourceRendererPath: repositoryRelativePathSchema,
                migratedSourceCount: z.literal(44),
                additionalDraftFixtureCount: z.literal(1),
                activeInteractiveReferenceCount: z.literal(0),
                rationale: z.literal("all migrated Blog entries remain draft under the existing publication hold, so no ordinary Blog detail HTML exists to measure in Phase 7"),
              })
              .strict(),
          ]),
      })
      .strict(),
    accessibility: z
      .object({
        explicitLabel: z.literal(true),
        semanticForm: z.literal(true),
        keyboardSubmit: z.literal(true),
        submitButton: z.literal(true),
        resultAnnouncement: z.literal("aria-live-polite-atomic"),
        clickableDivAbsent: z.literal(true),
        nativeFocusVisibilityRetained: z.literal(true),
      })
      .strict(),
    bundleBudget: z
      .object({
        budgetClass: z.literal("small"),
        hardThresholdBytes: z.null(),
        status: z.literal("measured-threshold-deferred-to-phase12-o7"),
      })
      .strict(),
    browserTestDecision: z
      .object({
        frameworkAdded: z.literal(false),
        rationale: z.literal("pure state tests plus SSR and built-form validation cover the behavior; native form submit semantics provide Enter and button activation"),
      })
      .strict(),
    safety: z
      .object({
        persistentMutationAuthorized: z.literal(false),
        deployWorkflowGate: z.literal("if: ${{ false }}"),
        phase8Implemented: z.literal(false),
        providerMutationPerformed: z.literal(false),
        productionDeployPerformed: z.literal(false),
        legacyDeletionPerformed: z.literal(false),
      })
      .strict(),
    manifestPayloadSha256: sha256Schema,
  })
  .strict();

export type Phase7ClientAssetMeasurement = z.infer<typeof phase7ClientAssetMeasurementSchema>;
export type Phase7InteractiveReadinessManifest = z.infer<typeof phase7InteractiveReadinessManifestSchema>;

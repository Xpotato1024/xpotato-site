import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  phase7InteractiveReadinessManifestSchema,
  type Phase7ClientAssetMeasurement,
  type Phase7InteractiveReadinessManifest,
} from "@xpotato/content-contracts";
import { fingerprint, sha256 } from "@xpotato/content-contracts/canonical";
import { validatePortableMdx } from "./portable-mdx.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const distRoot = join(repositoryRoot, "apps/site/dist");
const legacyCommitSha = "927d105713561309fc5e2374396f86646b5aeb2a";
const legacyTag = "legacy-pre-vnext-2026-08-28";
const legacyComponentPath = "src/components/app/PrimeFactorizer.tsx";
const legacyContentPath = "src/content/tools/prime-factorizer.mdx";
const toolContentId = "bca48f98-c89a-457f-84d8-168f941fe469";
export const phase7InteractiveReadinessPath = join(repositoryRoot, "docs/migration/phase7-interactive-readiness-v1.json");

const git = (args: readonly string[], encoding: "utf8" | "buffer" = "utf8"): string | Buffer => execFileSync("git", [...args], {
  cwd: repositoryRoot,
  encoding,
  maxBuffer: 32 * 1024 * 1024,
});

const gitText = (args: readonly string[]): string => String(git(args, "utf8")).trim();
const gitBlob = (path: string): Buffer => git(["cat-file", "blob", `${legacyCommitSha}:${path}`], "buffer") as Buffer;
const sha256Bytes = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

const requireMatch = (source: string, pattern: RegExp, description: string): RegExpMatchArray => {
  const match = source.match(pattern);
  if (!match) throw new Error(`Phase 7 frozen/current source evidence missing: ${description}`);
  return match;
};

const factorizeLikeFrozenLegacy = (input: number): readonly number[] => {
  if (!Number.isInteger(input) || input < 2) return [];
  const factors: number[] = [];
  let value = input;
  let divisor = 2;
  while (value > 1) {
    while (value % divisor === 0) {
      factors.push(divisor);
      value /= divisor;
    }
    divisor += divisor === 2 ? 1 : 2;
    if (divisor * divisor > value && value > 1) {
      factors.push(value);
      break;
    }
  }
  return factors;
};

const formatLikeFrozenLegacy = (value: number): string => {
  const factors = factorizeLikeFrozenLegacy(value);
  return factors.length > 0 ? `${value} = ${factors.join(" × ")}` : "2以上の整数を入力してください。";
};

const behaviorCases = (): Phase7InteractiveReadinessManifest["observableBehavior"]["cases"] => [
  ["empty", "", "empty-allowed"],
  ["zero", "0", "range-underflow"],
  ["one", "1", "range-underflow"],
  ["negative", "-4", "range-underflow"],
  ["fractional-decimal", "2.5", "step-mismatch"],
  ["integer-decimal-text", "3.0", "valid"],
  ["prime", "13", "valid"],
  ["composite", "84", "valid"],
  ["repeated-factors", "360", "valid"],
  ["large-unsafe-integer", "9007199254740992", "valid"],
  ["rounded-unsafe-integer", "9007199254740993", "valid"],
  ["nonnumeric", "not-a-number", "number-control-rejects-nonnumeric"],
].map(([id, draft, browserConstraint]) => {
  const parsed = Number(draft);
  const accepted = Number.isInteger(parsed) && parsed > 1;
  const acceptedValue = accepted ? parsed : 360;
  return {
    id: id!,
    draft: draft!,
    browserConstraint: browserConstraint as Phase7InteractiveReadinessManifest["observableBehavior"]["cases"][number]["browserConstraint"],
    accepted,
    acceptedValue,
    visibleOutput: formatLikeFrozenLegacy(acceptedValue),
  };
});

const assertFrozenLegacySource = (component: string, content: string): void => {
  requireMatch(component, /const \[draft, setDraft\] = useState\("360"\);/u, "initial draft 360");
  requireMatch(component, /const \[value, setValue\] = useState\(360\);/u, "initial accepted value 360");
  requireMatch(component, /const next = Number\(draft\);/u, "submitted draft Number conversion");
  requireMatch(component, /if \(Number\.isInteger\(next\) && next > 1\) \{\s*setValue\(next\);/u, "integer greater-than-one submit guard");
  requireMatch(component, /<form[\s\S]*onSubmit=\{handleSubmit\}/u, "form submit handler");
  requireMatch(component, /<input[\s\S]*inputMode="numeric"[\s\S]*min=\{2\}[\s\S]*step=\{1\}[\s\S]*type="number"[\s\S]*value=\{draft\}[\s\S]*onChange=\{\(event\) => setDraft\(event\.target\.value\)\}/u, "number input attributes and draft-only change");
  requireMatch(component, /<button[\s\S]*type="submit"[\s\S]*>\s*分解する\s*<\/button>/u, "submit button");
  requireMatch(component, /`\$\{value\} = \$\{factors\.join\(" × "\)\}` : "2以上の整数を入力してください。"/u, "visible result representation");
  requireMatch(content, /import PrimeFactorizer from "\.\.\/\.\.\/components\/app\/PrimeFactorizer";/u, "frozen MDX component import");
  requireMatch(content, /<PrimeFactorizer client:visible \/>/u, "frozen client:visible island binding");
};

const assertCurrentSourceBoundary = async (): Promise<void> => {
  const component = await readFile(join(repositoryRoot, "apps/site/src/components/islands/PrimeFactorizer.tsx"), "utf8");
  const model = await readFile(join(repositoryRoot, "apps/site/src/components/islands/prime-factorizer-model.ts"), "utf8");
  const registry = await readFile(join(repositoryRoot, "apps/site/src/content-registry/interactive/index.ts"), "utf8");
  const imports = await readFile(join(repositoryRoot, "apps/site/src/content-registry/interactive/component-imports.ts"), "utf8");
  const visibleRenderer = await readFile(join(repositoryRoot, "apps/site/src/components/interactive-renderers/PrimeFactorizerVisible.astro"), "utf8");
  const toolContent = await readFile(join(repositoryRoot, "apps/site/src/content/tools/prime-factorizer.mdx"), "utf8");
  const deployWorkflow = await readFile(join(repositoryRoot, ".github/workflows/deploy-site.yml"), "utf8");

  requireMatch(component, /const \[draft, setDraft\] = useState\("360"\);/u, "vNext draft state");
  requireMatch(component, /const \[value, setValue\] = useState\(360\);/u, "vNext accepted state");
  requireMatch(component, /<form onSubmit=\{handleSubmit\}>/u, "vNext form submit boundary");
  requireMatch(component, /setValue\(\(currentValue\) => submitPrimeFactorizerDraft\(currentValue, draft\)\);/u, "vNext submit-only commit");
  requireMatch(component, /onChange=\{\(event\) => setDraft\(event\.target\.value\)\}/u, "vNext draft-only change");
  requireMatch(model, /Number\.isInteger\(nextValue\) && nextValue > 1/u, "vNext accepted input semantics");
  if (model.includes("Number.isSafeInteger")) throw new Error("Phase 7 must not add a safe-integer restriction absent from frozen legacy");

  for (const expected of [
    `id: "prime-factorizer"`,
    `componentId: "prime-factorizer-react-v1"`,
    `hydration: "visible"`,
    `allowedCollections: ["tools"]`,
    `role: "primary_tool"`,
    `status: "active"`,
    `budgetClass: "small"`,
    `contentId: "${toolContentId}"`,
  ]) {
    if (!registry.includes(expected)) throw new Error(`Phase 7 registry identity drift: ${expected}`);
  }
  requireMatch(imports, /"prime-factorizer-react-v1"[\s\S]*visible: PrimeFactorizerVisible/u, "registered visible renderer import");
  requireMatch(visibleRenderer, /<PrimeFactorizer client:visible \/>/u, "visible renderer directive");
  if (/client:(?:load|only)/u.test(visibleRenderer)) throw new Error("PrimeFactorizer visible renderer regressed to eager/client-only hydration");

  const demoMatches = [...toolContent.matchAll(/<Demo\b[^>]*\bmodule="prime-factorizer"[^>]*\/>/gu)];
  if (demoMatches.length !== 1) throw new Error(`Tool content must have exactly one semantic PrimeFactorizer Demo: ${demoMatches.length}`);
  const portableErrors = validatePortableMdx(toolContent);
  if (portableErrors.length > 0) throw new Error(`Tool content is not portable: ${portableErrors.join(", ")}`);
  if (/PrimeFactorizer|client:|\.\.\/.*components/iu.test(toolContent)) {
    throw new Error("Tool content contains a direct runtime component or hydration path");
  }
  if (!/^\s*if:\s*\$\{\{ false \}\}\s*$/mu.test(deployWorkflow)) {
    throw new Error("deploy-site.yml hard block changed");
  }
};

const normalizeClientAssetUrl = (reference: string, importer?: string): string => {
  const pathname = reference.startsWith("/")
    ? new URL(reference, "https://xpotato.net").pathname
    : new URL(reference, `https://xpotato.net${importer ?? "/"}`).pathname;
  if (!pathname.startsWith("/_astro/") || !pathname.endsWith(".js")) {
    throw new Error(`Unexpected client JavaScript reference: ${reference}`);
  }
  return pathname;
};

const clientReferences = (source: string, importer?: string): readonly string[] => {
  const references = new Set<string>();
  for (const match of source.matchAll(/(?:src|component-url|renderer-url|before-hydration-url)="([^"]+\.js(?:\?[^"#]*)?)"/gu)) {
    references.add(normalizeClientAssetUrl(match[1]!, importer));
  }
  for (const match of source.matchAll(/(?:from\s*|import\s*\()\s*["']([^"']+\.js(?:\?[^"'#]*)?)["']/gu)) {
    references.add(normalizeClientAssetUrl(match[1]!, importer));
  }
  return [...references].sort();
};

const measureClientAsset = async (path: string): Promise<Phase7ClientAssetMeasurement> => {
  const bytes = await readFile(join(distRoot, path.slice(1)));
  return {
    path,
    bytes: bytes.byteLength,
    gzipBytes: gzipSync(bytes).byteLength,
    sha256: sha256(bytes),
  };
};

const clientAssetGraph = async (html: string): Promise<Phase7ClientAssetMeasurement[]> => {
  const pending = [...clientReferences(html)];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const path = pending.shift()!;
    if (visited.has(path)) continue;
    visited.add(path);
    const source = await readFile(join(distRoot, path.slice(1)), "utf8");
    for (const reference of clientReferences(source, path)) {
      if (!visited.has(reference)) pending.push(reference);
    }
  }
  return Promise.all([...visited].sort().map(measureClientAsset));
};

const executableInlineScriptBytes = (html: string): number => [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/giu)]
  .filter((match) => !/\btype="application\/ld\+json"/iu.test(match[1]!))
  .filter((match) => !/\bsrc=/iu.test(match[1]!))
  .reduce((total, match) => total + Buffer.byteLength(match[2]!, "utf8"), 0);

const contentOnlyRoutes = [
  { id: "home", route: "/", htmlPath: "index.html" },
  { id: "blog-archive", route: "/blog/", htmlPath: "blog/index.html" },
  { id: "notes-detail", route: "/notes/infrastructure-foundation/", htmlPath: "notes/infrastructure-foundation/index.html" },
  { id: "notes-archive", route: "/notes/", htmlPath: "notes/index.html" },
  { id: "projects", route: "/projects/xpotato-site/", htmlPath: "projects/xpotato-site/index.html" },
  { id: "static-page", route: "/about/", htmlPath: "about/index.html" },
] as const;

const buildRuntimeEvidence = async (): Promise<Pick<Phase7InteractiveReadinessManifest, "hydrationBoundary" | "runtimeIsolation" | "accessibility">> => {
  const toolHtmlPath = "tools/prime-factorizer/index.html";
  const toolHtml = await readFile(join(distRoot, toolHtmlPath), "utf8");
  const islands = [...toolHtml.matchAll(/<astro-island\b([^>]*)>([\s\S]*?)<\/astro-island>/giu)];
  if (islands.length !== 1) throw new Error(`PrimeFactorizer route requires exactly one Astro island: ${islands.length}`);
  const attributes = islands[0]![1]!;
  const shell = islands[0]![2]!;
  const componentUrl = requireMatch(attributes, /\bcomponent-url="([^"]+\.js)"/u, "built component URL")[1]!;
  const rendererUrl = requireMatch(attributes, /\brenderer-url="([^"]+\.js)"/u, "built renderer URL")[1]!;
  if (!/\bclient="visible"/u.test(attributes)) throw new Error("Built PrimeFactorizer island is not client:visible");
  if (!/\bssr(?:\s|$)/u.test(attributes)) throw new Error("Built PrimeFactorizer island lost its SSR shell");
  for (const pattern of [
    /<form\b/u,
    /<label\s+for="prime-factorizer-input">2以上の整数<\/label>/u,
    /<input\b[^>]*\binputMode="numeric"[^>]*\bmin="2"[^>]*\bstep="1"[^>]*\btype="number"[^>]*\bvalue="360"/u,
    /<button\s+type="submit">分解する<\/button>/u,
    /<output\b[^>]*\baria-live="polite"[^>]*\baria-atomic="true"[^>]*>360 = 2 × 2 × 2 × 3 × 3 × 5<\/output>/u,
  ]) requireMatch(shell, pattern, `built SSR shell ${pattern.source}`);
  if (/<div\b[^>]*\brole="button"/iu.test(shell)) throw new Error("Inaccessible clickable div found in PrimeFactorizer shell");

  const routeClientJsAssets = await clientAssetGraph(toolHtml);
  const componentPath = normalizeClientAssetUrl(componentUrl);
  const rendererPath = normalizeClientAssetUrl(rendererUrl);
  const primeFactorizerChunk = routeClientJsAssets.find((asset) => asset.path === componentPath);
  const reactRuntimeChunk = routeClientJsAssets.find((asset) => asset.path === rendererPath);
  if (!primeFactorizerChunk || !reactRuntimeChunk) throw new Error("Built component/renderer asset is absent from the Tool route graph");
  const supportingChunks = routeClientJsAssets.filter((asset) => asset.path !== componentPath && asset.path !== rendererPath);

  const isolation = [];
  for (const route of contentOnlyRoutes) {
    const html = await readFile(join(distRoot, route.htmlPath), "utf8");
    const astroIslandCount = (html.match(/<astro-island\b/giu) ?? []).length;
    const clientJsAssets = await clientAssetGraph(html);
    if (astroIslandCount !== 0) throw new Error(`${route.route}: content-only route contains an Astro island`);
    if (clientJsAssets.length !== 0) {
      throw new Error(`${route.route}: content-only route contains client JavaScript: ${clientJsAssets.map((asset) => asset.path).join(", ")}`);
    }
    isolation.push({
      ...route,
      astroIslandCount: 0 as const,
      executableInlineScriptBytes: executableInlineScriptBytes(html),
      clientJsAssets: [],
    });
  }

  const blogSources = gitText(["ls-files", "apps/site/src/content/blog/*.mdx"])
    .split(/\r?\n/u)
    .filter(Boolean);
  const materialization = JSON.parse(await readFile(join(repositoryRoot, "docs/migration/content-materialization-v1.json"), "utf8")) as {
    records?: readonly Readonly<{ collection?: unknown; targetPath?: unknown }>[];
  };
  const migratedBlogSources = (materialization.records ?? [])
    .filter((record) => record.collection === "blog" && typeof record.targetPath === "string")
    .map((record) => String(record.targetPath));
  if (migratedBlogSources.length !== 44) throw new Error(`Expected 44 migrated Blog sources, found ${migratedBlogSources.length}`);
  const blogSourceSet = new Set(blogSources);
  for (const path of migratedBlogSources) {
    if (!blogSourceSet.has(path)) throw new Error(`Materialized Blog source is absent from the repository: ${path}`);
  }
  const additionalDraftFixtureCount = blogSources.length - migratedBlogSources.length;
  if (additionalDraftFixtureCount !== 1) {
    throw new Error(`Expected one additional draft Blog fixture, found ${additionalDraftFixtureCount}`);
  }
  let activeInteractiveReferenceCount = 0;
  for (const path of blogSources) {
    const source = await readFile(join(repositoryRoot, path), "utf8");
    if (!/^"?draft"?:\s*true$/mu.test(source)) throw new Error(`Phase 7 Blog-detail Not Applicable proof found a non-draft source: ${path}`);
    activeInteractiveReferenceCount += (source.match(/<Demo\b/gu) ?? []).length;
  }
  if (activeInteractiveReferenceCount !== 0) {
    throw new Error(`Draft Blog sources unexpectedly reference interactive modules: ${activeInteractiveReferenceCount}`);
  }
  const blogRendererPath = "apps/site/src/pages/blog/[...slug].astro";
  const blogRenderer = await readFile(join(repositoryRoot, blogRendererPath), "utf8");
  if (/client:|PrimeFactorizer|interactive-renderers/iu.test(blogRenderer)) {
    throw new Error("Blog detail renderer directly references client runtime");
  }

  return {
    hydrationBoundary: {
      registryMode: "visible",
      rendererDirective: "client:visible",
      clientLoadAbsent: true,
      clientOnlyAbsent: true,
      ssrShellPresent: true,
    },
    runtimeIsolation: {
      toolRoute: "/tools/prime-factorizer/",
      toolHtmlPath,
      toolAstroIslandCount: 1,
      toolExecutableInlineScriptBytes: executableInlineScriptBytes(toolHtml),
      routeClientJsAssets,
      routeClientJsRawBytes: routeClientJsAssets.reduce((total, asset) => total + asset.bytes, 0),
      routeClientJsGzipBytes: routeClientJsAssets.reduce((total, asset) => total + asset.gzipBytes, 0),
      primeFactorizerChunk,
      reactRuntimeChunk,
      supportingChunks,
      gzipProfile: "node-zlib-gzip-default-per-asset-v1",
      contentOnlyRoutes: isolation,
      unbuiltContentOnlyRouteClasses: [{
        id: "blog-detail",
        status: "not-built-publication-held",
        sourceRendererPath: blogRendererPath,
        migratedSourceCount: migratedBlogSources.length,
        additionalDraftFixtureCount: 1 as const,
        activeInteractiveReferenceCount,
        rationale: "all migrated Blog entries remain draft under the existing publication hold, so no ordinary Blog detail HTML exists to measure in Phase 7",
      }],
    },
    accessibility: {
      explicitLabel: true,
      semanticForm: true,
      keyboardSubmit: true,
      submitButton: true,
      resultAnnouncement: "aria-live-polite-atomic",
      clickableDivAbsent: true,
      nativeFocusVisibilityRetained: true,
    },
  };
};

export const buildPhase7InteractiveReadiness = async (): Promise<Phase7InteractiveReadinessManifest> => {
  const tagObjectSha = gitText(["rev-parse", `refs/tags/${legacyTag}`]);
  const commitSha = gitText(["rev-list", "-n", "1", `refs/tags/${legacyTag}`]);
  if (tagObjectSha !== "8503f5a50a5fb3d27a02422da0b50dc66c818b02" || commitSha !== legacyCommitSha) {
    throw new Error(`Frozen legacy authority mismatch: tag=${tagObjectSha}; commit=${commitSha}`);
  }
  const componentBytes = gitBlob(legacyComponentPath);
  const contentBytes = gitBlob(legacyContentPath);
  const component = componentBytes.toString("utf8");
  const content = contentBytes.toString("utf8");
  assertFrozenLegacySource(component, content);
  await assertCurrentSourceBoundary();
  const runtime = await buildRuntimeEvidence();

  const payload = {
    schemaVersion: 1 as const,
    profileId: "phase7-interactive-readiness-v1" as const,
    legacyAuthority: {
      repository: "Xpotato1024/xpotato-site" as const,
      tag: legacyTag,
      tagObjectSha,
      commitSha,
      componentPath: legacyComponentPath,
      componentBlobSha: gitText(["rev-parse", `${legacyCommitSha}:${legacyComponentPath}`]),
      componentSourceSha256: sha256Bytes(componentBytes),
      contentPath: legacyContentPath,
      contentBlobSha: gitText(["rev-parse", `${legacyCommitSha}:${legacyContentPath}`]),
      contentSourceSha256: sha256Bytes(contentBytes),
      generatedBuildObservation: {
        node: "24.19.0" as const,
        npm: "11.19.0" as const,
        route: "/tools/prime-factorizer/" as const,
        rawHtmlSha256: "9fd825f732c17477eb6d487d39e74b5d37385fa9516f8806e153e6f462d10301",
        astroIslandClient: "visible" as const,
        ssrShell: true as const,
        initialInputValue: "360" as const,
        initialVisibleOutput: "360 = 2 × 2 × 2 × 3 × 3 × 5" as const,
        componentAsset: {
          path: "/_astro/PrimeFactorizer.3YePeCUL.js",
          bytes: 2769,
          sha256: "2f5f67d13d200e766f9bc4fefc307b2d1c2ce015929e8f0c951425c183a071c8",
        },
        rendererAsset: {
          path: "/_astro/client.BJHgAj4G.js",
          bytes: 136510,
          sha256: "d56ea0838155cc4140ecb99280135ec72d5dadb367bbcfbe93f2f4d50494e4a5",
        },
        acceptedNonHtmlManifestSha256: "2dc8ca780cab874fce931dfe227f2326498bf89788a80676e706b48efc8214c6",
      },
    },
    parityBoundary: {
      mustPreserve: [
        "factorization-result",
        "accepted-input-semantics",
        "submit-state-behavior",
        "meaningful-visible-result",
        "core-operation-availability",
        "keyboard-operability",
      ] as const,
      mayDiffer: [
        "tailwind-classes",
        "colors-borders-spacing",
        "card-appearance",
        "heading-presentation",
        "explanatory-prose",
      ] as const,
    },
    observableBehavior: {
      initialDraft: "360" as const,
      initialAcceptedValue: 360 as const,
      initialVisibleOutput: "360 = 2 × 2 × 2 × 3 × 3 × 5" as const,
      acceptedDomain: "Number.isInteger(Number(draft)) && Number(draft) > 1" as const,
      safeIntegerRequired: false as const,
      numberModel: "ECMAScript IEEE-754 Number; unsafe integer text may round before factorization" as const,
      input: { type: "number" as const, inputMode: "numeric" as const, min: 2 as const, step: 1 as const, required: false as const },
      commitTrigger: "form-submit-only" as const,
      invalidSubmit: "retain-last-accepted-value-and-result" as const,
      enterSubmit: true as const,
      buttonSubmitText: "分解する" as const,
      factorOrder: "ascending" as const,
      multiplicityPreserved: true as const,
      outputFormat: "value = factor × factor ..." as const,
      unreachableFallbackText: "2以上の整数を入力してください。" as const,
      cases: behaviorCases(),
    },
    vNextBinding: {
      toolContentId,
      moduleId: "prime-factorizer" as const,
      componentId: "prime-factorizer-react-v1" as const,
      framework: "react" as const,
      hydration: "visible" as const,
      role: "primary_tool" as const,
      allowedCollections: ["tools"] as const,
      moduleStatus: "active" as const,
      bindingStatus: "active" as const,
      apiVersion: 1 as const,
      budgetClass: "small" as const,
    },
    ...runtime,
    bundleBudget: {
      budgetClass: "small" as const,
      hardThresholdBytes: null,
      status: "measured-threshold-deferred-to-phase12-o7" as const,
    },
    browserTestDecision: {
      frameworkAdded: false as const,
      rationale: "pure state tests plus SSR and built-form validation cover the behavior; native form submit semantics provide Enter and button activation" as const,
    },
    safety: {
      persistentMutationAuthorized: false as const,
      deployWorkflowGate: "if: ${{ false }}" as const,
      phase8Implemented: false as const,
      providerMutationPerformed: false as const,
      productionDeployPerformed: false as const,
      legacyDeletionPerformed: false as const,
    },
  };
  return phase7InteractiveReadinessManifestSchema.parse({ ...payload, manifestPayloadSha256: fingerprint(payload) });
};

export const writePhase7InteractiveReadiness = async (): Promise<Phase7InteractiveReadinessManifest> => {
  const manifest = await buildPhase7InteractiveReadiness();
  await writeFile(phase7InteractiveReadinessPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
};

export const checkPhase7InteractiveReadiness = async (): Promise<Phase7InteractiveReadinessManifest> => {
  const expected = await buildPhase7InteractiveReadiness();
  const committed = phase7InteractiveReadinessManifestSchema.parse(JSON.parse(await readFile(phase7InteractiveReadinessPath, "utf8")) as unknown);
  if (JSON.stringify(committed) !== JSON.stringify(expected)) {
    throw new Error("Committed Phase 7 interactive readiness manifest differs from exact regeneration");
  }
  return committed;
};

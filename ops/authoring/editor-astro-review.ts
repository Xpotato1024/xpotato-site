import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createRequire } from "node:module";
import { mkdtemp, mkdir, readFile, writeFile, appendFile, cp, lstat } from "node:fs/promises";
import { resolve, join, dirname, relative, isAbsolute, extname } from "node:path";
import { pathToFileURL } from "node:url";
import { parse, serialize, type DefaultTreeAdapterTypes as P } from "parse5";
import {
  parseDraft,
  validateDraft,
  collectionFromPath,
  assertEditablePath,
} from "@xpotato/editor-core/draft";
import {
  validateReviewContext,
  reviewArtifactName,
  type EditorReviewBundle,
} from "@xpotato/editor-core/review";
import { collectDemoModuleIds } from "@xpotato/portable-content";
import { articleMediaReferences } from "@xpotato/portable-content/media";
import { candidateAstroConfiguration } from "../../packages/article-pipeline/src/candidate/candidate-astro.js";
const run = promisify(execFile),
  hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const mimeFor = (p: string) =>
  (
    ({
      ".woff2": "font/woff2",
      ".woff": "font/woff",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".ico": "image/x-icon",
      ".jpg": "image/jpeg",
      ".webp": "image/webp",
    }) as Record<string, string>
  )[extname(p)];
export async function inlineReviewAssets(html: string, dist: string): Promise<string> {
  const doc = parse(html);
  let total = Buffer.byteLength(html);
  const maximum = 20 * 1024 * 1024;
  const get = async (url: string, relativeTo = "/") => {
    if (url.startsWith("data:") || url.startsWith("#")) return url;
    const resolvedUrl = new URL(url, "https://editor-preview.invalid" + relativeTo);
    if (resolvedUrl.origin !== "https://editor-preview.invalid")
      throw Error("REVIEW_EXTERNAL_ASSET_REJECTED");
    const file = resolve(dist, "." + decodeURIComponent(resolvedUrl.pathname)),
      within = relative(dist, file);
    if (!within || within.startsWith("..") || isAbsolute(within))
      throw Error("REVIEW_ASSET_PATH_INVALID");
    const info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 8 * 1024 * 1024)
      throw Error("REVIEW_ASSET_INVALID");
    const bytes = await readFile(file);
    total += bytes.length;
    if (total > maximum) throw Error("REVIEW_BUNDLE_TOO_LARGE");
    const mime = mimeFor(file);
    if (!mime) throw Error("REVIEW_ASSET_TYPE_INVALID");
    return "data:" + mime + ";base64," + bytes.toString("base64");
  };
  const css = async (text: string, from: string) => {
    if (/@import\b/iu.test(text)) throw Error("REVIEW_UNRESOLVED_CSS_IMPORT");
    const matches = [...text.matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)/gu)];
    let result = text;
    for (const match of matches.reverse()) {
      const value = await get(match[2]!, from);
      result =
        result.slice(0, match.index!) +
        'url("' +
        value.replaceAll('"', "%22") +
        '")' +
        result.slice(match.index! + match[0].length);
    }
    return result;
  };
  const walk = async (parent: P.ParentNode) => {
    for (const node of [...parent.childNodes]) {
      if (!("tagName" in node)) continue;
      const attr = (name: string) => node.attrs.find((a) => a.name === name)?.value;
      if (
        ["script", "iframe", "object", "embed", "base", "form"].includes(node.tagName) ||
        (node.tagName === "link" && attr("rel") !== "stylesheet")
      ) {
        parent.childNodes.splice(parent.childNodes.indexOf(node), 1);
        continue;
      }
      node.attrs = node.attrs.filter((a) => !/^on/iu.test(a.name));
      if (node.tagName === "link" && attr("rel") === "stylesheet") {
        const href = attr("href")!;
        const url = new URL(href, "https://editor-preview.invalid/");
        if (url.origin !== "https://editor-preview.invalid")
          throw Error("REVIEW_EXTERNAL_STYLESHEET_REJECTED");
        const file = resolve(dist, "." + url.pathname);
        if (!relative(dist, file) || relative(dist, file).startsWith(".."))
          throw Error("REVIEW_ASSET_PATH_INVALID");
        const text = await css(await readFile(file, "utf8"), url.pathname);
        node.tagName = "style";
        node.nodeName = "style";
        node.attrs = [];
        node.childNodes = [{ nodeName: "#text", value: text, parentNode: node }];
      } else if (node.tagName === "style") {
        for (const child of node.childNodes)
          if ("value" in child) child.value = await css(child.value, "/");
      }
      if (node.tagName === "img" || node.tagName === "source") {
        if (attr("data-editor-review-asset"))
          node.attrs = node.attrs.filter((a) => !["src", "srcset"].includes(a.name));
        else {
          const src = attr("src");
          if (src) node.attrs.find((a) => a.name === "src")!.value = await get(src);
          node.attrs = node.attrs.filter((a) => a.name !== "srcset");
        }
      }
      const inline = node.attrs.find((attribute) => attribute.name === "style");
      if (inline) inline.value = await css(inline.value, "/");
      if (node.tagName === "a") {
        node.attrs = node.attrs.filter((a) => !["href", "target", "download"].includes(a.name));
        node.attrs.push({ name: "aria-disabled", value: "true" });
      }
      await walk(node);
    }
  };
  await walk(doc);
  const htmlOut = serialize(doc);
  if (/<script\b|https?:\/\/[^"']+X-Amz-/iu.test(htmlOut))
    throw Error("REVIEW_ACTIVE_OR_CAPABILITY_CONTENT");
  return htmlOut;
}
/** Serialize CSS separately so browser parsing never evaluates a blocked inline style. */
export function separateReviewStyles(html: string): {
  html: string;
  styles: { css: string; sha256: string }[];
} {
  const document = parse(html),
    styles: { css: string; sha256: string }[] = [];
  let generated = 0;
  const add = (css: string) => {
    styles.push({ css, sha256: hash(css) });
  };
  const walk = (parent: P.ParentNode) => {
    for (const node of [...parent.childNodes]) {
      if (!("tagName" in node)) continue;
      if (node.tagName === "style") {
        add(node.childNodes.map((child) => ("value" in child ? child.value : "")).join(""));
        parent.childNodes.splice(parent.childNodes.indexOf(node), 1);
        continue;
      }
      const inline = node.attrs.find((attribute) => attribute.name === "style");
      if (inline) {
        const className = "editor-review-inline-" + ++generated;
        add("." + className + "{" + inline.value + "}");
        node.attrs = node.attrs.filter((attribute) => attribute.name !== "style");
        const existing = node.attrs.find((attribute) => attribute.name === "class");
        if (existing) existing.value += " " + className;
        else node.attrs.push({ name: "class", value: className });
      }
      walk(node);
    }
  };
  walk(document);
  return { html: serialize(document), styles };
}
export async function buildEditorAstroReview(input: {
  repositoryRoot: string;
  sourcePath: string;
  output: string;
  expectedCommit?: string;
}): Promise<{
  artifactName: string;
  bundlePath: string;
  context: EditorReviewBundle["context"];
  bytes: number;
  privateMediaDownloaded: false;
  codeClean: boolean;
}> {
  const repositoryRoot = resolve(input.repositoryRoot),
    output = resolve(input.output);
  assertEditablePath(input.sourcePath);
  if (
    !relative(join(repositoryRoot, ".local"), output) ||
    relative(join(repositoryRoot, ".local"), output).startsWith("..") ||
    isAbsolute(relative(join(repositoryRoot, ".local"), output))
  )
    throw Error("EDITOR_REVIEW_OUTPUT_MUST_BE_PRIVATE");
  const commit = (await run("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot })).stdout.trim();
  if (input.expectedCommit && input.expectedCommit !== commit)
    throw Error("REVIEW_REVISION_MISMATCH");
  const source = (
    await run("git", ["show", commit + ":" + input.sourcePath], {
      cwd: repositoryRoot,
      maxBuffer: 1024 * 1024,
    })
  ).stdout;
  const parsed = parseDraft(source),
    collection = collectionFromPath(input.sourcePath),
    errors = validateDraft(source, collection);
  if (errors.length) throw Error("EDITOR_REVIEW_SOURCE_INVALID: " + errors.join("; "));
  // Inline tool execution has its own admission/interactive QA; a static article review never pretends it ran.
  if (collectDemoModuleIds(parsed.body).length) throw Error("EDITOR_REVIEW_DEMO_REQUIRES_TOOL_QA");
  const context = validateReviewContext({
    schemaVersion: 1,
    contentId: parsed.data.id,
    commit,
    sourcePath: input.sourcePath,
    sourceSha256: hash(source),
    scope: "public-git-draft",
    productionEligible: false,
  });
  const scratch = join(repositoryRoot, "apps/site/.local/editor-astro-reviews");
  await mkdir(scratch, { recursive: true });
  const root = await mkdtemp(join(scratch, "review-"));
  await mkdir(join(root, "src/pages"), { recursive: true });
  await mkdir(join(root, "src/input"), { recursive: true });
  const target = join(root, "src/input/article.mdx");
  await writeFile(target, source, { mode: 0o600 });
  await cp(join(repositoryRoot, "apps/site/public"), join(root, "public"), {
    recursive: true,
    errorOnExist: true,
  });
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({ name: "xpotato-editor-astro-review", private: true, type: "module" }),
  );
  await writeFile(join(root, "src/content.config.ts"), "export const collections = {};\n");
  await writeFile(
    join(root, "astro.config.mjs"),
    candidateAstroConfiguration(
      repositoryRoot,
      "https://xpotato.net/articles/" + parsed.data.id + "/",
    ),
  );
  const file = (value: string) => JSON.stringify(join(repositoryRoot, value).replaceAll("\\", "/"));
  const page =
    "---\nimport Content,{getHeadings} from " +
    JSON.stringify(target.replaceAll("\\", "/")) +
    ";\nimport ContentLayout from " +
    file("apps/site/src/shared/layouts/ContentLayout.astro") +
    ";\nimport {contentComponents} from " +
    file("apps/site/src/shared/content/index.ts") +
    ";\nimport {selectTableOfContents} from " +
    file("apps/site/src/shared/blocks/transforms/table-of-contents.ts") +
    ";\nconst metadata=" +
    JSON.stringify(parsed.data) +
    ";\nconst review=" +
    JSON.stringify(context) +
    ";\n---\n<ContentLayout id={metadata.id} collection=" +
    JSON.stringify(collection) +
    " title={metadata.title} description={metadata.description} seo={{noindex:true}} editorReview={review} headings={selectTableOfContents(getHeadings()," +
    JSON.stringify(parsed.body) +
    ")}><Content components={contentComponents}/></ContentLayout>\n";
  await writeFile(join(root, "src/pages/index.astro"), page, { mode: 0o600 });
  const require = createRequire(join(repositoryRoot, "apps/site/package.json")),
    astroRoot = dirname(require.resolve("astro/package.json")),
    pkg = JSON.parse(await readFile(join(astroRoot, "package.json"), "utf8"));
  try {
    const result = await run(
      process.execPath,
      [join(astroRoot, pkg.bin.astro), "build", "--root", root],
      {
        cwd: repositoryRoot,
        timeout: 180000,
        maxBuffer: 4 * 1024 * 1024,
        env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1", XPOTATO_EDITOR_REVIEW_BUILD: "1" },
      },
    );
    await writeFile(join(root, "build.log"), result.stdout + "\n" + result.stderr);
  } catch (error) {
    const details = error as { stdout?: string; stderr?: string };
    await writeFile(
      join(root, "build.log"),
      (details.stdout ?? "") + "\n" + (details.stderr ?? ""),
    );
    throw Error("EDITOR_ASTRO_BUILD_FAILED: " + join(root, "build.log"));
  }
  const { html, styles } = separateReviewStyles(
    await inlineReviewAssets(
      await readFile(join(root, "output/index.html"), "utf8"),
      join(root, "output"),
    ),
  );
  if (!html.includes("xpotato-private-draft-preview-v1")) throw Error("REVIEW_MARKER_REQUIRED");
  const codeClean =
    (
      await run("git", ["status", "--porcelain", "--untracked-files=no"], { cwd: repositoryRoot })
    ).stdout.trim() === "";
  const bundle: EditorReviewBundle & { codeClean: boolean } = {
    schemaVersion: 1,
    protocol: "editor-astro-review-v1",
    context,
    html,
    htmlSha256: hash(html),
    styles,
    assetIds: [...articleMediaReferences(parsed.body)],
    builtAt: new Date().toISOString(),
    runtime: "static-display-only",
    containsPrivateMedia: false,
    codeClean,
  };
  await mkdir(output, { recursive: true });
  const bundlePath = join(output, "review.json");
  await writeFile(bundlePath, JSON.stringify(bundle) + "\n", { flag: "wx", mode: 0o600 });
  await writeFile(
    join(output, ".private-draft-preview"),
    "xpotato-private-draft-preview-v1\neditor-layout;productionEligible=false\n",
    { mode: 0o600 },
  );
  return {
    artifactName: reviewArtifactName(commit, parsed.data.id),
    bundlePath,
    context,
    bytes: (await lstat(bundlePath)).size,
    privateMediaDownloaded: false,
    codeClean,
  };
}

export async function writeEditorReviewOutput(
  result: Awaited<ReturnType<typeof buildEditorAstroReview>>,
  outputFile: string,
): Promise<void> {
  const context = validateReviewContext(result.context);
  const expectedName = reviewArtifactName(context.commit, context.contentId);
  if (
    result.artifactName !== expectedName ||
    result.privateMediaDownloaded !== false ||
    result.codeClean !== true
  ) {
    throw Error("EDITOR_REVIEW_OUTPUT_INVALID");
  }
  await appendFile(outputFile, "artifact-name=" + expectedName + "\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2),
    option = (key: string) => {
      const index = args.indexOf(key);
      return index < 0 ? undefined : args[index + 1];
    };
  const sourcePath = option("--source");
  if (!sourcePath)
    throw Error(
      "Usage: npm run editor:review -- --source content/articles/<id>.mdx --output .local/editor-review/<id> [--commit SHA] [--github-output PATH]",
    );
  const expectedCommit = option("--commit");
  const result = await buildEditorAstroReview({
    repositoryRoot: resolve("."),
    sourcePath,
    output: option("--output") ?? ".local/editor-review/" + Date.now(),
    ...(expectedCommit ? { expectedCommit } : {}),
  });
  const githubOutput = option("--github-output");
  if (githubOutput) {
    await writeEditorReviewOutput(result, githubOutput);
  }
  console.log(JSON.stringify(result));
}

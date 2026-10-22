import { browserToolManifestSchema, browserToolPinSchema, browserToolReviewSchema,
  isPrimeAsyncManifest, type BrowserToolManifest, type BrowserToolPin, type BrowserToolReview } from "@xpotato/content-contracts";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstat, readFile, readdir, mkdir, rename, rm, writeFile, open } from "node:fs/promises";
import { dirname, join, parse, resolve, normalize } from "node:path";
import ts from "typescript";

export const toolHash = (bytes: string | Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
export const toolTreeHash = (files: ReadonlyMap<string, Uint8Array>): string =>
  toolHash(JSON.stringify([...files].sort(([a], [b]) => a.localeCompare(b, "en")).map(([path, bytes]) => [path, bytes.length, toolHash(bytes)])));
const fail = (message: string): never => { throw new Error(message); };
export async function noToolLinks(path: string): Promise<void> {
  const absolute = resolve(path), root = parse(absolute).root;
  let current = root;
  for (const part of absolute.slice(root.length).split(/[\\/]/u).filter(Boolean)) {
    current = join(current, part);
    const info = await lstat(current);
    if (info.isSymbolicLink() || (info.isFile() && info.nlink !== 1)) fail("Tool path links are forbidden");
  }
}
async function snapshot(root: string): Promise<Map<string, Buffer>> {
  await noToolLinks(root);
  const result = new Map<string, Buffer>();
  async function walk(relative: string): Promise<void> {
    for (const name of (await readdir(join(root, relative))).sort()) {
      const path = relative ? relative + "/" + name : name;
      if (!/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/u.test(path) || path.split("/").some(p => p === ".." || p === ".")) fail("Unsafe tool path");
      const absolute = join(root, path), info = await lstat(absolute);
      if (info.isSymbolicLink()) fail("Tool symlink is forbidden");
      if (info.isDirectory()) await walk(path);
      else {
        if (!info.isFile() || info.nlink !== 1 || info.size > 2_000_000) fail("Invalid tool file");
        result.set(path, await readFile(absolute));
        if (result.size > 101 || [...result.values()].reduce((sum, bytes) => sum + bytes.length, 0) > 8_000_000) fail("Tool artifact too large");
      }
    }
  }
  await walk("");
  const folded = [...result.keys()].map(path => path.toLowerCase());
  if (new Set(folded).size !== folded.length) fail("Case-colliding tool paths");
  return result;
}
const json = (bytes: Uint8Array | undefined): unknown => {
  if (!bytes) return fail("Missing tool metadata");
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
};
const exactPeers = (input:unknown):boolean => !!input && typeof input==="object" && Object.keys(input).length===2 && (input as Record<string,unknown>).react==="19.2.8" && (input as Record<string,unknown>)["react-dom"]==="19.2.8";
function checkPackage(bytes: Uint8Array | undefined, manifest: BrowserToolManifest): string {
  const pkg = json(bytes) as Record<string, unknown>;
  if (pkg.type !== "module" || pkg.version !== manifest.version || pkg.name !== "@xpotato-tool/" + manifest.toolId
    || pkg.main !== "./" + manifest.integration.entry || JSON.stringify(pkg.exports) !== JSON.stringify({ ".": "./" + manifest.integration.entry })
    || !exactPeers(pkg.peerDependencies)
    || Object.keys((pkg.dependencies ?? {}) as object).length || pkg.scripts || pkg.optionalDependencies
    || pkg.bundledDependencies || pkg.browser || pkg.imports) fail("Invalid release package/React peer contract");
  return String(pkg.name);
}
const forbidden = new Set(["fetch","XMLHttpRequest","WebSocket","EventSource","sendBeacon","navigator","window","globalThis","self",
  "document","location","localStorage","sessionStorage","indexedDB","caches","Worker","SharedWorker","ServiceWorker","WebAssembly",
  "setTimeout","setInterval","Image","Audio","RTCPeerConnection","WebTransport","BroadcastChannel","dangerouslySetInnerHTML","innerHTML","outerHTML","insertAdjacentHTML","importScripts","eval","Function","require","open","constructor","__proto__","Reflect"]);
function checkRuntime(files: ReadonlyMap<string, Buffer>, manifest: BrowserToolManifest): void {
  const entry = manifest.integration.entry;
  const prime=isPrimeAsyncManifest(manifest);
  const extraLicenses=manifest.license.additional??[];
  const asyncForbidden=new Set(["Image","Audio","BroadcastChannel","fetch","XMLHttpRequest","WebSocket","EventSource","sendBeacon","location","localStorage","sessionStorage","indexedDB","caches","SharedWorker","ServiceWorker","importScripts","eval","Function","require","dangerouslySetInnerHTML","innerHTML","outerHTML","insertAdjacentHTML","RTCPeerConnection","WebTransport"]);
  if (!entry.endsWith(".mjs")) fail("Release entry must be ESM .mjs");
  const visited = new Set<string>();
  function visit(path: string): void {
    if (visited.has(path)) return;
    visited.add(path);
    const bytes = files.get(path);
    if (!bytes || !path.endsWith(".mjs")) fail("Missing local ESM dependency");
    const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    if ((ast as unknown as { parseDiagnostics: readonly unknown[] }).parseDiagnostics.length) fail("Invalid release JavaScript");
    if(path===entry && !ast.statements.some(statement => ts.isExportAssignment(statement)
      || (ts.canHaveModifiers(statement) && ts.getModifiers(statement)?.some(modifier=>modifier.kind===ts.SyntaxKind.DefaultKeyword))))
      fail("React release entry requires direct default export");
    function node(value: ts.Node): void {
      if(prime&&ts.isCallExpression(value)&&((ts.isIdentifier(value.expression)&&value.expression.text==="open")||(ts.isPropertyAccessExpression(value.expression)&&value.expression.name.text==="open")))fail("Popup/navigation API forbidden");
      if (ts.isIdentifier(value) && (prime?asyncForbidden:forbidden).has(value.text)) fail("Disallowed browser API: " + value.text);
      if (!prime && (ts.isElementAccessExpression(value) || (ts.isCallExpression(value) && value.expression.kind === ts.SyntaxKind.ImportKeyword)))
        fail("Computed property/dynamic import is not admitted by initial source policy");
      if ((ts.isImportDeclaration(value) || ts.isExportDeclaration(value)) && value.moduleSpecifier) {
        if (!ts.isStringLiteral(value.moduleSpecifier)) fail("Nonliteral module");
        const spec = (value.moduleSpecifier as ts.StringLiteral).text;
        if (spec === "react" || spec === "react-dom") { /* exact site peers */ }
        else {
          if(prime){
            if(!/^\.\.?\/[a-zA-Z0-9._/-]+\.mjs$/u.test(spec))fail("Unadmitted async module import");
            const target=normalize(join(dirname(path),spec)).replaceAll("\\","/");
            if(target.startsWith("../")||target.startsWith("/"))fail("Async module escape");
            visit(target);
          }else{
            if (!/^\.\/[a-zA-Z0-9._/-]+\.mjs$/u.test(spec) || spec.split("/").includes("..")) fail("Unadmitted module import");
            visit((dirname(path) === "." ? "" : dirname(path) + "/") + spec.slice(2));
          }
        }
      }
      if(prime&&ts.isCallExpression(value)&&value.expression.kind===ts.SyntaxKind.ImportKeyword){
        const a=value.arguments[0];if(value.arguments.length!==1||!a||!ts.isStringLiteral(a)||!/^\.\.?\/[a-zA-Z0-9._/-]+\.mjs$/u.test(a.text))fail("Nonliteral/remote async import");
        const target=normalize(join(dirname(path),(a as ts.StringLiteral).text)).replaceAll("\\","/");if(target.startsWith("../")||target.startsWith("/"))fail("Async import escape");visit(target);
      }
      if(prime&&ts.isVariableDeclaration(value)&&ts.isIdentifier(value.name)&&/^(?:.*WORKER_SOURCE|STAGED_SOURCE)$/u.test(value.name.text)&&value.initializer&&ts.isStringLiteral(value.initializer)){
        const embedded=ts.createSourceFile(path+"#worker",value.initializer.text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
        if((embedded as unknown as {parseDiagnostics:readonly unknown[]}).parseDiagnostics.length)fail("Embedded worker syntax");
        node(embedded);
      }
      ts.forEachChild(value, node);
    }
    node(ast);
    if (/sourceMappingURL|sourceURL/u.test(source)) fail("Source maps are forbidden");
  }
  visit(entry);
  for (const path of files.keys()) {
    if (path.endsWith(".mjs") && !visited.has(path)) fail("Unreachable executable in release");
    if (path.endsWith(".css")) {
      if (!manifest.integration.styles.includes(path)) fail("Unlisted stylesheet");
      const css = new TextDecoder("utf-8", { fatal: true }).decode(files.get(path)!);
      if (/[@\\+~]|url\s*\(|\/\*/iu.test(css)) fail("CSS imports/URLs/escapes/comments not admitted");
      const blocks = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/gu)];
      if (!blocks.length || css.replace(/([^{}]+)\{([^{}]*)\}/gu, "").trim()) fail("Unsupported CSS grammar");
      for (const block of blocks) for (const selector of block[1]!.split(",")) {
        if (!selector.trim().startsWith(".bt-" + manifest.toolId + " ") && selector.trim() !== ".bt-" + manifest.toolId)
          fail("Unscoped tool CSS");
      }
    } else if (!path.endsWith(".mjs") && !["package.json", "browser-tool.json", manifest.license.file, manifest.license.notice,...extraLicenses].includes(path))
      fail("Unadmitted distributed file type");
  }
}
export async function inspectToolArtifact(root: string): Promise<{manifest: BrowserToolManifest; files: Map<string, Buffer>; packageName: string; manifestSha256: string; artifactSha256: string}> {
  const files = await snapshot(root);
  const manifest = browserToolManifestSchema.parse(json(files.get("browser-tool.json")));
  const listed = manifest.files.map(file => file.path).sort();
  if (new Set(listed).size !== listed.length || JSON.stringify(listed) !== JSON.stringify([...files.keys()].filter(path => path !== "browser-tool.json").sort()))
    fail("Release file exact-set mismatch");
  for (const file of manifest.files) {
    const bytes = files.get(file.path)!;
    if (file.bytes !== bytes.length || file.sha256 !== toolHash(bytes)) fail("Release file hash/size mismatch: " + file.path);
  }
  for (const path of [manifest.integration.entry, ...manifest.integration.styles, manifest.license.file, manifest.license.notice,...(manifest.license.additional??[])])
    if (!files.has(path)) fail("Missing declared release file");
  for (const path of [manifest.license.file, manifest.license.notice,...(manifest.license.additional??[])])
    if (!files.get(path)!.length) fail("Empty license/notice");
  const packageName = checkPackage(files.get("package.json"), manifest);
  checkRuntime(files, manifest);
  return { manifest, files, packageName, manifestSha256: toolHash(files.get("browser-tool.json")!), artifactSha256: toolTreeHash(files) };
}
export async function inspectToolSource(root: string, commit: string, expectedNode = "24.19.0"): Promise<{sourceTreeSha256: string; lockSha256: string; files: Map<string, Buffer>}> {
  await noToolLinks(root);
  if (!/^[a-f0-9]{40}$/u.test(commit)) fail("Exact 40-character source commit required");
  const git = (...args: string[]): Buffer => execFileSync("git", ["-c","core.fsmonitor=false","-C", root, ...args], { maxBuffer: 10_000_000, env: {...process.env, GIT_OPTIONAL_LOCKS:"0",GIT_NO_REPLACE_OBJECTS:"1"} });
  if (git("rev-parse", "--show-prefix").toString().trim() !== "" || git("rev-parse","HEAD").toString().trim() !== commit
    || git("status","--porcelain","--untracked-files=all").length) fail("Source must be a clean independent checkout at exact commit");
  const files = new Map<string, Buffer>();
  for (const record of git("ls-tree","-rz","--full-tree",commit).toString().split("\0").filter(Boolean)) {
    const [meta, path] = record.split("\t"), [mode, type, blob] = meta!.split(" ");
    if (!path || type !== "blob" || !["100644","100755"].includes(mode!)) fail("Source links/submodules forbidden");
    await noToolLinks(join(root,path!));
    const bytes = git("cat-file","blob",blob!);
    if (!(await readFile(join(root,path!))).equals(bytes)) fail("Source checkout bytes differ from pinned Git blob");
    files.set(path!,bytes);
  }
  const lock = files.get("package-lock.json"), pkg = json(files.get("package.json")) as Record<string, unknown>;
  const lockData = json(lock) as {lockfileVersion:number; packages:Record<string,Record<string,unknown>>};
  if (lockData.lockfileVersion !== 3 || !exactPeers(lockData.packages[""]?.peerDependencies)
    || !exactPeers(pkg.peerDependencies)) fail("Source lock/peer contract mismatch");
  if(pkg.version !== lockData.packages[""]?.version || pkg.name !== lockData.packages[""]?.name
    || files.get(".node-version")?.toString().trim()!==expectedNode || files.get(".npm-version")?.toString().trim()!=="11.19.0")
    fail("Source package/lock/toolchain mismatch");
  return {sourceTreeSha256:toolTreeHash(files), lockSha256:toolHash(lock!), files};
}
export async function verifyToolCandidate(input: {sourceRoot:string; artifactRoot:string; review:unknown}): Promise<{pinFields: Omit<BrowserToolPin,"releaseId">; files:Map<string,Buffer>}> {
  const review = browserToolReviewSchema.parse(input.review);
  if ((review.source.kind === "local-fixture") !== (review.review.scope === "fixture-only")) fail("Fixture/review scope mismatch");
  if (review.source.kind === "github") {
    const origin = execFileSync("git",["-C",input.sourceRoot,"remote","get-url","origin"],{encoding:"utf8"}).trim().replace(/\.git$/u,"");
    if(origin !== review.source.repository) fail("Source origin does not match reviewed GitHub repository");
  }
  const artifact = await inspectToolArtifact(input.artifactRoot);
  if(isPrimeAsyncManifest(artifact.manifest)&&(review.source.kind!=="github"||review.source.repository!=="https://github.com/Xpotato1024/browser-prime-toolkit"))fail("Dedicated prime source repository required");
  const source = await inspectToolSource(input.sourceRoot,review.sourceCommit,isPrimeAsyncManifest(artifact.manifest)?"24.22.1":"24.19.0");
  for (const key of ["sourceTreeSha256","lockSha256"] as const) if (source[key] !== review[key]) fail("Source/review hash mismatch");
  for (const key of ["manifestSha256","artifactSha256"] as const) if (artifact[key] !== review[key]) fail("Artifact/review hash mismatch");
  if(review.reproducibleArtifactSha256.some(hash=>hash!==artifact.artifactSha256)) fail("Two clean build artifact hashes must equal release");
  const sourcePackage=json(source.files.get("package.json")) as Record<string,unknown>;
  if(sourcePackage.name!==artifact.packageName || sourcePackage.version!==artifact.manifest.version || sourcePackage.license!==artifact.manifest.license.spdx)
    fail("Release package identity/license differs from source");
  for (const path of [artifact.manifest.license.file,artifact.manifest.license.notice,...(artifact.manifest.license.additional??[])])
    if (!source.files.get(path)?.equals(artifact.files.get(path)!)) fail("Release license/notice differs from reviewed source");
  return {pinFields:{schemaVersion:1,toolId:artifact.manifest.toolId,packageName:artifact.packageName,source:review.source,
    sourceCommit:review.sourceCommit,sourceTreeSha256:source.sourceTreeSha256,lockSha256:source.lockSha256,
    manifestSha256:artifact.manifestSha256,artifactSha256:artifact.artifactSha256,reviewSha256:toolHash(JSON.stringify(review))},files:artifact.files};
}
export async function adoptToolRelease(input: {vendorRoot:string; sourceRoot:string; artifactRoot:string; review:BrowserToolReview; releaseId:string}): Promise<BrowserToolPin> {
  const candidate = await verifyToolCandidate(input), pin = browserToolPinSchema.parse({...candidate.pinFields,releaseId:input.releaseId});
  await noToolLinks(input.vendorRoot);
  const parent = join(input.vendorRoot,pin.toolId);
  await mkdir(parent,{recursive:true}); await noToolLinks(parent);
  const target = join(parent,pin.releaseId), stage = join(parent,".stage-"+randomUUID());
  const lock = await open(join(parent,".adoption-lock"),"wx");
  try {
    try {
      await lstat(target);
      const existing = await inspectToolArtifact(target);
      if (existing.artifactSha256 !== pin.artifactSha256) fail("Immutable release ID already exists with different bytes");
      return pin;
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    await mkdir(stage);
    for (const [path,bytes] of candidate.files) {await mkdir(dirname(join(stage,path)),{recursive:true});await writeFile(join(stage,path),bytes,{flag:"wx"});}
    await inspectToolArtifact(stage);
    await rename(stage,target);
    return pin;
  } finally {await rm(stage,{recursive:true,force:true});await lock.close();await rm(join(parent,".adoption-lock"));}
}
export async function verifyToolPin(vendorRoot:string,pinInput:unknown): Promise<BrowserToolManifest> {
  const pin = browserToolPinSchema.parse(pinInput);
  const artifact = await inspectToolArtifact(join(vendorRoot,pin.toolId,pin.releaseId));
  if(isPrimeAsyncManifest(artifact.manifest)&&(pin.source.kind!=="github"||pin.source.repository!=="https://github.com/Xpotato1024/browser-prime-toolkit"))fail("Dedicated prime pin source required");
  if (artifact.manifest.toolId !== pin.toolId || artifact.packageName !== pin.packageName || artifact.manifestSha256 !== pin.manifestSha256
    || artifact.artifactSha256 !== pin.artifactSha256) fail("Vendor bytes do not match pin");
  return artifact.manifest;
}
export async function selectToolRelease(vendorRoot:string,pins:readonly BrowserToolPin[],toolId:string,releaseId:string,fixtureOnly=false): Promise<BrowserToolPin> {
  const matches = pins.filter(pin=>pin.toolId===toolId && pin.releaseId===releaseId);
  if (matches.length!==1) fail("Unknown/duplicate release selection");
  const pin = matches[0]!;
  if (pin.source.kind==="local-fixture" && !fixtureOnly) fail("Synthetic fixture cannot enter public selection");
  await verifyToolPin(vendorRoot,pin);
  return pin; // caller reviews and commits explicit registry/file dependency/import changes; no automatic mutation
}

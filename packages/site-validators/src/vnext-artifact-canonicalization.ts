import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parse } from "parse5";
import { interactiveModuleRegistry, toolBindings } from "../../../apps/site/src/content-registry/interactive/index.js";
import { manifestFromDist } from "./deploy-artifact-manifest.js";

const sha256 = (bytes: string | Buffer): string => createHash("sha256").update(bytes).digest("hex");
const targetPath = "tools/prime-factorizer/index.html";
const targetRoute = "/tools/prime-factorizer/";

export interface CanonicalProfile {
  readonly id: string;
  readonly versions: Readonly<Record<string, string>>;
  readonly openingTagWithoutUid: string;
  readonly pageWithoutUidSha256: string;
  readonly childrenSha256: string;
  readonly assets: Readonly<Record<string, string>>;
  readonly runtimeSources: Readonly<Record<string, string>>;
}

export const vnextProfile: CanonicalProfile = Object.freeze({
  id: "vnext-prime-factorizer-astro7-react6-v1",
  versions: Object.freeze({
    astro: "7.2.7",
    "@astrojs/react": "6.0.4",
    react: "19.2.8",
    "react-dom": "19.2.8",
  }),
  openingTagWithoutUid: '<astro-island uid="{UID}" prefix="r1" component-url="/_astro/PrimeFactorizer.B0vyJ8Ra.js" component-export="default" renderer-url="/_astro/client.XHtoj3W1.js" props="{}" ssr client="visible" opts="{&quot;name&quot;:&quot;PrimeFactorizer&quot;,&quot;value&quot;:true}" await-children>',
  pageWithoutUidSha256: "7e95e4e56930bca9c8568dcf6f7f70cd5673cf10866edf537d774d43c1adddbe",
  childrenSha256: "b7a8e35f7b3f4e7f1d5851a2cfec111ae1659588a16f6cb2e68a64c48362e6ad",
  assets: Object.freeze({
    "/_astro/PrimeFactorizer.B0vyJ8Ra.js": "0d67876b2da0dc09dbf342518a48926450057c63b087b41d23095d1c314ecf95",
    "/_astro/client.XHtoj3W1.js": "31f92e1749166bf3b0a07a83d09aea2076037eaa20ac9b1e251a67ff28efcf03",
  }),
  runtimeSources: Object.freeze({
    "apps/site/node_modules/astro/dist/runtime/server/render/component.js": "88cd90641fe8e7ba12afe91f31b5ef95eb70048459ed85ef8010f47d53cf653a",
    "apps/site/node_modules/astro/dist/runtime/server/hydration.js": "86824502280c55496eda9ae9929307c1f51e527f4b9f7e63f1d1fc5216a9793d",
    "apps/site/node_modules/astro/dist/runtime/server/astro-island.js": "01097c0fb7754fad01b4f298f98e1d6d2776fabc08d9987e6b492a4325f895e1",
    "node_modules/@astrojs/react/dist/client.js": "a6723c674206ab2aafea5cd5d42b4791bdd196bad5a18e5091b624bf5a5cbaf6",
  }),
});

type SourceLocation = { startOffset: number; endOffset: number };
type ElementLocation = SourceLocation & {
  startTag?: SourceLocation & { attrs?: Record<string, SourceLocation> };
  endTag?: SourceLocation;
};
type LocatedNode = {
  tagName?: string;
  attrs?: { name: string; value: string }[];
  childNodes?: LocatedNode[];
  content?: LocatedNode;
  sourceCodeLocation?: ElementLocation;
};

const islandsIn = (html: string): LocatedNode[] => {
  const result: LocatedNode[] = [];
  const visit = (node: LocatedNode): void => {
    if (node.tagName === "astro-island") result.push(node);
    for (const child of node.childNodes ?? []) visit(child);
    if (node.content) visit(node.content);
  };
  visit(parse(html, { sourceCodeLocationInfo: true }) as unknown as LocatedNode);
  return result;
};

export const assertProfileVersions = (
  actual: Readonly<Record<string, string>>,
  profile: CanonicalProfile = vnextProfile,
): void => {
  for (const [name, expected] of Object.entries(profile.versions)) {
    if (actual[name] !== expected) throw new Error("UNREVIEWED_RUNTIME_VERSION: " + name);
  }
};

const expectedAttributes = Object.freeze({
  prefix: "r1",
  "component-url": "/_astro/PrimeFactorizer.B0vyJ8Ra.js",
  "component-export": "default",
  "renderer-url": "/_astro/client.XHtoj3W1.js",
  props: "{}",
  ssr: "",
  client: "visible",
  opts: '{"name":"PrimeFactorizer","value":true}',
  "await-children": "",
});

export interface CanonicalizationProof {
  readonly output: Buffer;
  readonly rawHtmlSha256: string;
  readonly canonicalHtmlSha256: string;
  readonly rawUid: string;
  readonly canonicalUid: string;
  readonly uidByteStart: number;
  readonly uidByteEnd: number;
  readonly changedOnlyUidValue: true;
}

export const canonicalizePrimeFactorizerHtml = (
  raw: Buffer,
  actualVersions: Readonly<Record<string, string>>,
  observedAssets: Readonly<Record<string, string>>,
  profile: CanonicalProfile = vnextProfile,
): CanonicalizationProof => {
  assertProfileVersions(actualVersions, profile);
  const html = raw.toString("utf8");
  if (!Buffer.from(html, "utf8").equals(raw)) throw new Error("Invalid UTF-8 HTML");
  const islands = islandsIn(html);
  if (islands.length !== 1) throw new Error("UNEXPECTED_ISLAND: expected one Tool island");
  const island = islands[0];
  const location = island?.sourceCodeLocation;
  const start = location?.startTag;
  const end = location?.endTag;
  const uidLocation = start?.attrs?.uid;
  if (!island || !start || !end || !uidLocation) throw new Error("Missing island source location");

  const attributes = island.attrs ?? [];
  if (attributes.length !== Object.keys(expectedAttributes).length + 1) {
    throw new Error("Unexpected island attribute count");
  }
  const observed = new Map(attributes.map((attribute) => [attribute.name, attribute.value]));
  if (observed.size !== attributes.length || !observed.has("uid")) throw new Error("Ambiguous island attributes");
  for (const [name, expected] of Object.entries(expectedAttributes)) {
    if (observed.get(name) !== expected) throw new Error("Unexpected island attribute: " + name);
  }

  const rawAttribute = html.slice(uidLocation.startOffset, uidLocation.endOffset);
  const match = /^uid="([A-Za-z0-9-]{1,80})"$/u.exec(rawAttribute);
  if (!match?.[1]) throw new Error("Ambiguous UID value range");
  const rawUid = match[1];
  const valueStart = uidLocation.startOffset + 'uid="'.length;
  const valueEnd = valueStart + rawUid.length;
  const openingTag = html.slice(start.startOffset, start.endOffset);
  const openingWithoutUid = html.slice(start.startOffset, valueStart) + "{UID}" + html.slice(valueEnd, start.endOffset);
  if (openingWithoutUid !== profile.openingTagWithoutUid || !openingTag.startsWith("<astro-island ")) {
    throw new Error("Unexpected island opening tag");
  }
  const children = html.slice(start.endOffset, end.startOffset);
  const childrenSha256 = sha256(children);
  if (childrenSha256 !== profile.childrenSha256) throw new Error("Unexpected SSR children");
  const normalizedPage = html.slice(0, valueStart) + "{UID}" + html.slice(valueEnd);
  if (sha256(normalizedPage) !== profile.pageWithoutUidSha256) {
    throw new Error("Unexpected non-UID page bytes");
  }
  for (const [asset, expected] of Object.entries(profile.assets)) {
    if (observedAssets[asset] !== expected) throw new Error("Unexpected asset bytes: " + asset);
  }
  if (Object.keys(observedAssets).length !== Object.keys(profile.assets).length) {
    throw new Error("Unexpected asset inventory");
  }

  const canonicalInput = JSON.stringify([
    profile.id,
    targetRoute,
    0,
    observed.get("component-url"),
    observed.get("component-export"),
    observed.get("renderer-url"),
    observed.get("client"),
    observed.get("props"),
    childrenSha256,
  ]);
  const canonicalUid = "xpv1-" + sha256("xpotato-vnext-uid-v1\0" + canonicalInput);
  const uidByteStart = Buffer.byteLength(html.slice(0, valueStart), "utf8");
  const uidByteEnd = Buffer.byteLength(html.slice(0, valueEnd), "utf8");
  const output = Buffer.concat([
    raw.subarray(0, uidByteStart),
    Buffer.from(canonicalUid, "ascii"),
    raw.subarray(uidByteEnd),
  ]);
  const restored = Buffer.concat([
    output.subarray(0, uidByteStart),
    Buffer.from(rawUid, "ascii"),
    output.subarray(uidByteStart + canonicalUid.length),
  ]);
  if (!restored.equals(raw)) throw new Error("Non-UID byte mutation");
  return {
    output,
    rawHtmlSha256: sha256(raw),
    canonicalHtmlSha256: sha256(output),
    rawUid,
    canonicalUid,
    uidByteStart,
    uidByteEnd,
    changedOnlyUidValue: true,
  };
};

const readJson = async (path: string): Promise<Record<string, unknown>> =>
  JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;

export const assertVnextEnvironment = async (root: string): Promise<Readonly<Record<string, string>>> => {
  const app = await readJson(join(root, "apps/site/package.json"));
  const lock = await readJson(join(root, "package-lock.json"));
  const declared = app.dependencies as Record<string, string>;
  const lockPackages = lock.packages as Record<string, { version: string }>;
  const locations: Record<string, string> = {
    astro: "apps/site/node_modules/astro",
    "@astrojs/react": "node_modules/@astrojs/react",
    react: "apps/site/node_modules/react",
    "react-dom": "apps/site/node_modules/react-dom",
  };
  const actual: Record<string, string> = {};
  for (const [name, location] of Object.entries(locations)) {
    const installed = await readJson(join(root, location, "package.json"));
    const version = installed.version;
    if (typeof version !== "string" || declared[name] !== version || lockPackages[location]?.version !== version) {
      throw new Error("UNREVIEWED_RUNTIME_VERSION: " + name);
    }
    actual[name] = version;
  }
  assertProfileVersions(actual);
  for (const [path, expected] of Object.entries(vnextProfile.runtimeSources)) {
    if (sha256(await readFile(join(root, path))) !== expected) {
      throw new Error("UNREVIEWED_RUNTIME_VERSION: source " + path);
    }
  }
  const record = interactiveModuleRegistry["prime-factorizer"];
  if (record.framework !== "react" || record.componentId !== "prime-factorizer-react-v1" ||
      record.hydration !== "visible" || record.status !== "active" ||
      record.allowedCollections.length !== 1 || record.allowedCollections[0] !== "tools") {
    throw new Error("Unexpected Interactive Registry record");
  }
  if (toolBindings.length !== 1 || toolBindings[0]?.contentId !== "bca48f98-c89a-457f-84d8-168f941fe469" ||
      toolBindings[0]?.moduleId !== "prime-factorizer" || toolBindings[0]?.status !== "active") {
    throw new Error("Unexpected Interactive Registry Tool binding");
  }
  const renderer = await readFile(join(root, "apps/site/src/components/interactive-renderers/PrimeFactorizerVisible.astro"), "utf8");
  const imports = await readFile(join(root, "apps/site/src/content-registry/interactive/component-imports.ts"), "utf8");
  if (!renderer.includes('<PrimeFactorizer client:visible />') ||
      !imports.includes('"prime-factorizer-react-v1": Object.freeze({') ||
      !imports.includes("visible: PrimeFactorizerVisible")) {
    throw new Error("Unexpected React hydration renderer binding");
  }
  return actual;
};

const observedAssetHashes = async (dist: string, profile: CanonicalProfile): Promise<Record<string, string>> => {
  const observed: Record<string, string> = {};
  for (const asset of Object.keys(profile.assets)) {
    if (!asset.startsWith("/_astro/") || asset.includes("..")) throw new Error("Unsafe profile asset path");
    observed[asset] = sha256(await readFile(join(dist, asset.slice(1))));
  }
  return observed;
};

const assertNoOtherIslands = async (dist: string): Promise<void> => {
  const manifest = await manifestFromDist(dist);
  for (const file of manifest.files) {
    if (!file.relativePath.endsWith(".html") || file.relativePath === targetPath) continue;
    if (islandsIn(await readFile(join(dist, file.relativePath), "utf8")).length !== 0) {
      throw new Error("UNEXPECTED_ISLAND: " + file.relativePath);
    }
  }
};

export interface CanonicalizationEvidence {
  readonly profileId: string;
  readonly route: string;
  readonly rawAstroOutputSha256: string;
  readonly canonicalPreSearchOutputSha256: string;
  readonly rawHtmlSha256: string;
  readonly canonicalHtmlSha256: string;
  readonly rawUid: string;
  readonly canonicalUid: string;
  readonly changedOnlyUidValue: true;
}

export const canonicalizeProductionDist = async (repositoryRoot: string): Promise<CanonicalizationEvidence> => {
  const root = resolve(repositoryRoot);
  const dist = join(root, "apps/site/dist");
  const versions = await assertVnextEnvironment(root);
  await assertNoOtherIslands(dist);
  const rawTree = await manifestFromDist(dist);
  const htmlPath = join(dist, targetPath);
  const proof = canonicalizePrimeFactorizerHtml(
    await readFile(htmlPath), versions, await observedAssetHashes(dist, vnextProfile),
  );
  await writeFile(htmlPath, proof.output);
  if (!((await readFile(htmlPath)).equals(proof.output))) throw new Error("Canonicalized HTML read-back mismatch");
  const canonicalTree = await manifestFromDist(dist);
  return {
    profileId: vnextProfile.id,
    route: targetRoute,
    rawAstroOutputSha256: rawTree.outputTreeSha256,
    canonicalPreSearchOutputSha256: canonicalTree.outputTreeSha256,
    rawHtmlSha256: proof.rawHtmlSha256,
    canonicalHtmlSha256: proof.canonicalHtmlSha256,
    rawUid: proof.rawUid,
    canonicalUid: proof.canonicalUid,
    changedOnlyUidValue: true,
  };
};

export const verifyCanonicalFinalDist = async (repositoryRoot: string): Promise<void> => {
  const root = resolve(repositoryRoot);
  const dist = join(root, "apps/site/dist");
  const versions = await assertVnextEnvironment(root);
  await assertNoOtherIslands(dist);
  const html = await readFile(join(dist, targetPath));
  const proof = canonicalizePrimeFactorizerHtml(html, versions, await observedAssetHashes(dist, vnextProfile));
  if (proof.rawUid !== proof.canonicalUid || !proof.output.equals(html)) {
    throw new Error("Final dist contains uncanonicalized island UID");
  }
};

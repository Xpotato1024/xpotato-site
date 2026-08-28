import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { parse, type DefaultTreeAdapterTypes } from "parse5";

const requiredHeaders = [
  "content-security-policy",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
] as const;

const requiredCspDirectives = [
  "default-src",
  "script-src",
  "style-src",
  "img-src",
  "font-src",
  "connect-src",
  "object-src",
  "base-uri",
  "frame-ancestors",
] as const;

const privateOrOptionalOriginMarkers = [
  ".r2.dev",
  "r2.cloudflarestorage.com",
  "source-media",
  "protected-media",
  "imagedelivery.net",
  "cloudflareimages.com",
] as const;

const metadataScriptTypes = new Set(["application/ld+json", "application/json"]);
const executableScriptTypes = new Set(["", "module", "text/javascript", "application/javascript", "text/ecmascript", "application/ecmascript"]);
const cspHashPattern = /^'sha256-[A-Za-z0-9+/]+={0,2}'$/u;

export interface ParsedHeaderRoute {
  readonly route: string;
  readonly headers: ReadonlyMap<string, string>;
}

export interface BuiltHtmlInput {
  readonly path: string;
  readonly html: string;
}

export interface BuildSecurityAnalysis {
  readonly scriptHashes: readonly string[];
  readonly styleHashes: readonly string[];
  readonly routes: ReadonlyMap<string, Readonly<{
    inlineExecutableScripts: number;
    externalExecutableScripts: number;
    inlineStyles: number;
    hasAstroIsland: boolean;
  }>>;
  readonly errors: readonly string[];
}

const uniqueSorted = (values: Iterable<string>): string[] => [...new Set(values)].sort();

const inlineCspHash = (source: string): string =>
  `sha256-${createHash("sha256").update(source, "utf8").digest("base64")}`;

export const renderSecurityHeaderArtifact = (input: Readonly<{
  scriptHashes: readonly string[];
  styleHashes: readonly string[];
}>): string => {
  const scriptSources = ["'self'", ...uniqueSorted(input.scriptHashes).map((hash) => `'${hash}'`)];
  const styleSources = ["'self'", ...uniqueSorted(input.styleHashes).map((hash) => `'${hash}'`)];
  const csp = [
    "default-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
    `style-src ${styleSources.join(" ")}`,
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
  return [
    "/*",
    `  Content-Security-Policy: ${csp}`,
    "  X-Content-Type-Options: nosniff",
    "  Referrer-Policy: strict-origin-when-cross-origin",
    "  Permissions-Policy: accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
    "",
  ].join("\n");
};

export const parseSecurityHeaderArtifact = (source: string): readonly ParsedHeaderRoute[] => {
  const routes: ParsedHeaderRoute[] = [];
  let currentRoute: string | undefined;
  let currentHeaders = new Map<string, string>();
  const flush = (): void => {
    if (currentRoute !== undefined) routes.push({ route: currentRoute, headers: currentHeaders });
  };
  for (const [index, rawLine] of source.replaceAll("\r\n", "\n").split("\n").entries()) {
    if (rawLine.trim() === "" || rawLine.trimStart().startsWith("#")) continue;
    if (!/^\s/u.test(rawLine)) {
      flush();
      currentRoute = rawLine.trim();
      currentHeaders = new Map();
      continue;
    }
    if (currentRoute === undefined) throw new Error(`Header declared before a route on line ${index + 1}`);
    const separator = rawLine.indexOf(":");
    if (separator < 0) throw new Error(`Malformed header on line ${index + 1}`);
    const name = rawLine.slice(0, separator).trim().toLowerCase();
    const value = rawLine.slice(separator + 1).trim();
    if (name === "" || value === "") throw new Error(`Empty header name or value on line ${index + 1}`);
    if (currentHeaders.has(name)) throw new Error(`Duplicate ${name} header for ${currentRoute}`);
    currentHeaders.set(name, value);
  }
  flush();
  return routes;
};

export const parseContentSecurityPolicy = (source: string): ReadonlyMap<string, readonly string[]> => {
  const directives = new Map<string, readonly string[]>();
  for (const segment of source.split(";")) {
    const tokens = segment.trim().split(/\s+/u).filter(Boolean);
    if (tokens.length === 0) continue;
    const [rawName, ...values] = tokens;
    const name = rawName!.toLowerCase();
    if (directives.has(name)) throw new Error(`Duplicate CSP directive: ${name}`);
    directives.set(name, values);
  }
  return directives;
};

const hasExactValues = (actual: readonly string[] | undefined, expected: readonly string[]): boolean =>
  actual !== undefined && actual.length === expected.length && actual.every((value, index) => value === expected[index]);

const validateHashedSourceDirective = (
  directive: string,
  values: readonly string[] | undefined,
  errors: string[],
): void => {
  if (!values) return;
  if (values[0] !== "'self'") errors.push(`${directive} must begin with 'self'`);
  for (const value of values.slice(1)) {
    if (!cspHashPattern.test(value)) errors.push(`${directive} contains an unexpected source: ${value}`);
  }
};

export const validateSecurityHeaderArtifact = (source: string): readonly string[] => {
  const errors: string[] = [];
  let routes: readonly ParsedHeaderRoute[];
  try {
    routes = parseSecurityHeaderArtifact(source);
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
  const wildcardRoutes = routes.filter((entry) => entry.route === "/*");
  if (wildcardRoutes.length !== 1) return ["Security headers must define exactly one /* route"];
  const headers = wildcardRoutes[0]!.headers;
  for (const name of requiredHeaders) {
    if (!headers.has(name)) errors.push(`Required security header missing: ${name}`);
  }
  if (headers.get("x-content-type-options")?.toLowerCase() !== "nosniff") {
    errors.push("X-Content-Type-Options must be nosniff");
  }
  if (headers.get("referrer-policy")?.toLowerCase() !== "strict-origin-when-cross-origin") {
    errors.push("Referrer-Policy must be strict-origin-when-cross-origin");
  }
  const permissions = headers.get("permissions-policy")?.toLowerCase() ?? "";
  for (const deniedCapability of ["camera=()", "geolocation=()", "microphone=()"]) {
    if (!permissions.split(/\s*,\s*/u).includes(deniedCapability)) {
      errors.push(`Permissions-Policy must deny ${deniedCapability.slice(0, -3)}`);
    }
  }
  const cspSource = headers.get("content-security-policy");
  if (!cspSource) return errors;
  let csp: ReadonlyMap<string, readonly string[]>;
  try {
    csp = parseContentSecurityPolicy(cspSource);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return errors;
  }
  for (const directive of requiredCspDirectives) {
    if (!csp.has(directive)) errors.push(`Required CSP directive missing: ${directive}`);
  }
  if (!hasExactValues(csp.get("default-src"), ["'self'"])) errors.push("default-src must be exactly 'self'");
  if (!hasExactValues(csp.get("img-src"), ["'self'", "data:"])) errors.push("img-src must be exactly 'self' data:");
  for (const directive of ["font-src", "connect-src", "base-uri"] as const) {
    if (!hasExactValues(csp.get(directive), ["'self'"])) errors.push(`${directive} must be exactly 'self'`);
  }
  for (const directive of ["object-src", "frame-ancestors"] as const) {
    if (!hasExactValues(csp.get(directive), ["'none'"])) errors.push(`${directive} must be exactly 'none'`);
  }
  const allValues = [...csp.values()].flat();
  if (allValues.includes("'unsafe-eval'")) errors.push("CSP must not contain unsafe-eval");
  if (allValues.includes("'unsafe-inline'")) errors.push("CSP must not contain unsafe-inline");
  validateHashedSourceDirective("script-src", csp.get("script-src"), errors);
  validateHashedSourceDirective("style-src", csp.get("style-src"), errors);
  for (const value of allValues) {
    const normalized = value.replaceAll("'", "").toLowerCase();
    if (normalized.includes("://") || normalized.startsWith("//")) {
      errors.push(`CSP contains an unexpected third-party origin: ${value}`);
    }
    if (privateOrOptionalOriginMarkers.some((marker) => normalized.includes(marker))) {
      errors.push(`CSP contains a private/protected/optional media origin: ${value}`);
    }
  }
  return errors;
};

type HtmlNode = DefaultTreeAdapterTypes.Node;
type HtmlElement = DefaultTreeAdapterTypes.Element;

const isElement = (node: HtmlNode): node is HtmlElement => "tagName" in node;
const childrenOf = (node: HtmlNode): readonly HtmlNode[] => "childNodes" in node ? node.childNodes : [];
const textOf = (node: HtmlNode): string => {
  if (node.nodeName === "#text" && "value" in node) return node.value;
  return childrenOf(node).map(textOf).join("");
};
const attributeOf = (element: HtmlElement, name: string): string | undefined =>
  element.attrs.find((attribute) => attribute.name === name)?.value;

const isSameOriginScript = (source: string): boolean => {
  try {
    return !source.startsWith("//") && new URL(source, "https://xpotato.invalid/").origin === "https://xpotato.invalid";
  } catch {
    return false;
  }
};

export const analyzeBuiltHtml = (inputs: readonly BuiltHtmlInput[]): BuildSecurityAnalysis => {
  const scriptHashes = new Set<string>();
  const styleHashes = new Set<string>();
  const routes = new Map<string, {
    inlineExecutableScripts: number;
    externalExecutableScripts: number;
    inlineStyles: number;
    hasAstroIsland: boolean;
  }>();
  const errors: string[] = [];
  for (const input of inputs) {
    const metrics = { inlineExecutableScripts: 0, externalExecutableScripts: 0, inlineStyles: 0, hasAstroIsland: false };
    const visitNode = (node: HtmlNode): void => {
      if (isElement(node)) {
        if (node.tagName === "astro-island") metrics.hasAstroIsland = true;
        for (const attribute of node.attrs) {
          if (/^on[a-z]+$/u.test(attribute.name)) errors.push(`${input.path}: inline event handler is not CSP-compatible: ${attribute.name}`);
          if (attribute.name === "style") errors.push(`${input.path}: style attribute is not CSP-compatible`);
        }
        if (node.tagName === "style") {
          const body = textOf(node);
          metrics.inlineStyles += 1;
          styleHashes.add(inlineCspHash(body));
        }
        if (node.tagName === "script") {
          const type = (attributeOf(node, "type") ?? "").trim().toLowerCase();
          if (!metadataScriptTypes.has(type)) {
            if (!executableScriptTypes.has(type)) {
              errors.push(`${input.path}: unsupported script type cannot be admitted by CSP: ${type}`);
            } else {
              const source = attributeOf(node, "src");
              const body = textOf(node);
              if (source !== undefined) {
                metrics.externalExecutableScripts += 1;
                if (!isSameOriginScript(source)) errors.push(`${input.path}: executable script source is not same-origin: ${source}`);
                if (body.trim() !== "") errors.push(`${input.path}: executable script mixes src with inline code`);
              } else if (body !== "") {
                metrics.inlineExecutableScripts += 1;
                scriptHashes.add(inlineCspHash(body));
              }
            }
          }
        }
      }
      for (const child of childrenOf(node)) visitNode(child);
    };
    visitNode(parse(input.html));
    routes.set(input.path.replaceAll("\\", "/"), metrics);
  }
  return {
    scriptHashes: uniqueSorted(scriptHashes),
    styleHashes: uniqueSorted(styleHashes),
    routes,
    errors,
  };
};

const cspHashes = (values: readonly string[] | undefined): readonly string[] =>
  uniqueSorted((values ?? []).filter((value) => cspHashPattern.test(value)).map((value) => value.slice(1, -1)));

export const validateBuiltHtmlAgainstSecurityHeaders = (
  headerArtifact: string,
  inputs: readonly BuiltHtmlInput[],
): readonly string[] => {
  const errors = [...validateSecurityHeaderArtifact(headerArtifact)];
  const analysis = analyzeBuiltHtml(inputs);
  errors.push(...analysis.errors);
  let routes: readonly ParsedHeaderRoute[] = [];
  try {
    routes = parseSecurityHeaderArtifact(headerArtifact);
  } catch {
    return errors;
  }
  const wildcard = routes.find((entry) => entry.route === "/*");
  if (!wildcard) return errors;
  let csp: ReadonlyMap<string, readonly string[]>;
  try {
    csp = parseContentSecurityPolicy(wildcard.headers.get("content-security-policy") ?? "");
  } catch {
    return errors;
  }
  const allowedScripts = cspHashes(csp.get("script-src"));
  const allowedStyles = cspHashes(csp.get("style-src"));
  if (JSON.stringify(allowedScripts) !== JSON.stringify(analysis.scriptHashes)) {
    errors.push(`CSP executable script hashes are stale: expected ${JSON.stringify(analysis.scriptHashes)}, found ${JSON.stringify(allowedScripts)}`);
  }
  if (JSON.stringify(allowedStyles) !== JSON.stringify(analysis.styleHashes)) {
    errors.push(`CSP inline style hashes are stale: expected ${JSON.stringify(analysis.styleHashes)}, found ${JSON.stringify(allowedStyles)}`);
  }
  const contentRoute = analysis.routes.get("notes/infrastructure-foundation/index.html");
  if (!contentRoute) errors.push("Representative normal content route is missing from the build");
  else if (contentRoute.inlineExecutableScripts + contentRoute.externalExecutableScripts !== 0) {
    errors.push("Representative normal content route unexpectedly loads executable JavaScript");
  }
  const searchRoute = analysis.routes.get("search/index.html");
  if (!searchRoute) errors.push("Representative search route is missing from the build");
  else if (searchRoute.externalExecutableScripts < 1) errors.push("Search route must use a same-origin external module asset");
  const toolRoute = analysis.routes.get("tools/prime-factorizer/index.html");
  if (!toolRoute) errors.push("Representative interactive Tool route is missing from the build");
  else {
    if (!toolRoute.hasAstroIsland) errors.push("Interactive Tool route must retain its registry-owned Astro island");
    if (toolRoute.inlineExecutableScripts + toolRoute.externalExecutableScripts < 1) {
      errors.push("Interactive Tool route has no CSP-admitted executable runtime");
    }
  }
  return errors;
};

export const readBuiltHtml = async (dist: string): Promise<readonly BuiltHtmlInput[]> => {
  const readDirectory = async (directory: string): Promise<BuiltHtmlInput[]> => {
    const output: BuiltHtmlInput[] = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) output.push(...await readDirectory(path));
      else if (entry.isFile() && entry.name.endsWith(".html")) {
        output.push({ path: relative(dist, path).replaceAll("\\", "/"), html: await readFile(path, "utf8") });
      }
    }
    return output;
  };
  return (await readDirectory(dist)).sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
};

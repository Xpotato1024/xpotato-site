import { parse, type DefaultTreeAdapterTypes } from "parse5";

export const LEGACY_ASTRO_REACT_UID_VARIANCE_ID = "astro-react-island-uid-v1" as const;
export const LEGACY_PRIME_FACTORIZER_HTML_PATH = "tools/prime-factorizer/index.html" as const;
export const LEGACY_PRIME_FACTORIZER_COMPONENT_PATH = "src/components/app/PrimeFactorizer.tsx" as const;
export const LEGACY_PRIME_FACTORIZER_CONTENT_ID = "tools:prime-factorizer" as const;

const CANONICAL_UID = "__xpotato_astro_react_uid__";

type HtmlNode = DefaultTreeAdapterTypes.Node;
type HtmlElement = DefaultTreeAdapterTypes.Element;

interface AttributeLocation {
  readonly startOffset: number;
  readonly endOffset: number;
}

interface SourceLocation {
  readonly startOffset: number;
  readonly endOffset: number;
  readonly startTag?: Readonly<{ startOffset: number; endOffset: number }>;
  readonly endTag?: Readonly<{ startOffset: number; endOffset: number }>;
  readonly attrs?: Readonly<Record<string, AttributeLocation>>;
}

interface IslandDescriptor {
  readonly element: HtmlElement;
  readonly path: string;
  readonly uid: string;
  readonly uidLocation: AttributeLocation;
  readonly componentUrl: string;
  readonly rendererUrl: string;
}

export interface AstroReactIslandUidVarianceEvidence {
  readonly kind: "astro_react_island_uid";
  readonly varianceClassId: typeof LEGACY_ASTRO_REACT_UID_VARIANCE_ID;
  readonly path: typeof LEGACY_PRIME_FACTORIZER_HTML_PATH;
  readonly islandOrdinal: 0;
  readonly componentPath: typeof LEGACY_PRIME_FACTORIZER_COMPONENT_PATH;
  readonly contentId: typeof LEGACY_PRIME_FACTORIZER_CONTENT_ID;
  readonly framework: "React";
  readonly hydrationDirective: "client:visible";
  readonly componentUrl: string;
  readonly rendererUrl: string;
  readonly observedValues: readonly [string, string];
}

export interface AstroReactIslandUidProof {
  readonly firstComparisonHtml: string;
  readonly secondComparisonHtml: string;
  readonly evidence: AstroReactIslandUidVarianceEvidence;
}

export interface LegacyInteractiveBindingLike {
  readonly componentPath: string;
  readonly usedByContentIds: readonly string[];
  readonly framework: string;
  readonly hydrationDirective?: string;
}

const isElement = (node: HtmlNode): node is HtmlElement => "tagName" in node;
const childrenOf = (node: HtmlNode): readonly HtmlNode[] => "childNodes" in node ? node.childNodes : [];
const elementChildrenOf = (node: HtmlNode): readonly HtmlElement[] => childrenOf(node).filter(isElement);
const attributeOf = (element: HtmlElement, name: string): string | undefined =>
  element.attrs.find((attribute) => attribute.name === name)?.value;
const locationOf = (element: HtmlElement): SourceLocation | undefined =>
  (element.sourceCodeLocation as SourceLocation | null | undefined) ?? undefined;

const collectIslands = (source: string): readonly IslandDescriptor[] => {
  const document = parse(source, { sourceCodeLocationInfo: true }) as HtmlNode;
  const result: IslandDescriptor[] = [];
  const walk = (node: HtmlNode, path: string): void => {
    const children = elementChildrenOf(node);
    for (let index = 0; index < children.length; index += 1) {
      const element = children[index]!;
      const elementPath = `${path}/${element.tagName}[${index}]`;
      if (element.tagName === "astro-island") {
        const uid = attributeOf(element, "uid");
        const componentUrl = attributeOf(element, "component-url");
        const rendererUrl = attributeOf(element, "renderer-url");
        const location = locationOf(element);
        const uidLocation = location?.attrs?.uid;
        if (!uid || !componentUrl || !rendererUrl || !uidLocation) {
          throw new Error(`Astro island identity is incomplete at ${elementPath}`);
        }
        result.push({ element, path: elementPath, uid, uidLocation, componentUrl, rendererUrl });
      }
      walk(element, elementPath);
    }
  };
  walk(document, "");
  return result;
};

const replaceExactUidValue = (source: string, island: IslandDescriptor): string => {
  const rawAttribute = source.slice(island.uidLocation.startOffset, island.uidLocation.endOffset);
  const match = /^uid="([A-Za-z0-9]+)"$/u.exec(rawAttribute);
  if (!match?.[1] || match[1] !== island.uid) {
    throw new Error(`Astro island uid is not in the expected generated form at ${island.path}`);
  }
  const canonicalAttribute = `uid="${CANONICAL_UID}"`;
  return `${source.slice(0, island.uidLocation.startOffset)}${canonicalAttribute}${source.slice(island.uidLocation.endOffset)}`;
};

export const verifyPrimeFactorizerInteractiveBinding = (
  interactive: readonly LegacyInteractiveBindingLike[],
): readonly string[] => {
  const matching = interactive.filter((record) =>
    record.componentPath === LEGACY_PRIME_FACTORIZER_COMPONENT_PATH
    && record.framework === "React"
    && record.hydrationDirective === "client:visible"
    && record.usedByContentIds.length === 1
    && record.usedByContentIds[0] === LEGACY_PRIME_FACTORIZER_CONTENT_ID,
  );
  return matching.length === 1 ? [] : [
    `Frozen PrimeFactorizer interactive binding mismatch: expected exactly one ${LEGACY_PRIME_FACTORIZER_COMPONENT_PATH} -> ${LEGACY_PRIME_FACTORIZER_CONTENT_ID} React client:visible record`,
  ];
};

export const provePrimeFactorizerAstroUidVariance = (input: Readonly<{
  path: string;
  firstHtml: string;
  secondHtml: string;
  interactiveBindingVerified: boolean;
}>): AstroReactIslandUidProof | undefined => {
  if (input.firstHtml === input.secondHtml) return undefined;
  if (input.path !== LEGACY_PRIME_FACTORIZER_HTML_PATH) return undefined;
  if (!input.interactiveBindingVerified) throw new Error("PrimeFactorizer interactive inventory binding is not verified");

  const firstIslands = collectIslands(input.firstHtml);
  const secondIslands = collectIslands(input.secondHtml);
  if (firstIslands.length !== 1 || secondIslands.length !== 1) {
    throw new Error("PrimeFactorizer uid equivalence requires exactly one Astro island per build");
  }
  const first = firstIslands[0]!;
  const second = secondIslands[0]!;
  if (first.path !== second.path) throw new Error("Astro island DOM position changed");
  if (first.uid === second.uid) return undefined;

  const requireEqualAttribute = (name: string): string => {
    const left = attributeOf(first.element, name);
    const right = attributeOf(second.element, name);
    if (left === undefined || right === undefined || left !== right) throw new Error(`Astro island ${name} differs or is missing`);
    return left;
  };

  if (requireEqualAttribute("client") !== "visible") throw new Error("PrimeFactorizer hydration directive is not client:visible");
  if (requireEqualAttribute("component-export") !== "default") throw new Error("PrimeFactorizer component export changed");
  const componentUrl = requireEqualAttribute("component-url");
  const rendererUrl = requireEqualAttribute("renderer-url");
  if (!/^\/_astro\/PrimeFactorizer\.[A-Za-z0-9_-]+\.js$/u.test(componentUrl)) {
    throw new Error(`Unexpected PrimeFactorizer component URL: ${componentUrl}`);
  }
  if (!/^\/_astro\/client\.[A-Za-z0-9_-]+\.js$/u.test(rendererUrl)) {
    throw new Error(`Unexpected React renderer URL: ${rendererUrl}`);
  }
  const opts = requireEqualAttribute("opts");
  let parsedOpts: unknown;
  try { parsedOpts = JSON.parse(opts); } catch { throw new Error("PrimeFactorizer Astro island opts is not valid JSON"); }
  if (JSON.stringify(parsedOpts) !== JSON.stringify({ name: "PrimeFactorizer", value: true })) {
    throw new Error("PrimeFactorizer Astro island opts changed");
  }

  const firstComparisonHtml = replaceExactUidValue(input.firstHtml, first);
  const secondComparisonHtml = replaceExactUidValue(input.secondHtml, second);
  if (firstComparisonHtml !== secondComparisonHtml) {
    throw new Error("PrimeFactorizer HTML contains variance beyond the Astro island uid value");
  }

  return {
    firstComparisonHtml,
    secondComparisonHtml,
    evidence: {
      kind: "astro_react_island_uid",
      varianceClassId: LEGACY_ASTRO_REACT_UID_VARIANCE_ID,
      path: LEGACY_PRIME_FACTORIZER_HTML_PATH,
      islandOrdinal: 0,
      componentPath: LEGACY_PRIME_FACTORIZER_COMPONENT_PATH,
      contentId: LEGACY_PRIME_FACTORIZER_CONTENT_ID,
      framework: "React",
      hydrationDirective: "client:visible",
      componentUrl,
      rendererUrl,
      observedValues: [first.uid, second.uid],
    },
  };
};

export const validateAstroReactIslandUidVarianceEvidence = (candidate: unknown): readonly string[] => {
  if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate)) return ["uid variance evidence must be an object"];
  const value = candidate as Record<string, unknown>;
  const errors: string[] = [];
  if (value.kind !== "astro_react_island_uid") errors.push("uid variance kind mismatch");
  if (value.varianceClassId !== LEGACY_ASTRO_REACT_UID_VARIANCE_ID) errors.push("uid variance class mismatch");
  if (value.path !== LEGACY_PRIME_FACTORIZER_HTML_PATH) errors.push("uid variance path mismatch");
  if (value.islandOrdinal !== 0) errors.push("uid variance island ordinal mismatch");
  if (value.componentPath !== LEGACY_PRIME_FACTORIZER_COMPONENT_PATH) errors.push("uid variance component path mismatch");
  if (value.contentId !== LEGACY_PRIME_FACTORIZER_CONTENT_ID) errors.push("uid variance content ID mismatch");
  if (value.framework !== "React") errors.push("uid variance framework mismatch");
  if (value.hydrationDirective !== "client:visible") errors.push("uid variance hydration mismatch");
  if (typeof value.componentUrl !== "string" || !/^\/_astro\/PrimeFactorizer\.[A-Za-z0-9_-]+\.js$/u.test(value.componentUrl)) errors.push("uid variance component URL invalid");
  if (typeof value.rendererUrl !== "string" || !/^\/_astro\/client\.[A-Za-z0-9_-]+\.js$/u.test(value.rendererUrl)) errors.push("uid variance renderer URL invalid");
  if (!Array.isArray(value.observedValues) || value.observedValues.length !== 2 || value.observedValues.some((item) => typeof item !== "string" || !/^[A-Za-z0-9]+$/u.test(item))) {
    errors.push("uid variance observed values invalid");
  } else if (value.observedValues[0] === value.observedValues[1]) errors.push("uid variance requires two different observed values");
  return errors;
};

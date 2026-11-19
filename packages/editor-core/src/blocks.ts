import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";
import remarkGfm from "remark-gfm";
import { semanticContentModulePropsSchemas } from "@xpotato/content-contracts/content";
import { validatePortableMdx } from "@xpotato/portable-content";
const processor = unified().use(remarkParse).use(remarkMdx).use(remarkGfm);

/** The editor reads an AST; portable source remains authoritative. */
export interface BlockNode {
  type: string;
  name?: string;
  value?: string;
  depth?: number;
  ordered?: boolean;
  start?: number;
  checked?: boolean | null;
  url?: string;
  alt?: string;
  title?: string;
  lang?: string | null;
  meta?: string | null;
  align?: ("left" | "right" | "center" | null)[];
  children?: BlockNode[];
  attributes?: { type: string; name?: string; value?: unknown }[];
  position?: { start: { offset?: number }; end: { offset?: number } };
}
export function blockTree(source: string): BlockNode {
  return processor.parse(source) as unknown as BlockNode;
}
export interface SourceBlock {
  index: number;
  type: string;
  name?: string;
  start: number;
  end: number;
  source: string;
}
export function sourceBlocks(body: string): SourceBlock[] {
  const tree = processor.parse(body);
  return tree.children.map((node, index) => ({
    index,
    type: node.type,
    ...("name" in node && typeof node.name === "string" ? { name: node.name } : {}),
    start: node.position!.start.offset!,
    end: node.position!.end.offset!,
    source: body.slice(node.position!.start.offset!, node.position!.end.offset!),
  }));
}
export function replaceBlock(body: string, index: number, replacement: string): string {
  const block = sourceBlocks(body)[index];
  if (!block) throw Error("BLOCK_NOT_FOUND");
  const result = body.slice(0, block.start) + replacement + body.slice(block.end);
  const issues = validatePortableMdx(result);
  if (issues.length) throw Error(issues.join("; "));
  return result;
}
export function moveBlockTo(body: string, index: number, destination: number): string {
  const document = createBlockDocument(body);
  const result = writeBlockDocument(reorderRegion(document, index, destination));
  const issues = validatePortableMdx(result);
  if (issues.length) throw Error(issues.join("; "));
  return result;
}
export function moveBlock(body: string, index: number, direction: -1 | 1): string {
  return moveBlockTo(body, index, index + direction);
}
export function removeBlock(body: string, index: number): string {
  return replaceBlock(body, index, "");
}
export const moduleNames = Object.freeze(Object.keys(semanticContentModulePropsSchemas));
const attrEscape = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
function serializeAttributes(data: Record<string, unknown>): string {
  return Object.entries(data)
    .filter(([, value]) => value !== undefined && value !== false)
    .map(([key, value]) => (value === true ? key : key + '="' + attrEscape(String(value)) + '"'))
    .join(" ");
}
export function moduleSource(
  name: string,
  props: Record<string, unknown>,
  children?: string,
): string {
  const schema =
    semanticContentModulePropsSchemas[name as keyof typeof semanticContentModulePropsSchemas];
  if (!schema) throw Error("MODULE_UNKNOWN");
  const data = schema.parse(props) as Record<string, unknown>;
  const attributes = serializeAttributes(data);
  const start = "<" + name + (attributes ? " " + attributes : "");
  const text =
    children === undefined ? start + " />" : start + ">\n\n" + children + "\n\n</" + name + ">";
  const issues = validatePortableMdx(text);
  if (issues.length) throw Error(issues.join("; "));
  return text;
}

export interface ModuleSource {
  name: string;
  props: Record<string, string | boolean>;
  start: number;
  openingEnd: number;
  closingStart: number;
  end: number;
  children: string | undefined;
}
/** Read only the root element's AST attributes, never attributes of its children. */
export function readModuleSource(source: string): ModuleSource | null {
  let tree: BlockNode;
  try {
    tree = blockTree(source);
  } catch {
    return null;
  }
  const node = tree.children?.[0];
  if (tree.children?.length !== 1 || node?.type !== "mdxJsxFlowElement" || !node.name) return null;
  if (!moduleNames.includes(node.name)) return null;
  const props: Record<string, string | boolean> = {};
  for (const attr of node.attributes ?? []) {
    if (attr.type !== "mdxJsxAttribute" || !attr.name) return null;
    if (attr.value !== null && typeof attr.value !== "string") return null;
    props[attr.name] = attr.value === null ? true : attr.value;
  }
  const start = node.position?.start.offset ?? 0;
  const end = node.position?.end.offset ?? source.length;
  let quote = "";
  let openingEnd = start;
  for (; openingEnd < end; openingEnd++) {
    const char = source[openingEnd];
    if (quote) {
      if (char === quote) quote = "";
    } else if (char === '"' || char === "'") quote = char;
    else if (char === ">") {
      openingEnd++;
      break;
    }
  }
  if (openingEnd > end) return null;
  const selfClosing = /\/\s*>$/u.test(source.slice(start, openingEnd));
  const closingStart = selfClosing ? openingEnd : source.lastIndexOf("</" + node.name, end);
  if (closingStart < openingEnd) return null;
  return {
    name: node.name,
    props,
    start,
    openingEnd,
    closingStart,
    end,
    children: selfClosing ? undefined : source.slice(openingEnd, closingStart),
  };
}
/** Changes the opening tag only. Child source and whitespace remain byte-identical. */
export function updateModuleProps(source: string, props: Record<string, unknown>): string {
  const module = readModuleSource(source);
  if (!module) throw Error("MODULE_SOURCE_UNSUPPORTED");
  const schema =
    semanticContentModulePropsSchemas[
      module.name as keyof typeof semanticContentModulePropsSchemas
    ];
  const data = schema.parse(props) as Record<string, unknown>;
  const attributes = serializeAttributes(data);
  const opening =
    "<" +
    module.name +
    (attributes ? " " + attributes : "") +
    (module.children === undefined ? " />" : ">");
  return source.slice(0, module.start) + opening + source.slice(module.openingEnd);
}
export function updateModuleChildren(source: string, children: string): string {
  const module = readModuleSource(source);
  if (!module) throw Error("MODULE_SOURCE_UNSUPPORTED");
  if (module.children === undefined) {
    return (
      source.slice(0, module.start) +
      source.slice(module.start, module.openingEnd).replace(/\/\s*>$/u, ">") +
      "\n\n" +
      children +
      "\n\n</" +
      module.name +
      ">" +
      source.slice(module.end)
    );
  }
  return source.slice(0, module.openingEnd) + children + source.slice(module.closingStart);
}

/** Content containers share the same authoring vocabulary as ordinary document flow. */
export const flowChildKinds: readonly string[] = Object.freeze([
  "paragraph",
  "heading",
  "list",
  "orderedList",
  "quote",
  "divider",
  "table",
  "code",
  "math",
  ...moduleNames.filter(
    (name) => !["Step", "DiagnosticItem", "ComparisonCase", "ArticleEndnote"].includes(name),
  ),
]);
/** Direct child choices shared by insertion UI and external insertion actions. */
export const moduleChildKinds: Readonly<Record<string, readonly string[]>> = Object.freeze({
  Group: flowChildKinds,
  Callout: flowChildKinds,
  Step: flowChildKinds,
  Details: flowChildKinds,
  Gallery: Object.freeze(["Figure"]),
  Steps: Object.freeze(["Step"]),
  DiagnosticList: Object.freeze(["DiagnosticItem"]),
  ArticleEndnote: Object.freeze(["paragraph"]),
  Figure: Object.freeze([]),
  LinkCard: Object.freeze([]),
  BarChart: Object.freeze([]),
  LineChart: Object.freeze([]),
  Comparison: Object.freeze(["ComparisonCase"]),
  ComparisonCase: flowChildKinds,
  Demo: Object.freeze([]),
  DiagnosticItem: flowChildKinds,
});
/** Preferred offsets are block boundaries; restricted containers promote to their end. */
export function moduleInsertionOffset(
  body: string,
  preferredOffset: number,
  moduleName: string,
): number {
  const offset = Number.isFinite(preferredOffset)
    ? Math.max(0, Math.min(body.length, preferredOffset))
    : body.length;
  let tree: BlockNode;
  try {
    tree = blockTree(body);
  } catch {
    return body.length;
  }
  const ancestors: BlockNode[] = [];
  const visit = (node: BlockNode) => {
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (
      node.type !== "root" &&
      (start === undefined || end === undefined || start >= offset || end <= offset)
    )
      return;
    if (node.type === "mdxJsxFlowElement" && node.name) ancestors.push(node);
    for (const child of node.children ?? []) visit(child);
  };
  visit(tree);
  let result = offset;
  for (const parent of ancestors.reverse()) {
    const legacyComparison =
      parent.name === "Comparison" &&
      parent.attributes?.some((attribute) => attribute.name === "leftLabel");
    const allowed = legacyComparison ? flowChildKinds : moduleChildKinds[parent.name!];
    if (!allowed || allowed.includes(moduleName)) break;
    result = parent.position!.end.offset!;
  }
  return result;
}

export interface EditorRegion {
  id: string;
  source: string;
}
export interface BlockDocument {
  prefix: string;
  regions: EditorRegion[];
  separators: string[];
  suffix: string;
  parseError: boolean;
}
let nextRegion = 0;
const regionId = () => "region-" + ++nextRegion;
/** Keep region identity while a rich edit adds paragraphs; never reparse own keystrokes. */
export function createBlockDocument(body: string, previous?: BlockDocument): BlockDocument {
  let blocks: SourceBlock[];
  try {
    blocks = sourceBlocks(body);
  } catch {
    return {
      prefix: "",
      regions: [{ id: previous?.regions[0]?.id ?? regionId(), source: body }],
      separators: [],
      suffix: "",
      parseError: true,
    };
  }
  const used = new Set<string>();
  const matches = blocks.map((block) => {
    const match = previous?.regions.find(
      (region) => !used.has(region.id) && region.source === block.source,
    );
    if (match) used.add(match.id);
    return match;
  });
  const regions = blocks.map((block, index) => {
    const match = matches[index];
    const candidate = previous?.regions[index];
    const id = match?.id ?? (candidate && !used.has(candidate.id) ? candidate.id : regionId());
    used.add(id);
    return { id, source: block.source };
  });
  return {
    prefix: blocks.length ? body.slice(0, blocks[0]!.start) : body,
    regions,
    separators: blocks.slice(1).map((block, index) => body.slice(blocks[index]!.end, block.start)),
    suffix: blocks.length ? body.slice(blocks.at(-1)!.end) : "",
    parseError: false,
  };
}
export function writeBlockDocument(document: BlockDocument): string {
  return (
    document.prefix +
    document.regions
      .map(
        (region, index) =>
          (index ? (document.separators[index - 1] ?? "\n\n") : "") + region.source,
      )
      .join("") +
    document.suffix
  );
}
export function regionRange(
  document: BlockDocument,
  index: number,
): { start: number; end: number } {
  let start = document.prefix.length;
  for (let i = 0; i < index; i++)
    start += document.regions[i]!.source.length + (document.separators[i] ?? "\n\n").length;
  return { start, end: start + (document.regions[index]?.source.length ?? 0) };
}
export function updateRegion(document: BlockDocument, id: string, source: string): BlockDocument {
  return {
    ...document,
    regions: document.regions.map((region) => (region.id === id ? { ...region, source } : region)),
  };
}
export function reorderRegion(document: BlockDocument, from: number, to: number): BlockDocument {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= document.regions.length ||
    to >= document.regions.length
  )
    return document;
  const regions = [...document.regions];
  regions.splice(to, 0, regions.splice(from, 1)[0]!);
  return { ...document, regions };
}
export function insertRegion(
  document: BlockDocument,
  source: string,
  after: number,
): BlockDocument {
  const regions = [...document.regions];
  const position = Math.max(0, Math.min(regions.length, after + 1));
  regions.splice(position, 0, { id: regionId(), source });
  const separators = [...document.separators];
  if (regions.length > 1) separators.splice(Math.max(0, position - 1), 0, "\n\n");
  return { ...document, regions, separators, parseError: false };
}
export function deleteRegion(document: BlockDocument, index: number): BlockDocument {
  if (!document.regions[index]) return document;
  const regions = document.regions.filter((_, i) => i !== index);
  const separators = [...document.separators];
  separators.splice(Math.max(0, index - 1), 1);
  return { ...document, regions, separators };
}

/** Group an explicit contiguous sibling range, preserving each region's authored bytes. */
export function groupRegions(document: BlockDocument, from: number, to: number): BlockDocument {
  if (
    document.parseError ||
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 0 ||
    to < from ||
    to >= document.regions.length
  ) {
    throw Error("GROUP_RANGE_INVALID");
  }
  const selected = document.regions.slice(from, to + 1);
  if (selected.some((region) => containsModule(region.source, "ArticleEndnote"))) {
    throw Error("GROUP_TOP_LEVEL_CONTENT");
  }
  const source = selected
    .map(
      (region, index) =>
        (index ? (document.separators[from + index - 1] ?? "\n\n") : "") + region.source,
    )
    .join("");
  const newline = writeBlockDocument(document).includes("\r\n") ? "\r\n" : "\n";
  const grouped = "<Group>" + newline.repeat(2) + source + newline.repeat(2) + "</Group>";
  if (!readModuleSource(grouped)) {
    throw Error("GROUP_SOURCE_UNSUPPORTED");
  }
  const regions = [...document.regions];
  regions.splice(from, to - from + 1, { id: regionId(), source: grouped });
  const separators = [...document.separators];
  separators.splice(from, to - from);
  return { ...document, regions, separators };
}

function containsModule(source: string, name: string): boolean {
  const visit = (node: BlockNode): boolean =>
    (node.type === "mdxJsxFlowElement" && node.name === name) ||
    (node.children?.some(visit) ?? false);
  return visit(blockTree(source));
}

/** Unwrap only the container; child Markdown/MDX is never serialized from an AST. */
export function ungroupRegion(document: BlockDocument, index: number): BlockDocument {
  const region = document.regions[index];
  const module = region && readModuleSource(region.source);
  if (document.parseError || !module || module.name !== "Group") {
    throw Error("GROUP_NOT_FOUND");
  }
  // These boundary line breaks separate a flow tag from Markdown; interior spacing remains intact.
  const children = (module.children ?? "")
    .replace(/^(?:\r?\n){2}/u, "")
    .replace(/(?:\r?\n){2}$/u, "");
  const source = writeBlockDocument(document);
  const range = regionRange(document, index);
  return createBlockDocument(
    source.slice(0, range.start) + children + source.slice(range.end),
    document,
  );
}

/** Suggest a section only on request; a heading never creates an implicit persistent group. */
export function headingRegionRange(
  document: BlockDocument,
  index: number,
): { from: number; to: number } | null {
  if (document.parseError || !document.regions[index]) return null;
  let trees: BlockNode[];
  try {
    trees = document.regions.map((region) => blockTree(region.source));
  } catch {
    return null;
  }
  const first = trees[index]!.children ?? [];
  const depth = first[0]?.type === "heading" ? first[0].depth : undefined;
  if (
    depth === undefined ||
    first.slice(1).some((node) => node.type === "heading" && (node.depth ?? 6) <= depth) ||
    containsModule(document.regions[index]!.source, "ArticleEndnote")
  )
    return null;
  let to = index;
  for (let next = index + 1; next < document.regions.length; next++) {
    const source = document.regions[next]!.source;
    const nodes = trees[next]!.children ?? [];
    if (
      readModuleSource(source)?.name === "Group" ||
      containsModule(source, "ArticleEndnote") ||
      nodes.some((node) => node.type === "heading" && (node.depth ?? 6) <= depth)
    )
      break;
    to = next;
  }
  return { from: index, to };
}
export interface BlockSelection {
  quote: string;
  blockStart: number;
  blockEnd: number;
  blockSource: string;
  start?: number;
  end?: number;
}
export function sourceSelection(source: string, quote: string, offset: number): BlockSelection {
  const first = quote ? source.indexOf(quote) : -1;
  const unique = first >= 0 && source.indexOf(quote, first + 1) < 0;
  return {
    quote,
    blockStart: offset,
    blockEnd: offset + source.length,
    blockSource: source,
    ...(unique ? { start: offset + first, end: offset + first + quote.length } : {}),
  };
}
export const blockTemplates = Object.freeze({
  Group: "<Group>\n\n## 見出し\n\n本文を入力してください。\n\n</Group>",
  paragraph: "本文を入力してください。",
  heading: "## 見出し",
  list: "- 項目1\n- 項目2",
  orderedList: "1. 最初の項目\n2. 次の項目",
  quote: "> 引用文を入力してください。\n>\n> 出典を記載します。",
  divider: "---",
  table: "| 項目 | 値 |\n| --- | --- |\n| サンプル | 0 |",
  code: "```text\nコードを入力\n```",
  math: '```math label="式の説明"\n\\sigma = \\sqrt{\\frac{1}{N}\\sum_{i=1}^{N}(x_i-\\mu)^2}\n```',
  Figure: '<Figure asset="figure-1" alt="図の内容" />',
  Gallery:
    '<Gallery>\n  <Figure asset="figure-1" alt="図1" />\n  <Figure asset="figure-2" alt="図2" />\n</Gallery>',
  Steps: '<Steps>\n  <Step title="最初の手順">\n\n操作を記述します。\n\n  </Step>\n</Steps>',
  Step: '<Step title="手順">\n\n操作を記述します。\n\n</Step>',
  Callout: '<Callout kind="note" title="補足">\n\n補足内容。\n\n</Callout>',
  BarChart: '<BarChart title="比較" unit="件" max="10" rows=\'[{"label":"条件A","value":5}]\' />',
  LineChart:
    '<LineChart title="グラフのタイトル" xLabel="時間 (s)" yLabel="変位 (mm)" series=\'[{"label":"条件A","points":[{"x":0,"y":1},{"x":1,"y":3},{"x":2,"y":2}]},{"label":"条件B","points":[{"x":0,"y":2},{"x":1,"y":4},{"x":2,"y":3}]}]\' />',
  Details: '<Details summary="詳細">\n\n説明。\n\n</Details>',
  Comparison:
    '<Comparison>\n\n<ComparisonCase label="条件A">\n\n条件Aの説明。\n\n</ComparisonCase>\n\n<ComparisonCase label="条件B">\n\n条件Bの説明。\n\n</ComparisonCase>\n\n<ComparisonCase label="条件C">\n\n条件Cの説明。\n\n</ComparisonCase>\n\n</Comparison>',
  ComparisonCase: '<ComparisonCase label="新しい条件">\n\n条件の説明。\n\n</ComparisonCase>',
  LinkCard: '<LinkCard href="https://example.com" title="リンク先のタイトル" />',
  DiagnosticList:
    '<DiagnosticList>\n  <DiagnosticItem symptom="症状" check="確認すること" action="対処方法" />\n</DiagnosticList>',
  DiagnosticItem: '<DiagnosticItem symptom="症状" check="確認すること" action="対処方法" />',
  ArticleEndnote: "<ArticleEndnote>\n\n検証条件と出典について。\n\n</ArticleEndnote>",
  Demo: '<Demo module="prime-factorizer" title="試してみる" />',
});
export function insertBlock(body: string, kind: keyof typeof blockTemplates): string {
  return body.replace(/\s*$/u, "") + "\n\n" + blockTemplates[kind] + "\n";
}

import {
  blockTree,
  insertRegion,
  writeBlockDocument,
  type BlockDocument,
  type BlockNode,
} from "./blocks.js";

/** A block is parsed without its sibling definitions. Supply parse-only definitions for references. */
export function blockTreeWithFootnoteReferences(source: string): BlockNode {
  const labels = [
    ...new Set([...source.matchAll(/\[\^((?:\\.|[^\]\\\r\n])+)\]/gu)].map((match) => match[1]!)),
  ];
  if (!labels.length) return blockTree(source);
  const tree = blockTree(
    source + "\n\n" + labels.map((label) => "[^" + label + "]: reference").join("\n"),
  );
  if (
    tree.children?.some(
      (node) =>
        (node.position?.start.offset ?? source.length) < source.length &&
        (node.position?.end.offset ?? source.length) > source.length,
    )
  )
    return blockTree(source);
  if (tree.children)
    tree.children = tree.children.filter(
      (node) => (node.position?.start.offset ?? source.length) < source.length,
    );
  return tree;
}

export interface FootnoteDefinition {
  identifier: string;
  label: string;
  content: string;
  marker: string;
  separator: string;
  newline: string;
}

/** The marker is kept verbatim; editing a note must not rename its references. */
export function readFootnoteDefinition(source: string): FootnoteDefinition | null {
  try {
    const nodes = blockTree(source).children ?? [];
    const node = nodes[0];
    if (nodes.length !== 1 || node?.type !== "footnoteDefinition" || !node.identifier) return null;
    const lines = source.split(/\r?\n/u);
    const first = /^( {0,3}\[\^((?:\\.|[^\]\\])+)\]:)([ \t]?)(.*)$/u.exec(lines[0] ?? "");
    if (!first) return null;
    return {
      identifier: node.identifier,
      label: node.label ?? first[2]!,
      marker: first[1]!,
      separator: first[3]!,
      content: [first[4]!, ...lines.slice(1).map((line) => line.replace(/^(?: {4}|\t)/u, ""))].join(
        "\n",
      ),
      newline: source.includes("\r\n") ? "\r\n" : "\n",
    };
  } catch {
    return null;
  }
}

export function updateFootnoteContent(source: string, content: string): string {
  const note = readFootnoteDefinition(source);
  if (!note) throw Error("FOOTNOTE_SOURCE_UNSUPPORTED");
  if (note.content === content) return source;
  const lines = content.replace(/\r\n/gu, "\n").split("\n");
  return (
    note.marker +
    (note.separator || (lines[0] ? " " : "")) +
    lines.map((line, index) => (index && line ? "    " : "") + line).join(note.newline)
  );
}

/** Reserve unresolved references too, so inserting a note cannot silently bind them. */
export function newFootnoteSource(
  body: string,
  content = "脚注の内容を入力してください。",
): string {
  const used = new Set<string>();
  const visit = (node: BlockNode) => {
    if (
      (node.type === "footnoteDefinition" || node.type === "footnoteReference") &&
      node.identifier
    )
      used.add(node.identifier.toLowerCase());
    for (const child of node.children ?? []) visit(child);
  };
  try {
    visit(blockTree(body));
  } catch {
    // Incomplete source remains editable; the textual reservation still prevents collisions.
  }
  for (const match of body.matchAll(/\[\^([^\]\r\n]+)\]/gu)) used.add(match[1]!.toLowerCase());
  let number = 1;
  while (used.has("note-" + number)) number++;
  const source = "[^note-" + number + "]: 脚注の内容を入力してください。";
  return updateFootnoteContent(source, content);
}

/** Insert the reference and its definition together; neither an orphan nor a rich-text paste is required. */
export function insertFootnote(
  document: BlockDocument,
  after: number,
  content?: string,
): { document: BlockDocument; index: number } {
  const source = newFootnoteSource(writeBlockDocument(document), content);
  const reference = readFootnoteDefinition(source)!.marker.trim().slice(0, -1);
  const index = Math.max(0, Math.min(document.regions.length, after + 1));
  const withReference = insertRegion(document, reference, after);
  return { document: insertRegion(withReference, source, index), index: index + 1 };
}

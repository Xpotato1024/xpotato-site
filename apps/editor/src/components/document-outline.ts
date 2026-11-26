import { blockTree, moduleNames, type BlockNode } from "@xpotato/editor-core/blocks";
import { blockChoices } from "./blocks/BlockPalette.js";

export interface OutlineEntry {
  start: number;
  end: number;
  title: string;
  depth: number;
  parentStart: number | null;
  kind: string;
  group: boolean;
  detail: string;
}

function nodeText(node: BlockNode): string {
  if (node.type === "image") return node.alt ?? "";
  const separator = ["list", "listItem", "blockquote", "tableRow"].includes(node.type) ? " / " : "";
  return node.value ?? (node.children ?? []).map(nodeText).join(separator);
}

function attribute(node: BlockNode, name: string): string {
  const value = node.attributes?.find(
    (item) => item.type === "mdxJsxAttribute" && item.name === name,
  )?.value;
  return typeof value === "string" ? value : "";
}

function excerpt(value: string): string {
  const text = value.replace(/\s+/gu, " ").trim();
  const characters = Array.from(text);
  return characters.length > 90 ? characters.slice(0, 90).join("") + "…" : text;
}

function describeNode(node: BlockNode, source: string, groupNumber: number) {
  if (node.type === "footnoteDefinition") {
    return { kind: "footnote", title: excerpt(nodeText(node)) || "脚注", detail: "脚注 · " + (node.label ?? node.identifier ?? "") };
  }
  if (node.type === "mdxJsxFlowElement" && node.name && moduleNames.includes(node.name)) {
    const label = blockChoices.find((choice) => choice.kind === node.name)?.label ?? node.name;
    if (node.name === "Group") {
      return {
        kind: node.name,
        title: "グループ " + groupNumber,
        detail: (node.children?.length ?? 0) + "ブロック",
      };
    }
    const description =
      attribute(node, "title") ||
      attribute(node, "label") ||
      attribute(node, "caption") ||
      attribute(node, "alt") ||
      attribute(node, "summary") ||
      attribute(node, "symptom") ||
      (node.name === "Comparison"
        ? [attribute(node, "leftLabel"), attribute(node, "rightLabel")].filter(Boolean).join(" / ")
        : "");
    return {
      kind: node.name,
      title: excerpt(description) || label,
      detail: description ? label : node.children?.length ? node.children.length + "ブロック" : "",
    };
  }
  if (node.type === "code") {
    const math = node.lang === "math";
    return {
      kind: math ? "math" : "code",
      title: excerpt(
        (math ? /^label="(.*?)"/u.exec(node.meta ?? "")?.[1] : undefined) ||
          (node.value ?? "").split("\n").find((line) => line.trim()) ||
          (math ? "数式" : "コード"),
      ),
      detail: math ? "数式" : ["コード", node.lang].filter(Boolean).join(" · "),
    };
  }
  if (node.type === "table") {
    return {
      kind: "table",
      title: excerpt(node.children?.[0] ? nodeText(node.children[0]) : "") || "表",
      detail: "表 · " + Math.max(0, (node.children?.length ?? 1) - 1) + "行",
    };
  }
  if (
    node.type === "paragraph" &&
    node.children?.length === 1 &&
    node.children[0]?.type === "image"
  ) {
    return { kind: "Figure", title: excerpt(nodeText(node)) || "画像", detail: "画像・図" };
  }
  const kind =
    node.type === "list"
      ? node.ordered
        ? "orderedList"
        : "list"
      : node.type === "blockquote"
        ? "quote"
        : node.type === "thematicBreak"
          ? "divider"
          : node.type;
  const choice = blockChoices.find((item) => item.kind === kind);
  return {
    kind: choice ? kind : "code",
    title: excerpt(choice ? nodeText(node) : source) || choice?.label || "MDX",
    detail: node.type === "heading" ? "見出し " + (node.depth ?? 2) : (choice?.label ?? "MDX"),
  };
}

export function buildDocumentOutline(body: string): OutlineEntry[] {
  const result: OutlineEntry[] = [];
  let groupNumber = 0;
  try {
    const visit = (node: BlockNode, depth: number, parentStart: number | null) => {
      const start = node.position?.start.offset;
      const end = node.position?.end.offset;
      if (start === undefined || end === undefined) return;
      const group = node.type === "mdxJsxFlowElement" && node.name === "Group";
      if (group) groupNumber++;
      result.push({
        start,
        end,
        depth,
        parentStart,
        group,
        ...describeNode(node, body.slice(start, end), groupNumber),
      });
      // Rich text owns its lists, quotes and inline formatting; only module children are separate blocks.
      if (node.type === "mdxJsxFlowElement" && node.name && moduleNames.includes(node.name)) {
        for (const child of node.children ?? []) visit(child, depth + 1, start);
      }
    };
    for (const node of blockTree(body).children ?? []) visit(node, 0, null);
  } catch {
    // Incomplete MDX stays editable; the outline never rewrites it.
  }
  return result;
}

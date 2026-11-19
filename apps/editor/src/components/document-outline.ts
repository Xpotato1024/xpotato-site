import { blockTree, type BlockNode } from "@xpotato/editor-core/blocks";

export interface OutlineEntry {
  start: number;
  end: number;
  title: string;
  depth: number;
  group: boolean;
  detail: string;
}

function nodeText(node: BlockNode): string {
  return node.value ?? (node.children ?? []).map(nodeText).join("");
}

export function buildDocumentOutline(body: string): OutlineEntry[] {
  const result: OutlineEntry[] = [];
  let groupNumber = 0;
  try {
    const visit = (node: BlockNode, groupDepth: number) => {
      const group = node.type === "mdxJsxFlowElement" && node.name === "Group";
      const heading = node.type === "heading";
      if (
        (group || heading) &&
        node.position?.start.offset !== undefined &&
        node.position.end.offset !== undefined
      ) {
        if (group) groupNumber++;
        result.push({
          start: node.position.start.offset,
          end: node.position.end.offset,
          title: group ? "グループ " + groupNumber : nodeText(node),
          depth: groupDepth + (heading ? (node.depth ?? 2) - 1 : 0),
          group,
          detail: group ? (node.children?.length ?? 0) + "ブロック" : "見出し " + (node.depth ?? 2),
        });
      }
      for (const child of node.children ?? []) visit(child, groupDepth + (group ? 1 : 0));
    };
    visit(blockTree(body), 0);
  } catch {
    // Incomplete MDX stays editable; the outline never rewrites it.
  }
  return result;
}

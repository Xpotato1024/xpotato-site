import { useMemo } from "react";
import { blockTree, type BlockNode } from "@xpotato/editor-core/blocks";

function nodeText(node: BlockNode): string {
  return node.value ?? (node.children ?? []).map(nodeText).join("");
}

export function DocumentOutline({
  body,
  onLocate,
}: {
  body: string;
  onLocate: (start: number, end: number) => void;
}) {
  const entries = useMemo(() => {
    const result: { start: number; end: number; title: string; depth: number; group: boolean }[] =
      [];
    try {
      const visit = (node: BlockNode, groupDepth: number) => {
        const group = node.type === "mdxJsxFlowElement" && node.name === "Group";
        const heading = node.type === "heading";
        if (
          (group || heading) &&
          node.position?.start.offset !== undefined &&
          node.position.end.offset !== undefined
        ) {
          result.push({
            start: node.position.start.offset,
            end: node.position.end.offset,
            title: group
              ? nodeText(
                  node.children?.find((child) => child.type === "heading") ?? {
                    type: "text",
                    value: "見出しなし",
                  },
                )
              : nodeText(node),
            depth: groupDepth + (heading ? (node.depth ?? 2) - 1 : 0),
            group,
          });
        }
        for (const child of node.children ?? []) visit(child, groupDepth + (group ? 1 : 0));
      };
      visit(blockTree(body), 0);
    } catch {
      // Incomplete MDX stays editable; the outline never rewrites it.
    }
    return result;
  }, [body]);
  return (
    <section className="document-outline" aria-label="記事構成">
      {entries.length ? (
        <ol>
          {entries.map((entry) => (
            <li key={entry.start} data-depth={Math.min(3, entry.depth)}>
              <button type="button" onClick={() => onLocate(entry.start, entry.end)}>
                <span className="outline-kind">{entry.group ? "グループ" : "見出し"}</span>
                <span>{entry.title}</span>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">見出しやグループを追加すると、ここから移動できます。</p>
      )}
    </section>
  );
}

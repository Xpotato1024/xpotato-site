import { useId, useMemo } from "react";
import { mermaidInput } from "../../../../../ops/media/visuals/inputs.mjs";

type ParsedGraph = ReturnType<typeof mermaidInput>;
type PlacedNode = ParsedGraph["nodes"][number] & { x: number; y: number };
type PlacedEdge = { path: string; label: string; x: number; y: number };
type GraphLayout = {
  title: string;
  description: string;
  nodes: PlacedNode[];
  edges: PlacedEdge[];
  width: number;
  height: number;
};

const nodeWidth = 220;
const nodeHeight = 106;
const horizontalGap = 46;
const verticalGap = 72;
const padding = 32;

function linesOf(label: string): string[] {
  const chars = Array.from(label);
  const lines: string[] = [];
  for (let i = 0; i < chars.length; i += 15) lines.push(chars.slice(i, i + 15).join(""));
  return lines;
}

/**
 * Compact, safe structural preview for the bounded flowchart subset.
 * The canonical Mermaid renderer remains the offline publication image pipeline;
 * shipping all Mermaid diagram engines in the PWA exceeds its public asset budget.
 */
function layoutGraph(source: string): GraphLayout {
  const graph = mermaidInput(source);
  const direction = /^flowchart (TB|TD|LR|RL|BT)/u.exec(source.trimStart())?.[1] ?? "TB";
  const horizontal = direction === "LR" || direction === "RL";
  const reversed = direction === "RL" || direction === "BT";

  const ranks = new Map(graph.nodes.map((node) => [node.id, 0]));
  const indegrees = new Map(graph.nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(graph.nodes.map((node) => [node.id, [] as string[]]));
  for (const edge of graph.edges) {
    indegrees.set(edge.to, indegrees.get(edge.to)! + 1);
    outgoing.get(edge.from)!.push(edge.to);
  }

  const queue = graph.nodes.filter((node) => indegrees.get(node.id) === 0).map((node) => node.id);
  const visited = new Set<string>();
  for (let i = 0; i < queue.length; i++) {
    const from = queue[i]!;
    visited.add(from);
    for (const to of outgoing.get(from)!) {
      ranks.set(to, Math.max(ranks.get(to)!, ranks.get(from)! + 1));
      indegrees.set(to, indegrees.get(to)! - 1);
      if (indegrees.get(to) === 0) queue.push(to);
    }
  }
  // A bounded fallback also renders graphs containing a cycle or no root.
  for (const node of graph.nodes) {
    if (!visited.has(node.id))
      ranks.set(node.id, Math.min(ranks.get(node.id)!, graph.nodes.length));
  }

  const maxRank = Math.max(...ranks.values());
  const columns = new Map<number, typeof graph.nodes>();
  for (const node of graph.nodes) {
    const rank = reversed ? maxRank - ranks.get(node.id)! : ranks.get(node.id)!;
    const group = columns.get(rank) ?? [];
    group.push(node);
    columns.set(rank, group);
  }
  const columnCount = maxRank + 1;
  const crossCount = Math.max(...Array.from(columns.values(), (items) => items.length));
  const width = horizontal
    ? 2 * padding + columnCount * nodeWidth + (columnCount - 1) * horizontalGap
    : 2 * padding + crossCount * nodeWidth + (crossCount - 1) * horizontalGap;
  const height = horizontal
    ? 2 * padding + crossCount * nodeHeight + (crossCount - 1) * verticalGap
    : 2 * padding + columnCount * nodeHeight + (columnCount - 1) * verticalGap;

  const nodes: PlacedNode[] = [];
  for (const [rank, entries] of columns) {
    entries.forEach((node, index) => {
      const crossOffset =
        ((crossCount - entries.length) *
          (horizontal ? nodeHeight + verticalGap : nodeWidth + horizontalGap)) /
        2;
      nodes.push({
        ...node,
        x: horizontal
          ? padding + rank * (nodeWidth + horizontalGap)
          : padding + crossOffset + index * (nodeWidth + horizontalGap),
        y: horizontal
          ? padding + crossOffset + index * (nodeHeight + verticalGap)
          : padding + rank * (nodeHeight + verticalGap),
      });
    });
  }
  const placed = new Map(nodes.map((node) => [node.id, node]));
  const edges: PlacedEdge[] = graph.edges.map((edge) => {
    const from = placed.get(edge.from)!;
    const to = placed.get(edge.to)!;
    const forward = horizontal ? (reversed ? -1 : 1) : reversed ? -1 : 1;
    const x1 = horizontal ? from.x + (forward > 0 ? nodeWidth : 0) : from.x + nodeWidth / 2;
    const y1 = horizontal ? from.y + nodeHeight / 2 : from.y + (forward > 0 ? nodeHeight : 0);
    const x2 = horizontal ? to.x + (forward > 0 ? 0 : nodeWidth) : to.x + nodeWidth / 2;
    const y2 = horizontal ? to.y + nodeHeight / 2 : to.y + (forward > 0 ? 0 : nodeHeight);
    const bend = horizontal
      ? Math.max(18, Math.abs(x2 - x1) / 2)
      : Math.max(18, Math.abs(y2 - y1) / 2);
    const path = horizontal
      ? "M " +
        x1 +
        " " +
        y1 +
        " C " +
        (x1 + forward * bend) +
        " " +
        y1 +
        " " +
        (x2 - forward * bend) +
        " " +
        y2 +
        " " +
        x2 +
        " " +
        y2
      : "M " +
        x1 +
        " " +
        y1 +
        " C " +
        x1 +
        " " +
        (y1 + forward * bend) +
        " " +
        x2 +
        " " +
        (y2 - forward * bend) +
        " " +
        x2 +
        " " +
        y2;
    return { path, label: edge.label, x: (x1 + x2) / 2, y: (y1 + y2) / 2 - 8 };
  });

  return { title: graph.title, description: graph.description, nodes, edges, width, height };
}

export function MermaidPreview({ source }: { source: string }) {
  const markerId = "cms-mermaid-arrow-" + useId().replace(/[^A-Za-z0-9]/gu, "");
  const result = useMemo(() => {
    try {
      return { graph: layoutGraph(source), error: null };
    } catch (error) {
      return {
        graph: null,
        error: error instanceof Error ? error.message : "Mermaidの構文を確認してください。",
      };
    }
  }, [source]);
  const graph = result.graph;

  return (
    <figure className="cms-mermaid-preview" aria-label="Mermaid構成図の簡易プレビュー">
      {graph ? (
        <div>
          <svg
            viewBox={"0 0 " + graph.width + " " + graph.height}
            width={graph.width}
            height={graph.height}
            role="img"
            aria-labelledby={markerId + "-title " + markerId + "-desc"}
          >
            <title id={markerId + "-title"}>{graph.title}</title>
            <desc id={markerId + "-desc"}>{graph.description}</desc>
            <defs>
              <marker
                id={markerId}
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="4"
                orient="auto"
              >
                <path d="M0 0 L8 4 L0 8 Z" fill="currentColor" />
              </marker>
            </defs>
            {graph.edges.map((edge, i) => (
              <g key={i}>
                <path
                  d={edge.path}
                  stroke="currentColor"
                  strokeWidth="1.8"
                  fill="none"
                  markerEnd={"url(#" + markerId + ")"}
                />
                {edge.label && (
                  <text
                    x={edge.x}
                    y={edge.y}
                    fill="currentColor"
                    textAnchor="middle"
                    fontSize="12"
                    stroke="var(--surface)"
                    strokeWidth="5"
                    paintOrder="stroke"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            ))}
            {graph.nodes.map((node) => {
              const lines = linesOf(node.label);
              return (
                <g key={node.id}>
                  <rect
                    x={node.x}
                    y={node.y}
                    width={nodeWidth}
                    height={nodeHeight}
                    rx="10"
                    fill="var(--surface)"
                    stroke="var(--cms-block-accent)"
                    strokeWidth="2"
                  />
                  <text
                    x={node.x + nodeWidth / 2}
                    y={node.y + nodeHeight / 2 - (lines.length - 1) * 10}
                    fill="currentColor"
                    textAnchor="middle"
                    fontSize="15"
                  >
                    {lines.map((line, i) => (
                      <tspan x={node.x + nodeWidth / 2} dy={i ? 20 : 0} key={i}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      ) : (
        <p role="status" className="cms-field-error">
          {result.error}
        </p>
      )}
      <figcaption className="cms-chart-help">
        構成を確認する簡易プレビューです。正式公開する図版は既存のMermaid静的画像パイプラインで作成し、画像ブロックへ配置してください。
      </figcaption>
    </figure>
  );
}

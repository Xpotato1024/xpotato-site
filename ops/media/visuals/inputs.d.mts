export declare function mermaidInput(source: string): {
  title: string;
  description: string;
  nodes: Array<{ id: string; label: string }>;
  edges: Array<{ from: string; to: string; label: string }>;
};

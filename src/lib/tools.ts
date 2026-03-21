import type { CollectionEntry } from "astro:content";

export type ToolEntry = CollectionEntry<"tools">;

export const toolCategoryMeta = {
  all: {
    label: "すべて",
    description: "公開中のツールを一覧できます。"
  },
  calculation: {
    label: "計算",
    description: "数値計算や式の確認に使う小さなツール。"
  },
  documents: {
    label: "PDF操作",
    description: "PDF や文書処理を助けるツール。"
  },
  utility: {
    label: "ユーティリティ",
    description: "日々の作業を補助するブラウザ内ツール。"
  }
} as const;

export type ToolCategoryKey = keyof typeof toolCategoryMeta;

function normalizeValue(value?: string) {
  return value?.trim().toLowerCase() ?? "";
}

export function getToolCategoryKey(tool: ToolEntry): Exclude<ToolCategoryKey, "all"> {
  const explicit = normalizeValue(tool.data.category);

  if (explicit === "calculation" || explicit === "documents" || explicit === "utility") {
    return explicit;
  }

  if (explicit === "math") {
    return "calculation";
  }

  if (explicit === "pdf" || explicit === "document") {
    return "documents";
  }

  return "utility";
}

export function getToolCategoryLabel(category: ToolCategoryKey) {
  return toolCategoryMeta[category].label;
}

export function getToolCategoryHref(category: ToolCategoryKey) {
  return category === "all" ? "/tools/" : `/tools/category/${category}/`;
}

export function filterTools(tools: ToolEntry[], category: ToolCategoryKey) {
  if (category === "all") {
    return tools;
  }

  return tools.filter((tool) => getToolCategoryKey(tool) === category);
}

export function getToolCategoryItems(tools: ToolEntry[]) {
  const counts = {
    calculation: 0,
    documents: 0,
    utility: 0
  };

  for (const tool of tools) {
    counts[getToolCategoryKey(tool)] += 1;
  }

  const orderedKeys: ToolCategoryKey[] = ["all", "calculation", "documents", "utility"];

  return orderedKeys
    .filter((key) => key === "all" || counts[key] > 0)
    .map((key) => ({
      key,
      label: toolCategoryMeta[key].label,
      description: toolCategoryMeta[key].description,
      href: getToolCategoryHref(key),
      count: key === "all" ? tools.length : counts[key]
    }));
}

import type { CollectionEntry } from "astro:content";

export type BlogEntry = CollectionEntry<"blog">;

export const blogCategoryMeta = {
  all: {
    label: "すべて",
    description: "新着順で記事を一覧できます。"
  },
  infra: {
    label: "インフラ",
    description: "WSL や自宅 RAG、VPS 運用まわりの記録。"
  },
  tools: {
    label: "ツール",
    description: "ブラウザで使える小さな実験やツール。"
  },
  blog: {
    label: "雑記",
    description: "制作途中のメモや短い記録。"
  }
} as const;

export type BlogCategoryKey = keyof typeof blogCategoryMeta;

const infraTags = new Set([
  "ai",
  "anythingllm",
  "homelab",
  "migration",
  "qdrant",
  "qwen",
  "rag",
  "rerank",
  "self-hosted",
  "ssh",
  "storage",
  "tei",
  "troubleshooting",
  "vllm",
  "vps",
  "windows",
  "wsl",
  "wsl2"
]);

const toolTags = new Set(["tool", "tools"]);

function normalizeValue(value?: string) {
  return value?.trim().toLowerCase() ?? "";
}

export function getBlogCategoryKey(post: BlogEntry): Exclude<BlogCategoryKey, "all"> {
  const explicit = normalizeValue(post.data.category);

  if (explicit === "infra" || explicit === "tools" || explicit === "blog") {
    return explicit;
  }

  const tags = post.data.tags.map((tag) => normalizeValue(tag));

  if (tags.some((tag) => toolTags.has(tag))) {
    return "tools";
  }

  if (tags.some((tag) => infraTags.has(tag))) {
    return "infra";
  }

  return "blog";
}

export function getBlogCategoryLabel(category: BlogCategoryKey) {
  return blogCategoryMeta[category].label;
}

export function getBlogCategoryHref(category: BlogCategoryKey) {
  return category === "all" ? "/blog/" : `/blog/category/${category}/`;
}

export function filterBlogPosts(posts: BlogEntry[], category: BlogCategoryKey) {
  if (category === "all") {
    return posts;
  }

  return posts.filter((post) => getBlogCategoryKey(post) === category);
}

export function getBlogCategoryItems(posts: BlogEntry[]) {
  const counts = {
    infra: 0,
    tools: 0,
    blog: 0
  };

  for (const post of posts) {
    counts[getBlogCategoryKey(post)] += 1;
  }

  const orderedKeys: BlogCategoryKey[] = ["all", "infra", "tools", "blog"];

  return orderedKeys
    .filter((key) => key === "all" || counts[key] > 0)
    .map((key) => ({
      key,
      label: blogCategoryMeta[key].label,
      description: blogCategoryMeta[key].description,
      href: getBlogCategoryHref(key),
      count: key === "all" ? posts.length : counts[key]
    }));
}

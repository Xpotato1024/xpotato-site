import { taxonomyRegistrySchema } from "@xpotato/content-contracts";

export const taxonomyRegistry = taxonomyRegistrySchema.parse({
  schemaVersion: 1,
  blogCategories: [
    { id: "software", label: "ソフトウェア", description: "ソフトウェア設計と実装", slug: "software", indexable: true, aliases: [], status: "active", sortOrder: 10 },
    { id: "infrastructure", label: "インフラストラクチャ", description: "基盤と運用", slug: "infrastructure", indexable: true, aliases: [], status: "active", sortOrder: 20 },
    { id: "robotics", label: "ロボティクス", description: "ロボットと制御", slug: "robotics", indexable: true, aliases: [], status: "active", sortOrder: 30 },
  ],
  noteSubjects: [
    { id: "infrastructure", label: "インフラストラクチャ", description: "基盤作業のノート", slug: "infrastructure", indexable: true, aliases: [], status: "active", archive: true },
  ],
  toolCategories: [
    { id: "calculation", label: "計算", description: "計算用ツール", slug: "calculation", indexable: true, aliases: [], status: "active" },
  ],
  tags: [
    { id: "astro", label: "Astro", slug: "astro", kind: "technology", aliases: [], archive: true, indexable: true, status: "active" },
    { id: "wsl", label: "WSL", slug: "wsl", kind: "technology", aliases: [], archive: true, indexable: true, status: "active" },
    { id: "static-site", label: "静的サイト", slug: "static-site", kind: "topic", aliases: [], archive: true, indexable: true, status: "active" },
  ],
});

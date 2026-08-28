import type {
  ContentCollection,
  InteractiveModuleRecord,
  TaxonomyRegistry,
  ToolBindingRecord,
} from "@xpotato/content-contracts";

export interface ContentInvariantRecord {
  readonly contentId: string;
  readonly collection: ContentCollection;
  readonly route: string;
  readonly draft: boolean;
  readonly categoryId?: string;
  readonly subjectId?: string;
  readonly toolCategoryId?: string;
  readonly tagIds: readonly string[];
  readonly stackIds: readonly string[];
  readonly interactiveModuleIds: readonly string[];
}

export interface MediaRegistryInvariantRecord {
  readonly contentId: string;
  readonly assets: readonly Readonly<{ role: string; status: "active" | "retired" }>[];
}

export interface ContentModuleInvariantRecord {
  readonly id: string;
  readonly status: "active" | "retired";
  readonly allowedCollections: readonly ContentCollection[];
}

export interface RegistryInvariantInput {
  readonly contents: readonly ContentInvariantRecord[];
  readonly mediaRegistries: readonly MediaRegistryInvariantRecord[];
  readonly provenanceContentIds: readonly string[];
  readonly taxonomy: TaxonomyRegistry;
  readonly interactiveModules: Readonly<Record<string, InteractiveModuleRecord>>;
  readonly toolBindings: readonly ToolBindingRecord[];
  readonly interactiveComponentIds: readonly string[];
  readonly contentModules: readonly ContentModuleInvariantRecord[];
}

const compareUtf16 = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);
const normalizeTaxonomyToken = (value: string): string => value.normalize("NFKC").trim().toLowerCase();

const duplicateValues = (values: readonly string[]): string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort(compareUtf16);
};

const validateAliasAmbiguity = (taxonomy: TaxonomyRegistry): string[] => {
  const errors: string[] = [];
  for (const [namespace, records] of Object.entries({
    blogCategories: taxonomy.blogCategories,
    noteSubjects: taxonomy.noteSubjects,
    toolCategories: taxonomy.toolCategories,
    tags: taxonomy.tags,
  })) {
    const owners = new Map<string, string>();
    for (const record of records) {
      for (const token of [record.id, record.slug, record.label, ...record.aliases]) {
        const normalized = normalizeTaxonomyToken(token);
        const existing = owners.get(normalized);
        if (existing && existing !== record.id) {
          errors.push(`taxonomy alias ambiguity: ${namespace}:${normalized} -> ${existing},${record.id}`);
        } else {
          owners.set(normalized, record.id);
        }
      }
    }
  }
  return errors;
};

const activeTaxonomy = <T extends Readonly<{ id: string; status: "active" | "retired" }>>(
  records: readonly T[],
  id: string,
): T | undefined => records.find((record) => record.id === id && record.status === "active");

export const validateRegistryInvariants = (input: RegistryInvariantInput): readonly string[] => {
  const errors: string[] = [];
  const expectedContentModules = ["Figure", "Gallery", "Callout", "Steps", "Step", "Comparison", "LinkCard", "Details", "Demo"];
  for (const moduleId of expectedContentModules) {
    if (input.contentModules.filter((module) => module.id === moduleId && module.status === "active").length !== 1) {
      errors.push(`content module requires exactly one active registry record: ${moduleId}`);
    }
  }
  for (const duplicate of duplicateValues(input.contents.map((content) => content.contentId))) {
    errors.push(`global ContentId duplicate: ${duplicate}`);
  }
  for (const duplicate of duplicateValues(input.contents.map((content) => content.route))) {
    errors.push(`global route duplicate: ${duplicate}`);
  }
  const contentsById = new Map(input.contents.map((content) => [content.contentId, content]));

  for (const duplicate of duplicateValues(input.mediaRegistries.map((registry) => registry.contentId))) {
    errors.push(`duplicate Media Registry ContentId: ${duplicate}`);
  }
  for (const registry of input.mediaRegistries) {
    if (!contentsById.has(registry.contentId)) errors.push(`Media Registry ContentId does not resolve: ${registry.contentId}`);
  }
  for (const duplicate of duplicateValues(input.provenanceContentIds)) {
    errors.push(`duplicate provenance ContentId: ${duplicate}`);
  }
  for (const contentId of input.provenanceContentIds) {
    if (!contentsById.has(contentId)) errors.push(`provenance ContentId does not resolve: ${contentId}`);
  }
  for (const binding of input.toolBindings) {
    const content = contentsById.get(binding.contentId);
    if (!content) errors.push(`interactive binding ContentId does not resolve: ${binding.contentId}`);
    else if (content.collection !== "tools") errors.push(`primary Tool binding points to non-Tool content: ${binding.contentId}`);
  }

  errors.push(...validateAliasAmbiguity(input.taxonomy));
  for (const content of input.contents) {
    if (content.collection === "blog" && content.categoryId && !activeTaxonomy(input.taxonomy.blogCategories, content.categoryId)) {
      errors.push(`Blog category is unknown or retired: ${content.contentId}:${content.categoryId}`);
    }
    if (content.collection === "notes" && content.subjectId && !activeTaxonomy(input.taxonomy.noteSubjects, content.subjectId)) {
      errors.push(`Note subject is unknown or retired: ${content.contentId}:${content.subjectId}`);
    }
    if (content.collection === "tools" && content.toolCategoryId && !activeTaxonomy(input.taxonomy.toolCategories, content.toolCategoryId)) {
      errors.push(`Tool category is unknown or retired: ${content.contentId}:${content.toolCategoryId}`);
    }
    for (const tagId of content.tagIds) {
      if (!activeTaxonomy(input.taxonomy.tags, tagId)) errors.push(`tag is unknown or retired: ${content.contentId}:${tagId}`);
    }
    for (const stackId of content.stackIds) {
      const tag = activeTaxonomy(input.taxonomy.tags, stackId);
      if (!tag || tag.kind !== "technology") errors.push(`Project stack must reference an active technology tag: ${content.contentId}:${stackId}`);
    }
  }

  for (const content of input.contents.filter((record) => record.collection === "tools" && !record.draft)) {
    const activeBindings = input.toolBindings.filter(
      (binding) => binding.contentId === content.contentId && binding.status === "active" && binding.role === "primary_tool",
    );
    if (activeBindings.length !== 1) {
      errors.push(`published Tool requires exactly one active primary binding: ${content.contentId}`);
    }
  }

  const componentIds = new Set(input.interactiveComponentIds);
  for (const [moduleId, module] of Object.entries(input.interactiveModules)) {
    if (module.id !== moduleId) errors.push(`interactive module key/id mismatch: ${moduleId}:${module.id}`);
    if (module.status === "active" && !componentIds.has(module.componentId)) {
      errors.push(`interactive component import missing: ${moduleId}:${module.componentId}`);
    }
  }
  const demoModule = input.contentModules.find((module) => module.id === "Demo" && module.status === "active");
  for (const content of input.contents) {
    for (const moduleId of content.interactiveModuleIds) {
      const module = input.interactiveModules[moduleId];
      if (!module || module.status !== "active") errors.push(`interactive module is unknown or retired: ${content.contentId}:${moduleId}`);
      else if (!module.allowedCollections.includes(content.collection)) {
        errors.push(`interactive module collection mismatch: ${content.contentId}:${moduleId}`);
      }
      if (!demoModule || !demoModule.allowedCollections.includes(content.collection)) {
        errors.push(`Demo content module collection mismatch: ${content.contentId}`);
      }
    }
  }
  for (const binding of input.toolBindings.filter((record) => record.status === "active")) {
    const module = input.interactiveModules[binding.moduleId];
    if (!module || module.status !== "active") errors.push(`Tool binding module is unknown or retired: ${binding.moduleId}`);
    else if (module.role !== "primary_tool" || !module.allowedCollections.includes("tools")) {
      errors.push(`Tool binding module role/collection mismatch: ${binding.moduleId}`);
    }
  }

  const mediaByContentId = new Map(input.mediaRegistries.map((registry) => [registry.contentId, registry]));
  for (const blog of input.contents.filter((content) => content.collection === "blog" && !content.draft)) {
    const assets = mediaByContentId.get(blog.contentId)?.assets ?? [];
    const activeHeroes = assets.filter((asset) => asset.status === "active" && asset.role === "hero").length;
    const activeSocialCards = assets.filter((asset) => asset.status === "active" && asset.role === "social_card").length;
    if (activeHeroes !== 1) errors.push(`published Blog requires exactly one active hero: ${blog.contentId}`);
    if (activeSocialCards !== 1) errors.push(`published Blog requires exactly one active social_card: ${blog.contentId}`);
  }

  return Object.freeze(errors.sort(compareUtf16));
};

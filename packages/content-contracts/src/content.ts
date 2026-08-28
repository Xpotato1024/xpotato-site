import { z } from "zod";
import {
  contentCollectionSchema,
  contentIdSchema,
  httpsUrlSchema,
  isoDateSchema,
  slugSchema,
  stableIdSchema,
} from "./common.js";

export const seoOverrideSchema = z
  .object({
    canonicalOverride: httpsUrlSchema.optional(),
    noindex: z.boolean().optional(),
    titleOverride: z.string().min(1).optional(),
    descriptionOverride: z.string().min(1).optional(),
  })
  .strict();

const datedFrontmatterShape = {
  id: contentIdSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  pubDate: isoDateSchema,
  updatedDate: isoDateSchema.optional(),
};
const publicationShape = {
  draft: z.boolean(),
  legacyUrls: z.array(z.string().min(1)).optional(),
  seo: seoOverrideSchema.optional(),
};

const uniqueStableIdArraySchema = z.array(stableIdSchema).superRefine((values, context) => {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    if (seen.has(value)) {
      context.addIssue({ code: "custom", message: "IDs must be unique", path: [index] });
    }
    seen.add(value);
  });
});

const withDateOrder = <T extends z.ZodType>(schema: T) =>
  schema.refine(
    (value) => {
      const dates = value as { pubDate: string; updatedDate?: string | undefined };
      return !dates.updatedDate || dates.pubDate <= dates.updatedDate;
    },
    { message: "updatedDate must not precede pubDate", path: ["updatedDate"] },
  );

export const blogFrontmatterSchema = withDateOrder(
  z
    .object({
      ...datedFrontmatterShape,
      category: stableIdSchema,
      tags: uniqueStableIdArraySchema,
      ...publicationShape,
      featured: z.boolean().optional(),
    })
    .strict(),
);

export const noteFrontmatterSchema = withDateOrder(
  z
    .object({
      ...datedFrontmatterShape,
      subject: stableIdSchema,
      tags: uniqueStableIdArraySchema,
      ...publicationShape,
    })
    .strict(),
);

export const projectFrontmatterSchema = withDateOrder(
  z
    .object({
      ...datedFrontmatterShape,
      startedDate: isoDateSchema.optional(),
      completedDate: isoDateSchema.optional(),
      status: z.enum(["planned", "active", "paused", "completed", "archived"]),
      tags: uniqueStableIdArraySchema,
      stack: z.array(stableIdSchema).optional(),
      featured: z.boolean().optional(),
      featuredOrder: z.number().int().nonnegative().optional(),
      links: z
        .object({
          repository: httpsUrlSchema.optional(),
          demo: httpsUrlSchema.optional(),
          documentation: httpsUrlSchema.optional(),
        })
        .strict()
        .optional(),
      sourceAvailability: z.enum(["public", "private", "mixed", "not_applicable"]).optional(),
      ...publicationShape,
    })
    .strict()
    .superRefine((value, context) => {
      if (value.featuredOrder !== undefined && value.featured !== true) {
        context.addIssue({
          code: "custom",
          message: "featuredOrder requires featured=true",
          path: ["featuredOrder"],
        });
      }
      if (value.startedDate && value.completedDate && value.startedDate > value.completedDate) {
        context.addIssue({
          code: "custom",
          message: "completedDate must not precede startedDate",
          path: ["completedDate"],
        });
      }
    }),
);

export const toolFrontmatterSchema = withDateOrder(
  z
    .object({
      ...datedFrontmatterShape,
      category: stableIdSchema,
      tags: uniqueStableIdArraySchema,
      featured: z.boolean().optional(),
      ...publicationShape,
    })
    .strict(),
);

export const pageFrontmatterSchema = z
  .object({
    id: contentIdSchema,
    title: z.string().min(1),
    description: z.string().min(1),
    updatedDate: isoDateSchema.optional(),
    ...publicationShape,
  })
  .strict();

const taxonomyStatusSchema = z.enum(["active", "retired"]);
const taxonomyBaseShape = {
  id: stableIdSchema,
  label: z.string().min(1),
  description: z.string().min(1),
  slug: slugSchema,
  indexable: z.boolean(),
  aliases: z.array(z.string().min(1)),
  status: taxonomyStatusSchema,
};

export const categoryRecordSchema = z
  .object({ ...taxonomyBaseShape, sortOrder: z.number().int().optional() })
  .strict();
export const noteSubjectRecordSchema = z
  .object({ ...taxonomyBaseShape, archive: z.boolean() })
  .strict();
export const toolCategoryRecordSchema = z.object(taxonomyBaseShape).strict();
export const tagRecordSchema = z
  .object({
    id: stableIdSchema,
    label: z.string().min(1),
    slug: slugSchema,
    kind: z.enum(["technology", "topic"]),
    description: z.string().min(1).optional(),
    aliases: z.array(z.string().min(1)),
    archive: z.boolean(),
    indexable: z.boolean(),
    status: taxonomyStatusSchema,
  })
  .strict();

export const taxonomyRegistrySchema = z
  .object({
    schemaVersion: z.literal(1),
    blogCategories: z.array(categoryRecordSchema),
    noteSubjects: z.array(noteSubjectRecordSchema),
    toolCategories: z.array(toolCategoryRecordSchema),
    tags: z.array(tagRecordSchema),
  })
  .strict()
  .superRefine((value, context) => {
    for (const [namespace, records] of Object.entries({
      blogCategories: value.blogCategories,
      noteSubjects: value.noteSubjects,
      toolCategories: value.toolCategories,
      tags: value.tags,
    })) {
      for (const field of ["id", "slug"] as const) {
        const values = records.map((record) => record[field]);
        if (new Set(values).size !== values.length) {
          context.addIssue({ code: "custom", message: `${namespace} ${field}s must be unique`, path: [namespace] });
        }
      }
    }
  });

export const contentRouteRecordSchema = z
  .object({
    contentId: contentIdSchema,
    collection: contentCollectionSchema,
    slug: slugSchema,
    route: z.string().startsWith("/"),
    canonical: z.boolean(),
  })
  .strict();
export const applicationRedirectRecordSchema = z
  .object({
    id: stableIdSchema,
    sourcePath: z.string().startsWith("/"),
    targetPath: z.string().startsWith("/"),
    status: z.literal(301),
    reason: z.enum(["content_route_change", "legacy_path", "site_structure_change"]),
    contentId: contentIdSchema.optional(),
    statusLifecycle: z.enum(["active", "retired"]),
  })
  .strict()
  .refine((value) => value.sourcePath !== value.targetPath, {
    message: "redirect source and target must differ",
  });
export const providerRedirectRequirementSchema = z
  .object({
    id: stableIdSchema,
    match: z.union([
      z
        .object({ kind: z.literal("query"), path: z.string().startsWith("/"), query: z.record(z.string(), z.string()) })
        .strict(),
      z
        .object({ kind: z.literal("host"), host: z.string().min(1), path: z.string().startsWith("/").optional() })
        .strict(),
    ]),
    targetUrl: httpsUrlSchema,
    permanent: z.literal(true),
    reason: z.string().min(1),
    contentId: contentIdSchema.optional(),
  })
  .strict();

export const navigationItemSchema = z
  .object({
    id: stableIdSchema,
    label: z.string().min(1),
    href: z.string().min(1),
    order: z.number().int(),
    location: z.array(z.enum(["header", "footer"])).min(1),
    status: taxonomyStatusSchema,
  })
  .strict();
export const socialLinkSchema = z
  .object({
    id: stableIdSchema,
    label: z.string().min(1),
    href: httpsUrlSchema,
    rel: z.array(z.string().min(1)).optional(),
    status: taxonomyStatusSchema,
  })
  .strict();
export const siteConfigSchema = z
  .object({
    site: z
      .object({
        name: z.string().min(1),
        shortName: z.string().min(1),
        canonicalOrigin: httpsUrlSchema.refine((value) => new URL(value).pathname === "/"),
        locale: z.literal("ja-JP"),
        language: z.literal("ja"),
        timezone: z.literal("Asia/Tokyo"),
        defaultDescription: z.string().min(1),
      })
      .strict(),
    publisher: z.object({ displayName: z.string().min(1), profilePath: z.string().startsWith("/").optional() }).strict(),
    navigation: z.array(navigationItemSchema),
    socialLinks: z.array(socialLinkSchema),
    discovery: z.object({ rssPath: z.literal("/rss.xml"), searchPath: z.literal("/search/") }).strict(),
  })
  .strict();

export const contentModuleRecordSchema = z
  .object({
    id: z.enum(["Figure", "Gallery", "Callout", "Steps", "Step", "Comparison", "LinkCard", "Details", "Demo"]),
    status: taxonomyStatusSchema,
    allowedCollections: z.array(contentCollectionSchema).min(1),
    allowsChildren: z.boolean(),
  })
  .strict();

export const figureModulePropsSchema = z
  .object({
    asset: stableIdSchema,
    alt: z.string().min(1),
    caption: z.string().min(1).optional(),
    credit: z.string().min(1).optional(),
    sourceUrl: httpsUrlSchema.optional(),
    width: z.enum(["content", "wide", "full"]).optional(),
  })
  .strict();
export const galleryModulePropsSchema = z
  .object({ label: z.string().min(1).optional(), width: z.enum(["content", "wide"]).optional() })
  .strict();
export const calloutModulePropsSchema = z
  .object({ kind: z.enum(["note", "tip", "warning", "important"]), title: z.string().min(1).optional() })
  .strict();
export const stepsModulePropsSchema = z.object({}).strict();
export const stepModulePropsSchema = z.object({ title: z.string().min(1), result: z.string().min(1).optional() }).strict();
export const comparisonModulePropsSchema = z.object({ leftLabel: z.string().min(1), rightLabel: z.string().min(1) }).strict();
export const linkCardModulePropsSchema = z
  .object({
    href: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1).optional(),
    label: z.string().min(1).optional(),
    external: z.boolean().optional(),
  })
  .strict();
export const detailsModulePropsSchema = z.object({ summary: z.string().min(1), open: z.boolean().optional() }).strict();
export const demoModulePropsSchema = z
  .object({ module: stableIdSchema, title: z.string().min(1).optional(), description: z.string().min(1).optional() })
  .strict();

export const semanticContentModulePropsSchemas = Object.freeze({
  Figure: figureModulePropsSchema,
  Gallery: galleryModulePropsSchema,
  Callout: calloutModulePropsSchema,
  Steps: stepsModulePropsSchema,
  Step: stepModulePropsSchema,
  Comparison: comparisonModulePropsSchema,
  LinkCard: linkCardModulePropsSchema,
  Details: detailsModulePropsSchema,
  Demo: demoModulePropsSchema,
});

export const interactiveModuleRecordSchema = z
  .object({
    id: stableIdSchema,
    framework: z.literal("react"),
    componentId: stableIdSchema,
    hydration: z.enum(["load", "idle", "visible", "media"]),
    mediaQuery: z.string().min(1).optional(),
    allowedCollections: z.array(contentCollectionSchema).min(1),
    role: z.enum(["primary_tool", "inline_demo"]),
    status: taxonomyStatusSchema,
    apiVersion: z.number().int().positive(),
    budgetClass: z.enum(["small", "medium", "large"]),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.hydration === "media" && !value.mediaQuery) {
      context.addIssue({ code: "custom", message: "media hydration requires mediaQuery", path: ["mediaQuery"] });
    }
    if (value.hydration !== "media" && value.mediaQuery) {
      context.addIssue({ code: "custom", message: "mediaQuery is only valid for media hydration", path: ["mediaQuery"] });
    }
  });
export const toolBindingRecordSchema = z
  .object({
    contentId: contentIdSchema,
    moduleId: stableIdSchema,
    role: z.literal("primary_tool"),
    status: taxonomyStatusSchema,
  })
  .strict();

export const discoveryProfileSchema = z
  .object({
    schemaVersion: z.literal(1),
    pagination: z.object({ blogPageSize: z.number().int().positive(), notesPageSize: z.number().int().positive() }).strict(),
    feed: z
      .object({ enabled: z.boolean(), path: z.literal("/rss.xml"), maxItems: z.number().int().positive(), contentMode: z.enum(["summary", "full"]) })
      .strict(),
    related: z
      .object({
        maxItems: z.number().int().positive(),
        weights: z
          .object({
            sameCollection: z.number().nonnegative(),
            samePrimaryTaxonomy: z.number().nonnegative(),
            sharedTechnologyTag: z.number().nonnegative(),
            sharedTopicTag: z.number().nonnegative(),
          })
          .strict(),
        minimumScore: z.number().nonnegative(),
      })
      .strict(),
    search: z
      .object({
        enabled: z.boolean(),
        route: z.literal("/search/"),
        engine: z.literal("minisearch"),
        engineVersion: z.literal("7.2.0"),
        tokenizerId: z.literal("xpotato-ja-tech-bigram-v1"),
        includeCollections: z.array(contentCollectionSchema),
      })
      .strict(),
  })
  .strict();

export const contentDiscoveryRecordSchema = z
  .object({
    contentId: contentIdSchema,
    collection: contentCollectionSchema,
    route: z.string().startsWith("/"),
    title: z.string().min(1),
    description: z.string().min(1),
    pubDate: isoDateSchema.optional(),
    updatedDate: isoDateSchema.optional(),
    categoryId: stableIdSchema.optional(),
    subjectId: stableIdSchema.optional(),
    toolCategoryId: stableIdSchema.optional(),
    tagIds: z.array(stableIdSchema),
    featured: z.boolean(),
    heroAssetId: stableIdSchema.optional(),
    siteSearchEligible: z.boolean(),
    webIndexable: z.boolean(),
  })
  .strict();

export const searchDocumentSchema = z
  .object({
    id: contentIdSchema,
    route: z.string().startsWith("/"),
    collection: contentCollectionSchema,
    title: z.string().min(1),
    description: z.string().min(1),
    taxonomyText: z.string(),
    headingText: z.string(),
    bodyText: z.string(),
    cjkSingles: z.string(),
    pubDate: isoDateSchema.optional(),
  })
  .strict();

export const collectionVisualPolicySchema = z
  .object({
    collection: contentCollectionSchema,
    hero: z.enum(["required", "optional", "none"]),
    socialCard: z.enum(["required", "derived_if_needed", "site_default"]),
  })
  .strict();

export type BlogFrontmatter = z.infer<typeof blogFrontmatterSchema>;
export type SeoOverride = z.infer<typeof seoOverrideSchema>;
export type NoteFrontmatter = z.infer<typeof noteFrontmatterSchema>;
export type ProjectFrontmatter = z.infer<typeof projectFrontmatterSchema>;
export type ToolFrontmatter = z.infer<typeof toolFrontmatterSchema>;
export type PageFrontmatter = z.infer<typeof pageFrontmatterSchema>;
export type TaxonomyRegistry = z.infer<typeof taxonomyRegistrySchema>;
export type InteractiveModuleRecord = z.infer<typeof interactiveModuleRecordSchema>;
export type ToolBindingRecord = z.infer<typeof toolBindingRecordSchema>;
export type DiscoveryProfile = z.infer<typeof discoveryProfileSchema>;
export type ContentDiscoveryRecord = z.infer<typeof contentDiscoveryRecordSchema>;
export type SearchDocument = z.infer<typeof searchDocumentSchema>;

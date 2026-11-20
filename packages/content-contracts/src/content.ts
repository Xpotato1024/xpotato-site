import { z } from "zod";
import { validateSocialTitleLines } from "./social-title-layout.mjs";
import {
  contentCollectionSchema,
  contentIdSchema,
  httpsUrlSchema,
  isoDateSchema,
  isoDateTimeSchema,
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

// Optional authored instants. Keep date-only content valid and never infer midnight.
export const contentInstantSchema = isoDateTimeSchema.regex(
  /T[0-2]\d:[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:(?:0\d|1[0-3]):[0-5]\d|14:00))$/u,
);
const jstDateOf = (value: string) =>
  new Date(Date.parse(value) + 9 * 3_600_000).toISOString().slice(0, 10);
const instantFields = {
  publishedAt: contentInstantSchema.optional(),
  updatedAt: contentInstantSchema.optional(),
};
const datedFrontmatterShape = {
  id: contentIdSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  pubDate: isoDateSchema,
  updatedDate: isoDateSchema.optional(),
  ...instantFields,
};
const publicationShape = {
  draft: z.boolean(),
  feed: z.boolean().optional(),
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
  schema
    .refine(
      (value) => {
        const dates = value as { pubDate?: string; updatedDate?: string | undefined };
        return !dates.pubDate || !dates.updatedDate || dates.pubDate <= dates.updatedDate;
      },
      { message: "updatedDate must not precede pubDate", path: ["updatedDate"] },
    )
    .superRefine((value, context) => {
      const dates = value as {
        pubDate?: string;
        updatedDate?: string;
        publishedAt?: string;
        updatedAt?: string;
      };
      for (const [instant, date] of [
        ["publishedAt", "pubDate"],
        ["updatedAt", "updatedDate"],
      ] as const) {
        const text = dates[instant];
        if (
          text &&
          Number.isFinite(Date.parse(text)) &&
          (!dates[date] || jstDateOf(text) !== dates[date])
        )
          context.addIssue({
            code: "custom",
            message: instant + " requires the matching JST " + date,
            path: [instant],
          });
      }
      if (
        dates.publishedAt &&
        dates.updatedAt &&
        Date.parse(dates.updatedAt) < Date.parse(dates.publishedAt)
      )
        context.addIssue({
          code: "custom",
          message: "updatedAt must not precede publishedAt",
          path: ["updatedAt"],
        });
    });

export const educationSchema = z
  .object({
    subject: z.string().trim().min(1),
    audience: z.string().trim().min(1).optional(),
    prerequisites: z.string().trim().min(1).optional(),
    goals: z.array(z.string().trim().min(1)).optional(),
  })
  .strict();
export const educationDraftSchema = educationSchema.extend({ subject: z.string() });
export type EducationMetadata = z.infer<typeof educationSchema>;

const draftDatedFrontmatterShape = {
  ...datedFrontmatterShape,
  description: z.string(),
  pubDate: isoDateSchema.optional(),
};
const draftPublicationShape = { ...publicationShape, draft: z.literal(true) };
const cardDisplaySchema = z
  .object({ lines: z.array(z.string().min(1)).min(1).max(4).optional() })
  .strict();

export const blogFrontmatterSchema = withDateOrder(
  z
    .object({
      ...datedFrontmatterShape,
      category: stableIdSchema,
      tags: uniqueStableIdArraySchema,
      ...publicationShape,
      featured: z.boolean().optional(),
      cardDisplay: cardDisplaySchema.optional(),
      education: educationSchema.optional(),
    })
    .strict()
    .superRefine((value, context) => {
      if (value.cardDisplay === undefined) return;
      try {
        validateSocialTitleLines(value.title, value.cardDisplay.lines);
      } catch (error) {
        context.addIssue({
          code: "custom",
          message: error instanceof Error ? error.message : "CARD_LINES_INVALID",
          path: ["cardDisplay"],
        });
      }
    }),
);

// Draft authoring does not invent a publication date. Published contracts stay strict.
export const blogDraftFrontmatterSchema = withDateOrder(
  z
    .object({
      ...draftDatedFrontmatterShape,
      category: stableIdSchema,
      tags: uniqueStableIdArraySchema,
      ...draftPublicationShape,
      featured: z.boolean().optional(),
      cardDisplay: cardDisplaySchema.optional(),
      education: educationDraftSchema.optional(),
    })
    .strict(),
);
export const blogSourceFrontmatterSchema = z.union([
  blogFrontmatterSchema,
  blogDraftFrontmatterSchema,
]);
export type BlogSourceFrontmatter = z.infer<typeof blogSourceFrontmatterSchema>;

const noteFrontmatterShape = {
  subject: stableIdSchema,
  tags: uniqueStableIdArraySchema,
};
export const noteFrontmatterSchema = withDateOrder(
  z
    .object({
      ...datedFrontmatterShape,
      ...noteFrontmatterShape,
      ...publicationShape,
      education: educationSchema.optional(),
    })
    .strict(),
);
export const noteDraftFrontmatterSchema = withDateOrder(
  z
    .object({
      ...draftDatedFrontmatterShape,
      ...noteFrontmatterShape,
      ...draftPublicationShape,
      education: educationDraftSchema.optional(),
    })
    .strict(),
);
export const noteSourceFrontmatterSchema = z.union([
  noteFrontmatterSchema,
  noteDraftFrontmatterSchema,
]);
export type NoteSourceFrontmatter = z.infer<typeof noteSourceFrontmatterSchema>;

const projectFrontmatterShape = {
  startedDate: isoDateSchema.optional(),
  completedDate: isoDateSchema.optional(),
  status: z.enum(["planned", "active", "paused", "completed", "archived"]),
  tags: uniqueStableIdArraySchema,
  stack: uniqueStableIdArraySchema.optional(),
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
};
const withProjectOrder = <T extends z.ZodType>(schema: T) =>
  schema.superRefine((input, context) => {
    const value = input as {
      featuredOrder?: number;
      featured?: boolean;
      startedDate?: string;
      completedDate?: string;
    };
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
  });
export const projectFrontmatterSchema = withDateOrder(
  withProjectOrder(
    z
      .object({ ...datedFrontmatterShape, ...projectFrontmatterShape, ...publicationShape })
      .strict(),
  ),
);
export const projectDraftFrontmatterSchema = withDateOrder(
  withProjectOrder(
    z
      .object({
        ...draftDatedFrontmatterShape,
        ...projectFrontmatterShape,
        ...draftPublicationShape,
      })
      .strict(),
  ),
);
export const projectSourceFrontmatterSchema = z.union([
  projectFrontmatterSchema,
  projectDraftFrontmatterSchema,
]);
export type ProjectSourceFrontmatter = z.infer<typeof projectSourceFrontmatterSchema>;

const toolFrontmatterShape = {
  category: stableIdSchema,
  tags: uniqueStableIdArraySchema,
  featured: z.boolean().optional(),
};
export const toolFrontmatterSchema = withDateOrder(
  z.object({ ...datedFrontmatterShape, ...toolFrontmatterShape, ...publicationShape }).strict(),
);
export const toolDraftFrontmatterSchema = withDateOrder(
  z
    .object({ ...draftDatedFrontmatterShape, ...toolFrontmatterShape, ...draftPublicationShape })
    .strict(),
);
export const toolSourceFrontmatterSchema = z.union([
  toolFrontmatterSchema,
  toolDraftFrontmatterSchema,
]);
export type ToolSourceFrontmatter = z.infer<typeof toolSourceFrontmatterSchema>;

const pageFrontmatterShape = {
  id: contentIdSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  updatedDate: isoDateSchema.optional(),
};
export const pageFrontmatterSchema = z
  .object({ ...pageFrontmatterShape, ...publicationShape })
  .strict();
export const pageDraftFrontmatterSchema = z
  .object({
    ...pageFrontmatterShape,
    description: z.string(),
    ...draftPublicationShape,
  })
  .strict();
export const pageSourceFrontmatterSchema = z.union([
  pageFrontmatterSchema,
  pageDraftFrontmatterSchema,
]);
export type PageSourceFrontmatter = z.infer<typeof pageSourceFrontmatterSchema>;

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
  .object({
    ...taxonomyBaseShape,
    sortOrder: z.number().int().optional(),
    parentId: stableIdSchema.optional(),
  })
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
    kind: z.enum(["technology", "topic", "purpose"]),
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
          context.addIssue({
            code: "custom",
            message: `${namespace} ${field}s must be unique`,
            path: [namespace],
          });
        }
      }
    }
    const categories = new Map(value.blogCategories.map((record) => [record.id, record]));
    for (const category of value.blogCategories) {
      const visited = new Set<string>();
      let current: typeof category | undefined = category;
      while (current) {
        if (visited.has(current.id)) {
          context.addIssue({
            code: "custom",
            message: "Blog category hierarchy must be acyclic",
            path: ["blogCategories"],
          });
          break;
        }
        visited.add(current.id);
        if (visited.size > 3) {
          context.addIssue({
            code: "custom",
            message: "Blog categories support at most three levels",
            path: ["blogCategories"],
          });
          break;
        }
        const parentId: string | undefined = current.parentId;
        const parent: typeof category | undefined = parentId ? categories.get(parentId) : undefined;
        if (parentId && (!parent || (category.status === "active" && parent.status !== "active"))) {
          context.addIssue({
            code: "custom",
            message: "Blog category parent must exist and be active for active descendants",
            path: ["blogCategories"],
          });
          break;
        }
        current = parent;
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
        .object({
          kind: z.literal("query"),
          path: z.string().startsWith("/"),
          query: z.record(z.string(), z.string()),
        })
        .strict(),
      z
        .object({
          kind: z.literal("host"),
          host: z.string().min(1),
          path: z.string().startsWith("/").optional(),
        })
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
    publisher: z
      .object({
        displayName: z.string().min(1),
        profilePath: z.string().startsWith("/").optional(),
      })
      .strict(),
    navigation: z.array(navigationItemSchema),
    socialLinks: z.array(socialLinkSchema),
    discovery: z
      .object({ rssPath: z.literal("/rss.xml"), searchPath: z.literal("/search/") })
      .strict(),
  })
  .strict();

export const contentModuleRecordSchema = z
  .object({
    id: z.enum([
      "Group",
      "Figure",
      "Gallery",
      "Callout",
      "Steps",
      "Step",
      "Comparison",
      "ComparisonCase",
      "LineChart",
      "LinkCard",
      "Details",
      "Demo",
      "DiagnosticList",
      "DiagnosticItem",
      "ArticleEndnote",
      "BarChart",
    ]),
    status: taxonomyStatusSchema,
    allowedCollections: z.array(contentCollectionSchema).min(1),
    allowsChildren: z.boolean(),
  })
  .strict();

export const groupModulePropsSchema = z.object({}).strict();
export const figureModulePropsSchema = z
  .object({
    asset: stableIdSchema,
    alt: z.string().min(1),
    title: z.string().trim().min(1).max(120).optional(),
    caption: z.string().min(1).optional(),
    note: z.string().trim().min(1).max(600).optional(),
    credit: z.string().min(1).optional(),
    sourceUrl: httpsUrlSchema.optional(),
    width: z.enum(["content", "wide", "full", "compact"]).optional(),
  })
  .strict();
export const galleryModulePropsSchema = z
  .object({
    label: z.string().min(1).optional(),
    width: z.enum(["content", "wide"]).optional(),
    layout: z.enum(["images", "diagrams"]).optional(),
    columns: z.enum(["1", "2", "3", "4"]).optional(),
    tabletColumns: z.enum(["1", "2", "3", "4"]).optional(),
    mobileColumns: z.enum(["1", "2", "3", "4"]).optional(),
    gap: z.enum(["none", "small", "medium", "large"]).optional(),
    fit: z.enum(["contain", "cover"]).optional(),
  })
  .strict();
export const calloutModulePropsSchema = z
  .object({
    kind: z.enum(["note", "tip", "warning", "important"]),
    title: z.string().min(1).optional(),
  })
  .strict();
export const diagnosticListModulePropsSchema = z.object({}).strict();
export const articleEndnoteModulePropsSchema = z
  .object({
    title: z
      .string()
      .regex(/^[^\u0000-\u001f\u007f-\u009f\u2028\u2029]*$/u)
      .trim()
      .min(1)
      .max(100)
      .optional(),
  })
  .strict();
export const diagnosticItemModulePropsSchema = z
  .object({
    symptom: z.string().trim().min(1).max(120),
    check: z.string().trim().min(1).max(200),
    action: z.string().trim().min(1).max(300).optional(),
    reason: z.string().trim().min(1).max(400).optional(),
  })
  .strict();
export const stepsModulePropsSchema = z.object({}).strict();
export const stepModulePropsSchema = z
  .object({ title: z.string().min(1), result: z.string().min(1).optional() })
  .strict();
/** Original two-label Comparison remains valid; new cases own their labels. */
export const comparisonModulePropsSchema = z
  .object({
    leftLabel: z.string().min(1).optional(),
    rightLabel: z.string().min(1).optional(),
  })
  .strict()
  .refine((value) => Boolean(value.leftLabel) === Boolean(value.rightLabel));
export const comparisonCaseModulePropsSchema = z
  .object({ label: z.string().trim().min(1).max(120) })
  .strict();
export const linkCardModulePropsSchema = z
  .object({
    href: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1).optional(),
    label: z.string().min(1).optional(),
    external: z.boolean().optional(),
  })
  .strict();
export const detailsModulePropsSchema = z
  .object({ summary: z.string().min(1), open: z.boolean().optional() })
  .strict();
export const demoModulePropsSchema = z
  .object({
    module: stableIdSchema,
    title: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
  })
  .strict();

export const barChartRowsSchema = z
  .array(
    z
      .object({
        label: z.string().trim().min(1).max(120),
        value: z.number().finite().nonnegative(),
        note: z.string().trim().min(1).max(300).optional(),
        tone: z.enum(["accent", "muted"]).optional(),
      })
      .strict(),
  )
  .min(1)
  .max(30);
export const barChartModulePropsSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    unit: z.string().trim().min(1).max(30),
    max: z
      .string()
      .regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/u)
      .refine((value) => Number.isFinite(Number(value)) && Number(value) > 0),
    rows: z.string().min(1).max(24000),
  })
  .strict()
  .superRefine((value, context) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value.rows);
    } catch {
      context.addIssue({ code: "custom", message: "rows must be a JSON array", path: ["rows"] });
      return;
    }
    const rows = barChartRowsSchema.safeParse(parsed);
    if (!rows.success || rows.data.some((row) => row.value > Number(value.max))) {
      context.addIssue({
        code: "custom",
        message: "rows require nonnegative values within max",
        path: ["rows"],
      });
    }
  });

export const chartFitSchema = z.discriminatedUnion("method", [
  z.object({ method: z.literal("linear") }).strict(),
  z.object({ method: z.literal("quad") }).strict(),
  z.object({ method: z.literal("poly"), degree: z.literal(3).optional() }).strict(),
  z.object({ method: z.literal("exp") }).strict(),
  z.object({ method: z.literal("log") }).strict(),
  z.object({ method: z.literal("pow") }).strict(),
  z
    .object({ method: z.literal("loess"), bandwidth: z.number().finite().gt(0).max(1).optional() })
    .strict(),
]);

export const chartPointSeriesSchema = z
  .object({
    label: z.string().trim().min(1).max(100),
    role: z.enum(["observed", "curve"]).optional(),
    fit: chartFitSchema.optional(),
    points: z
      .array(
        z
          .object({
            x: z.number().finite().min(-1e12).max(1e12),
            y: z.number().finite().min(-1e12).max(1e12),
          })
          .strict(),
      )
      .min(1)
      .max(500),
  })
  .strict()
  .superRefine((series, context) => {
    const issue = (message: string) => context.addIssue({ code: "custom", message });
    if (series.role === "curve") {
      if (series.fit) issue("計算済み曲線には近似を追加できません。測定値の系列を選んでください。");
      if (
        series.points.length < 2 ||
        series.points.some((point, index) => index > 0 && point.x <= series.points[index - 1]!.x)
      )
        issue("計算済み曲線は2点以上必要です。Xを小さい順に並べ、重複を除いてください。");
    }
    if (!series.fit) return;
    const { method } = series.fit;
    const required = method === "poly" ? 4 : method === "quad" || method === "loess" ? 3 : 2;
    const unique = new Set(series.points.map((point) => point.x)).size;
    if (unique < required) issue(`この近似には異なるXの値が${required}種類以上必要です。`);
    if (method === "loess" && unique !== series.points.length)
      issue("LOESSはXが重複した測定点に対応していません。別の近似方法を選んでください。");
    const invalid = series.points.findIndex(
      (point) =>
        ((method === "log" || method === "pow") && point.x <= 0) ||
        ((method === "exp" || method === "pow") && point.y <= 0),
    );
    if (invalid >= 0)
      issue(
        `${invalid + 1}点目を確認してください。${method === "pow" ? "べき乗近似はXとY" : method === "log" ? "対数近似はX" : "指数近似はY"}が0より大きい値を必要とします。`,
      );
  });

export const chartFormulaSchema = z
  .object({
    expression: z.string().trim().min(1).max(500),
    xMin: z.number().finite().min(-1e12).max(1e12),
    xMax: z.number().finite().min(-1e12).max(1e12),
    samples: z.number().int().min(21).max(1001).optional(),
  })
  .strict()
  .refine((value) => value.xMin < value.xMax, {
    message: "理論式のXの最小値は、最大値より小さくしてください。",
    path: ["xMin"],
  });

export const chartFormulaSeriesSchema = z
  .object({
    label: z.string().trim().min(1).max(100),
    role: z.literal("formula"),
    formula: chartFormulaSchema,
  })
  .strict();

export const lineChartSeriesSchema = z
  .array(z.union([chartPointSeriesSchema, chartFormulaSeriesSchema]))
  .min(1)
  .max(6);
export type LineChartSeries = z.infer<typeof lineChartSeriesSchema>;

const chartAxisNumberSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u)
  .refine(
    (value) => {
      const number = Number(value);
      return (
        Number.isFinite(number) &&
        Math.abs(number) <= 1e12 &&
        !(number === 0 && /[1-9]/u.test(value.split(/[eE]/u)[0]!))
      );
    },
    { message: "軸の値は、絶対値が1兆以下の数値で指定してください。" },
  );
const chartAxisPaddingSchema = chartAxisNumberSchema.refine(
  (value) => Number(value) >= 0 && Number(value) <= 100,
  { message: "軸の余白は0〜100%で指定してください。" },
);

export const lineChartModulePropsSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(1000).optional(),
    xLabel: z.string().trim().min(1).max(60),
    yLabel: z.string().trim().min(1).max(60),
    kind: z.enum(["line", "scatter", "analysis"]).optional(),
    series: z.string().min(1).max(240000),
    xMin: chartAxisNumberSchema.optional(),
    xMax: chartAxisNumberSchema.optional(),
    yMin: chartAxisNumberSchema.optional(),
    yMax: chartAxisNumberSchema.optional(),
    xPadding: chartAxisPaddingSchema.optional(),
    yPadding: chartAxisPaddingSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    for (const axis of ["x", "y"] as const) {
      const min = value[`${axis}Min`];
      const max = value[`${axis}Max`];
      if (min !== undefined && max !== undefined && Number(min) >= Number(max)) {
        context.addIssue({
          code: "custom",
          path: [`${axis}Min`],
          message: `${axis === "x" ? "横軸" : "縦軸"}の最小値は、最大値より小さくしてください。`,
        });
      }
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(value.series);
    } catch {
      context.addIssue({
        code: "custom",
        path: ["series"],
        message: "系列のデータをJSONで指定してください。",
      });
      return;
    }
    const series = lineChartSeriesSchema.safeParse(parsed);
    if (!series.success) {
      context.addIssue({
        code: "custom",
        path: ["series"],
        message: series.error.issues.some((issue) => issue.code === "custom")
          ? series.error.issues
              .filter((issue) => issue.code === "custom")
              .map((issue) => `系列${Number(issue.path[0]) + 1}: ${issue.message}`)
              .join(" ")
          : "系列の名前と数値、理論式の設定を確認してください。6系列まで、測定値は各500点まで、数値の絶対値は1兆以下です。",
      });
      return;
    }
    if (
      (value.kind ?? "line") === "line" &&
      series.data.some(
        (item) =>
          item.role !== "formula" &&
          !item.fit &&
          (item.points.length < 2 ||
            item.points.some((point, index) => index > 0 && point.x <= item.points[index - 1]!.x)),
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["series"],
        message: "折れ線は各系列に2点以上必要です。Xの値を小さい順に並べ、重複を除いてください。",
      });
    }
  });

export const semanticContentModulePropsSchemas = Object.freeze({
  Group: groupModulePropsSchema,
  BarChart: barChartModulePropsSchema,
  LineChart: lineChartModulePropsSchema,
  Figure: figureModulePropsSchema,
  Gallery: galleryModulePropsSchema,
  Callout: calloutModulePropsSchema,
  Steps: stepsModulePropsSchema,
  Step: stepModulePropsSchema,
  Comparison: comparisonModulePropsSchema,
  ComparisonCase: comparisonCaseModulePropsSchema,
  LinkCard: linkCardModulePropsSchema,
  Details: detailsModulePropsSchema,
  Demo: demoModulePropsSchema,
  DiagnosticList: diagnosticListModulePropsSchema,
  DiagnosticItem: diagnosticItemModulePropsSchema,
  ArticleEndnote: articleEndnoteModulePropsSchema,
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
    releaseId: stableIdSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.hydration === "media" && !value.mediaQuery) {
      context.addIssue({
        code: "custom",
        message: "media hydration requires mediaQuery",
        path: ["mediaQuery"],
      });
    }
    if (value.hydration !== "media" && value.mediaQuery) {
      context.addIssue({
        code: "custom",
        message: "mediaQuery is only valid for media hydration",
        path: ["mediaQuery"],
      });
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
    pagination: z
      .object({
        blogPageSize: z.number().int().positive(),
        notesPageSize: z.number().int().positive(),
      })
      .strict(),
    feed: z
      .object({
        enabled: z.boolean(),
        path: z.literal("/rss.xml"),
        maxItems: z.number().int().positive(),
        contentMode: z.enum(["summary", "full"]),
      })
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

export const contentDiscoveryRecordSchema = withDateOrder(
  z
    .object({
      contentId: contentIdSchema,
      collection: contentCollectionSchema,
      route: z.string().startsWith("/"),
      title: z.string().min(1),
      description: z.string().min(1),
      pubDate: isoDateSchema.optional(),
      updatedDate: isoDateSchema.optional(),
      ...instantFields,
      categoryId: stableIdSchema.optional(),
      subjectId: stableIdSchema.optional(),
      toolCategoryId: stableIdSchema.optional(),
      tagIds: z.array(stableIdSchema),
      featured: z.boolean(),
      heroAssetId: stableIdSchema.optional(),
      siteSearchEligible: z.boolean(),
      webIndexable: z.boolean(),
      feed: z.boolean().optional(),
    })
    .strict(),
);

export const searchThumbnailSchema = z
  .object({
    src: httpsUrlSchema,
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    sources: z
      .array(
        z
          .object({
            type: z.enum(["image/avif", "image/webp", "image/jpeg", "image/png"]),
            candidates: z
              .array(z.object({ src: httpsUrlSchema, width: z.number().int().positive() }).strict())
              .min(1)
              .max(32),
          })
          .strict(),
      )
      .max(4),
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
    thumbnail: searchThumbnailSchema.optional(),
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

export function semanticContentModuleJsonSchemas() {
  return Object.fromEntries(
    Object.entries(semanticContentModulePropsSchemas).map(([name, schema]) => [
      name,
      z.toJSONSchema(schema, { unrepresentable: "any" }),
    ]),
  );
}

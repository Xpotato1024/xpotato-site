import { z } from "zod";
import { contentIdSchema, slugSchema, stableIdSchema } from "./common.js";

export const seriesEntrySchema = z
  .object({
    contentId: contentIdSchema,
    label: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export const seriesRecordSchema = z
  .object({
    id: stableIdSchema.max(120),
    slug: slugSchema,
    title: z.string().trim().min(1).max(200),
    description: z.string().max(2000),
    kind: z.enum(["series", "course"]),
    status: z.enum(["ongoing", "completed", "paused"]),
    entries: z.array(seriesEntrySchema),
  })
  .strict()
  .superRefine((series, context) => {
    const seen = new Set<string>();
    series.entries.forEach((entry, index) => {
      if (seen.has(entry.contentId)) {
        context.addIssue({
          code: "custom",
          path: ["entries", index, "contentId"],
          message: "ContentId must appear only once within a series",
        });
      }
      seen.add(entry.contentId);
    });
  });

/** Membership and reading order live here, never in individual frontmatter. */
export const seriesRegistrySchema = z
  .object({
    schemaVersion: z.literal(1),
    series: z.array(seriesRecordSchema),
  })
  .strict()
  .superRefine((registry, context) => {
    for (const key of ["id", "slug"] as const) {
      const seen = new Set<string>();
      registry.series.forEach((series, index) => {
        if (seen.has(series[key])) {
          context.addIssue({
            code: "custom",
            path: ["series", index, key],
            message: `Series ${key} must be unique`,
          });
        }
        seen.add(series[key]);
      });
    }
  });

export type SeriesEntry = z.infer<typeof seriesEntrySchema>;
export type SeriesRecord = z.infer<typeof seriesRecordSchema>;
export type SeriesRegistry = z.infer<typeof seriesRegistrySchema>;

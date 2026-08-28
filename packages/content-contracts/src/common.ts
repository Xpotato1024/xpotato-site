import { z } from "zod";

export const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/, "lowercase SHA-256 required");
export const contentIdSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    "lowercase canonical UUIDv4 required",
  );
export const stableIdSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "lowercase stable ID required");
export const slugSchema = stableIdSchema.max(120);
export const isoDateSchema = z.iso.date();
export const isoDateTimeSchema = z.iso.datetime({ offset: true });
export const httpsUrlSchema = z.url().refine((value) => value.startsWith("https://"), {
  message: "absolute HTTPS URL required",
});
export const repositoryRelativePathSchema = z
  .string()
  .min(1)
  .refine(
    (value) =>
      !value.startsWith("/") &&
      !value.startsWith("\\") &&
      !/^[a-zA-Z]:[\\/]/.test(value) &&
      !value.split(/[\\/]/).includes(".."),
    "repository-relative path required",
  );

export const contentCollectionSchema = z.enum(["blog", "notes", "projects", "tools", "pages"]);
export type ContentId = z.infer<typeof contentIdSchema>;
export type ContentCollection = z.infer<typeof contentCollectionSchema>;

export const artifactRefSchema = z
  .object({
    artifactId: stableIdSchema,
    sha256: sha256Schema,
    mediaType: z.string().min(1),
    sizeBytes: z.number().int().nonnegative(),
  })
  .strict();
export type ArtifactRef = z.infer<typeof artifactRefSchema>;

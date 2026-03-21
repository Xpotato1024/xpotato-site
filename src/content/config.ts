import { defineCollection, z } from "astro:content";

const seoFields = {
  canonical: z.string().url().optional(),
  ogImage: z.string().optional()
};

const blog = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    heroImage: z.string().optional(),
    legacyPath: z.string().optional(),
    ...seoFields
  })
});

const notes = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    subject: z.string(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    ...seoFields
  })
});

const projects = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    repoUrl: z.string().url().optional(),
    demoUrl: z.string().url().optional(),
    status: z.enum(["planning", "active", "archived"]),
    technologies: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
    confidential: z.boolean().default(false),
    summary: z.string(),
    coverImage: z.string().optional(),
    draft: z.boolean().default(false),
    ...seoFields
  })
});

const pages = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    draft: z.boolean().default(false),
    summary: z.string().optional(),
    ...seoFields
  })
});

export const collections = { blog, notes, projects, pages };

import {
  blogFrontmatterSchema,
  noteFrontmatterSchema,
  pageFrontmatterSchema,
  projectFrontmatterSchema,
  toolFrontmatterSchema,
} from "@xpotato/content-contracts";
import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { taxonomyRegistry } from "./content-registry/taxonomy/index.js";

const activeIds = (records: readonly Readonly<{ id: string; status: string }>[]) =>
  new Set(records.filter((record) => record.status === "active").map((record) => record.id));
const blogCategories = activeIds(taxonomyRegistry.blogCategories);
const noteSubjects = activeIds(taxonomyRegistry.noteSubjects);
const toolCategories = activeIds(taxonomyRegistry.toolCategories);
const tags = activeIds(taxonomyRegistry.tags);
const knownTags = <T extends { tags: string[] }>(value: T, context: { addIssue(issue: { code: "custom"; message: string; path: (string | number)[] }): void }) => {
  value.tags.forEach((tag, index) => {
    if (!tags.has(tag)) context.addIssue({ code: "custom", message: `Unknown tag requires an explicit proposal: ${tag}`, path: ["tags", index] });
  });
};

const blogSchema = blogFrontmatterSchema.superRefine((value, context) => {
  if (!blogCategories.has(value.category)) context.addIssue({ code: "custom", message: `Unknown Blog category: ${value.category}`, path: ["category"] });
  knownTags(value, context);
});
const noteSchema = noteFrontmatterSchema.superRefine((value, context) => {
  if (!noteSubjects.has(value.subject)) context.addIssue({ code: "custom", message: `Unknown Note subject: ${value.subject}`, path: ["subject"] });
  knownTags(value, context);
});
const projectSchema = projectFrontmatterSchema.superRefine(knownTags);
const toolSchema = toolFrontmatterSchema.superRefine((value, context) => {
  if (!toolCategories.has(value.category)) context.addIssue({ code: "custom", message: `Unknown Tool category: ${value.category}`, path: ["category"] });
  knownTags(value, context);
});

export const collections = {
  blog: defineCollection({ loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/blog" }), schema: blogSchema }),
  notes: defineCollection({ loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/notes" }), schema: noteSchema }),
  projects: defineCollection({ loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/projects" }), schema: projectSchema }),
  tools: defineCollection({ loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/tools" }), schema: toolSchema }),
  pages: defineCollection({ loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/pages" }), schema: pageFrontmatterSchema }),
};

import {
  blogFrontmatterSchema,
  noteFrontmatterSchema,
  pageFrontmatterSchema,
  projectFrontmatterSchema,
  toolFrontmatterSchema,
} from "@xpotato/content-contracts";
import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";

export const collections = {
  blog: defineCollection({ loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/blog" }), schema: blogFrontmatterSchema }),
  notes: defineCollection({ loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/notes" }), schema: noteFrontmatterSchema }),
  projects: defineCollection({ loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/projects" }), schema: projectFrontmatterSchema }),
  tools: defineCollection({ loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/tools" }), schema: toolFrontmatterSchema }),
  pages: defineCollection({ loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/pages" }), schema: pageFrontmatterSchema }),
};

import { contentModuleRecordSchema } from "@xpotato/content-contracts";

export const contentModuleRegistry = Object.freeze(
  ["Figure", "Gallery", "Callout", "Steps", "Step", "Comparison", "LinkCard", "Details", "Demo", "DiagnosticList", "DiagnosticItem", "ArticleEndnote"].map((id) =>
    contentModuleRecordSchema.parse({
      id,
      status: "active",
      allowedCollections: ["blog", "notes", "projects", "tools", "pages"],
      allowsChildren: ["Gallery", "Steps", "Step", "Comparison", "Details", "DiagnosticList", "DiagnosticItem", "ArticleEndnote"].includes(id),
    }),
  ),
);

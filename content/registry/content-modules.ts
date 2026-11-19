import { contentModuleRecordSchema } from "@xpotato/content-contracts";

export const contentModuleRegistry = Object.freeze(
  [
    "Group",
    "Figure",
    "Gallery",
    "Callout",
    "Steps",
    "Step",
    "Comparison",
    "LinkCard",
    "Details",
    "Demo",
    "DiagnosticList",
    "DiagnosticItem",
    "ArticleEndnote",
    "BarChart",
  ].map((id) =>
    contentModuleRecordSchema.parse({
      id,
      status: "active",
      allowedCollections: ["blog", "notes", "projects", "tools", "pages"],
      allowsChildren: [
        "Group",
        "Gallery",
        "Steps",
        "Step",
        "Comparison",
        "Details",
        "DiagnosticList",
        "DiagnosticItem",
        "ArticleEndnote",
      ].includes(id),
    }),
  ),
);

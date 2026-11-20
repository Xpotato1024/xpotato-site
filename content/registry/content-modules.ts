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
    "ComparisonCase",
    "LineChart",
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
        "Callout",
        "Steps",
        "Step",
        "Comparison",
        "ComparisonCase",
        "Details",
        "DiagnosticList",
        "DiagnosticItem",
        "ArticleEndnote",
      ].includes(id),
    }),
  ),
);

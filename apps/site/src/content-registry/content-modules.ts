import { contentModuleRecordSchema } from "@xpotato/content-contracts";

export const contentModuleRegistry = Object.freeze(
  ["Figure", "Gallery", "Callout", "Steps", "Comparison", "LinkCard", "Details", "Demo"].map((id) =>
    contentModuleRecordSchema.parse({
      id,
      status: "active",
      allowedCollections: ["blog", "notes", "projects", "tools", "pages"],
      allowsChildren: ["Gallery", "Steps", "Comparison", "Details"].includes(id),
    }),
  ),
);

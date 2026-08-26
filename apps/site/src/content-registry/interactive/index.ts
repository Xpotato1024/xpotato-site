import { interactiveModuleRecordSchema, toolBindingRecordSchema } from "@xpotato/content-contracts";

export const interactiveModuleRegistry = Object.freeze({
  "prime-factorizer": interactiveModuleRecordSchema.parse({
    id: "prime-factorizer",
    framework: "react",
    componentId: "prime-factorizer-react-v1",
    hydration: "visible",
    allowedCollections: ["tools"],
    role: "primary_tool",
    status: "active",
    apiVersion: 1,
    budgetClass: "small",
  }),
});

export const toolBindings = Object.freeze([
  toolBindingRecordSchema.parse({
    contentId: "bca48f98-c89a-457f-84d8-168f941fe469",
    moduleId: "prime-factorizer",
    role: "primary_tool",
    status: "active",
  }),
]);

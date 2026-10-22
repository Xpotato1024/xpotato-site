import {generatedModules,generatedBindings} from "./generated/records.js";
import { interactiveModuleRecordSchema, toolBindingRecordSchema } from "@xpotato/content-contracts";

export const interactiveModuleRegistry = Object.freeze({
  ...generatedModules,
  "prime-factorizer": interactiveModuleRecordSchema.parse({
    id: "prime-factorizer",
    framework: "react",
    componentId: "prime-factorizer-react-v1",
    hydration: "visible",
    allowedCollections: ["tools"],
    role: "primary_tool",
    status: "active",
    apiVersion: 1,
    budgetClass: "large",
    releaseId: "v0-1-1",
  }),
});

export const toolBindings = Object.freeze([
  ...generatedBindings.map(value=>toolBindingRecordSchema.parse(value)),
  toolBindingRecordSchema.parse({
    contentId: "bca48f98-c89a-457f-84d8-168f941fe469",
    moduleId: "prime-factorizer",
    role: "primary_tool",
    status: "active",
  }),
]);

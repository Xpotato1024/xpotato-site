import {generatedComponents} from "./generated/components.js";
import type {InteractiveComponentId} from "../../../../../../content/registry/interactive/component-ids.js";

export const interactiveComponentImports = Object.freeze(generatedComponents satisfies Record<InteractiveComponentId, Readonly<Record<"load" | "idle" | "visible" | "media", unknown>>>);

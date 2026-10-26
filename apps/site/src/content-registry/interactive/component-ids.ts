import {generatedComponentIds} from "./generated/records.js";
export const interactiveComponentIds = ["prime-factorizer-react-v1",...generatedComponentIds] as const;
export type InteractiveComponentId = (typeof interactiveComponentIds)[number];

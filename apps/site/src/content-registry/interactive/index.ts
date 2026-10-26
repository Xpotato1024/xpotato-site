import {generatedModules,generatedBindings} from "./generated/records.js";
import {toolBindingRecordSchema} from "@xpotato/content-contracts";

export const interactiveModuleRegistry = Object.freeze({...generatedModules});
export const toolBindings = Object.freeze(generatedBindings.map(value=>toolBindingRecordSchema.parse(value)));

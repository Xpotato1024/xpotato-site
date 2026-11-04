import {it,expect} from "vitest";
import {interactiveModuleRecordSchema} from "@xpotato/content-contracts";
import {validateToolReleaseBindings} from "./browser-tool-bindings.js";
const builtin=interactiveModuleRecordSchema.parse({id:"prime-factorizer",framework:"react",componentId:"prime-factorizer-react-v1",hydration:"visible",allowedCollections:["tools"],role:"primary_tool",status:"active",apiVersion:1,budgetClass:"small"});
it("requires pinned identities for every active module",()=>{
 expect(()=>validateToolReleaseBindings({builtin},[])).toThrow(/releaseId/);
 expect(()=>validateToolReleaseBindings({new:{...builtin,id:"new-tool",componentId:"new-tool-react-v1"}},[])).toThrow(/releaseId/);
 expect(()=>validateToolReleaseBindings({new:{...builtin,id:"new-tool",releaseId:"v1"}},[])).toThrow(/exactly one pin/);
 expect(()=>validateToolReleaseBindings({new:{...builtin,id:"new-tool",releaseId:"v1",allowedCollections:["blog"]}},[])).toThrow(/restricted/);
});

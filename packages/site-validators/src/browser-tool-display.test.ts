import {it,expect} from "vitest";
import {createHash} from "node:crypto";
import {browserToolPinSchema,interactiveModuleRecordSchema} from "@xpotato/content-contracts";
import {describeBrowserToolRelease} from "./browser-tool-display.js";
const hash=(value:string)=>createHash("sha256").update(value).digest("hex");
const module=interactiveModuleRecordSchema.parse({id:"display-fixture",framework:"react",componentId:"display-fixture-react-v1",hydration:"load",allowedCollections:["tools"],role:"primary_tool",status:"active",apiVersion:1,budgetClass:"small",releaseId:"fixture-v1"});
const manifest={schemaVersion:1,toolId:module.id,version:"1.2.3",integration:{kind:"react-island",apiVersion:1,entry:"tool.mjs",styles:[]},
 runtime:{network:"none-after-ready",storage:"memory",capabilities:{fileInput:false,download:false,clipboard:false,worker:false,wasm:false},maxInputBytes:4096,maxOutputBytes:8192,maxComputeMs:50},
 license:{spdx:"MIT",file:"LICENSE",notice:"NOTICE"},files:["package.json","tool.mjs","LICENSE","NOTICE"].map(path=>({path,bytes:1,sha256:"b".repeat(64)}))};
const raw=JSON.stringify(manifest)+"\n";
const pin=browserToolPinSchema.parse({schemaVersion:1,toolId:module.id,releaseId:"fixture-v1",packageName:"@xpotato-tool/display-fixture",
 source:{kind:"github",repository:"https://github.com/example/display-fixture"},sourceCommit:"a".repeat(40),sourceTreeSha256:"b".repeat(64),lockSha256:"c".repeat(64),manifestSha256:hash(raw),artifactSha256:"d".repeat(64),reviewSha256:"e".repeat(64)});
const input={module,pins:[pin],manifestSources:{[module.id+":"+pin.releaseId]:raw}};
it("derives visible metadata from the exact selected manifest and full source commit",()=>{
 const result=describeBrowserToolRelease(input)!;
 expect(result).toMatchObject({scope:"pinned-release",version:"1.2.3",sourceUrl:"https://github.com/example/display-fixture/tree/"+"a".repeat(40),license:"MIT",maxInputBytes:4096,maxOutputBytes:8192});
});
it("refuses missing or changed manifest bytes before displaying their metadata",()=>{
 expect(()=>describeBrowserToolRelease({...input,manifestSources:{}})).toThrow("does not match selected pin");
 expect(()=>describeBrowserToolRelease({...input,manifestSources:{[module.id+":"+pin.releaseId]:raw+" "}})).toThrow("does not match selected pin");
});
it("refuses a different manifest identity even when its raw hash is self-consistent",()=>{
 const changed=JSON.stringify({...manifest,toolId:"another-tool"});
 expect(()=>describeBrowserToolRelease({...input,pins:[{...pin,manifestSha256:hash(changed)}],manifestSources:{[module.id+":"+pin.releaseId]:changed}})).toThrow("identity mismatch");
});
it("keeps local fixture metadata out of public rendering and labels explicit private tests",()=>{
 const fixture={...pin,source:{kind:"local-fixture" as const,name:"synthetic-browser-tool" as const}};
 expect(()=>describeBrowserToolRelease({...input,pins:[fixture]})).toThrow("Fixture pin forbidden");
 expect(describeBrowserToolRelease({...input,pins:[fixture],fixtureOnly:true})).toMatchObject({scope:"synthetic-fixture",sourceUrl:null});
});
it("requires one exact pin and does not substitute the newest release on rollback",()=>{
 expect(()=>describeBrowserToolRelease({...input,pins:[]})).toThrow("exactly one pin");
 expect(()=>describeBrowserToolRelease({...input,pins:[pin,pin]})).toThrow("Duplicate");
 const newer=JSON.stringify({...manifest,version:"2.0.0"});
 expect(describeBrowserToolRelease({...input,pins:[pin,{...pin,releaseId:"fixture-v2",manifestSha256:hash(newer)}],manifestSources:{...input.manifestSources,[module.id+":fixture-v2"]:newer}})?.version).toBe("1.2.3");
});
it("does not add release claims to the unchanged builtin",()=>{
 const builtin=interactiveModuleRecordSchema.parse({...module,id:"prime-factorizer",componentId:"prime-factorizer-react-v1",releaseId:undefined});
 expect(describeBrowserToolRelease({module:builtin,pins:[],manifestSources:{}})).toBeNull();
});

it("binds optional tool-owned capability metadata to the selected manifest bytes and rollback",()=>{
 const capabilities={schemaVersion:1,kind:"integer-factorization",input:{maxTextLength:4096,minimum:"0",scientificNotation:true},defaultMode:"standard",completionGuaranteed:false,modes:[{id:"standard",label:"通常",uiLabel:"通常（小さい入力）",maxDigits:39,maxBits:128,timeBudgetMaxMs:60000}]};
 const bounded={...manifest,runtime:{profile:"bounded-browser-v2",network:"none-after-ready",storage:"memory",capabilities:{fileInput:false,download:false,clipboard:false,worker:false,wasm:false},clipboardPolicy:"user-gesture-write-only",assetMode:"fixed-bundled",maxInputBytes:16384,maxOutputBytes:8192,maxComputeMs:50,jobMaxMs:60000,maxWorkers:0,maxWasmBytes:0,maxTransportBytes:0,embeddedWorkerModules:[],embeddedWasmModules:[],workerLoaderModules:[]},uiCapabilities:capabilities};
 const selected=JSON.stringify(bounded),args={...input,pins:[{...pin,manifestSha256:hash(selected)}],manifestSources:{[module.id+":"+pin.releaseId]:selected}};
 expect(describeBrowserToolRelease(args)?.uiCapabilities).toEqual(capabilities);
 expect(describeBrowserToolRelease(input)?.uiCapabilities).toBeNull();
 const changed=JSON.stringify({...bounded,uiCapabilities:{...capabilities,input:{...capabilities.input,maxTextLength:4000}}});
 expect(()=>describeBrowserToolRelease({...args,manifestSources:{[module.id+":"+pin.releaseId]:changed}})).toThrow("does not match selected pin");
 for(const bad of [{...capabilities,defaultMode:"wide"},{...capabilities,modes:[capabilities.modes[0],capabilities.modes[0]]},{...capabilities,modes:[{...capabilities.modes[0],timeBudgetMaxMs:60001}]},{...capabilities,input:{...capabilities.input,maxTextLength:16385}}]){const raw=JSON.stringify({...bounded,uiCapabilities:bad});expect(()=>describeBrowserToolRelease({...args,pins:[{...pin,manifestSha256:hash(raw)}],manifestSources:{[module.id+":"+pin.releaseId]:raw}})).toThrow();}
});

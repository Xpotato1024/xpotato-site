import {createHash} from "node:crypto";
import {browserToolManifestSchema,type BrowserToolPin,type InteractiveModuleRecord} from "@xpotato/content-contracts";
import {validateToolReleaseBindings} from "./browser-tool-bindings.js";

export interface BrowserToolReleaseDisplay {
  readonly scope: "pinned-release" | "synthetic-fixture";
  readonly toolId: string;
  readonly releaseId: string;
  readonly version: string;
  readonly sourceCommit: string;
  readonly sourceUrl: string | null;
  readonly license: string;
  readonly maxInputBytes: number;
  readonly maxOutputBytes: number;
}

// Build-only. The selected manifest is an explicit raw import; no remote lookup or runtime file discovery.
export function describeBrowserToolRelease(input:{module:InteractiveModuleRecord;pins:readonly BrowserToolPin[];
  manifestSources:Readonly<Record<string,string>>;fixtureOnly?:boolean}):BrowserToolReleaseDisplay|null{
  validateToolReleaseBindings({[input.module.id]:input.module},input.pins,input.fixtureOnly===true);
  if(input.module.status!=="active"||!input.module.releaseId)return null;
  const pin=input.pins.find(pin=>pin.toolId===input.module.id&&pin.releaseId===input.module.releaseId)!;
  const source=input.manifestSources[pin.toolId+":"+pin.releaseId];
  if(typeof source!=="string"||createHash("sha256").update(source,"utf8").digest("hex")!==pin.manifestSha256)
    throw Error("Tool display manifest does not match selected pin");
  const manifest=browserToolManifestSchema.parse(JSON.parse(source));
  if(manifest.toolId!==pin.toolId)throw Error("Tool display manifest identity mismatch");
  return {scope:pin.source.kind==="github"?"pinned-release":"synthetic-fixture",toolId:pin.toolId,releaseId:pin.releaseId,
    version:manifest.version,sourceCommit:pin.sourceCommit,sourceUrl:pin.source.kind==="github"?pin.source.repository+"/tree/"+pin.sourceCommit:null,
    license:manifest.license.spdx,maxInputBytes:manifest.runtime.maxInputBytes,maxOutputBytes:manifest.runtime.maxOutputBytes};
}

import type {BrowserToolPin,InteractiveModuleRecord} from "@xpotato/content-contracts";
import {browserToolPinSchema} from "@xpotato/content-contracts";
export function validateToolReleaseBindings(modules:Readonly<Record<string,InteractiveModuleRecord>>,pins:readonly BrowserToolPin[],fixtureOnly=false):void {
  const keys=new Set<string>();
  for(const input of pins){
    const pin=browserToolPinSchema.parse(input),key=pin.toolId+":"+pin.releaseId;
    if(keys.has(key))throw Error("Duplicate Tool release pin");keys.add(key);
    if(pin.source.kind==="local-fixture"&&!fixtureOnly)throw Error("Fixture pin forbidden in public registry");
  }
  for(const module of Object.values(modules)){
    if(module.status!=="active")continue;
    if(!module.releaseId)throw Error("Every active Tool module requires explicit releaseId");
    if(module.framework!=="react"||module.apiVersion!==1||module.role!=="primary_tool"
      ||module.allowedCollections.length!==1||module.allowedCollections[0]!=="tools")throw Error("External Tool is restricted to Tools primary React API v1");
    if(pins.filter(pin=>pin.toolId===module.id&&pin.releaseId===module.releaseId).length!==1)throw Error("Tool release does not resolve to exactly one pin");
  }
}

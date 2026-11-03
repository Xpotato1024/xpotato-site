import {describe,it,expect} from "vitest";
import {browserToolManifestSchema} from "@xpotato/content-contracts";
import {verifyToolPin} from "../browser-tool-adoption.js";
import {browserToolReleases} from "../../../../../apps/site/src/content-registry/interactive/releases.js";
import {historicalToolFiles,materializeHistoricalVendorFixture} from "../../../../../tests/fixtures/historical-browser-tool.js";
const manifest=JSON.parse((await historicalToolFiles('v0-1-0')).get('browser-tool.json')!.toString('utf8'));
describe("dedicated fixed prime async admission",()=>{
 it("validates the actual distributed manifest and rejects broadening",()=>{
  expect(browserToolManifestSchema.safeParse(manifest).success).toBe(true);
  const changes=[
   {...manifest,toolId:"other-tool"},
   {...manifest,runtime:{...manifest.runtime,profile:"general-async-v1"}},
   ...["jobMaxMs","maxWorkers","maxWasmBytes","maxTransportBytes"].map(key=>({...manifest,runtime:{...manifest.runtime,[key]:manifest.runtime[key]+1}})),
   {...manifest,runtime:{...manifest.runtime,capabilities:{...manifest.runtime.capabilities,download:true}}},
   {...manifest,runtime:{...manifest.runtime,network:"any"}},
   {...manifest,license:{...manifest.license,spdx:"MIT"}},
   {...manifest,license:{...manifest.license,additional:manifest.license.additional.filter((p:string)=>p!=="SOURCE_OFFER.md")}},
  ];
  for(const changed of changes)expect(browserToolManifestSchema.safeParse(changed).success).toBe(false);
 });
 it("verifies the actual immutable runtime plus pinned musl notice supplement",async()=>{
  const pin=browserToolReleases.find(p=>p.toolId==="prime-factorizer"&&p.releaseId==="v0-1-0")!;
  const fixture=await materializeHistoricalVendorFixture('v0-1-0');
  try{const actual=await verifyToolPin(fixture.vendorRoot,pin);expect(actual.version).toBe("0.1.0");}
  finally{await fixture.cleanup();}
 });
 it("requires the reviewed repository, not another repo with identical artifact hashes",async()=>{
  const pin=browserToolReleases.find(p=>p.toolId==="prime-factorizer"&&p.releaseId==="v0-1-0")!;
  expect(pin).toBeDefined();
  const fixture=await materializeHistoricalVendorFixture('v0-1-0');
  try{await expect(verifyToolPin(fixture.vendorRoot,{...pin,source:{kind:"github",repository:"https://github.com/example/other"}})).rejects.toThrow(/repository|source|origin/i);}
  finally{await fixture.cleanup();}
 });
});

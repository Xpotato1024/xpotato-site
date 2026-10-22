import {describe,it,expect} from "vitest";
import {fileURLToPath} from "node:url";
import {readFile} from "node:fs/promises";
import {browserToolManifestSchema} from "@xpotato/content-contracts";
import {verifyToolPin} from "./browser-tool-adoption.js";
import {browserToolReleases} from "../../../apps/site/src/content-registry/interactive/releases.js";
const manifest=JSON.parse(await readFile(new URL("../../../vendor/browser-tools/prime-factorizer/v0-1-0/browser-tool.json",import.meta.url),"utf8"));
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
  const actual=await verifyToolPin(fileURLToPath(new URL("../../../vendor/browser-tools/",import.meta.url)),pin);
  expect(actual.version).toBe("0.1.0");
 });
 it("requires the reviewed repository, not another repo with identical artifact hashes",async()=>{
  const pin=browserToolReleases.find(p=>p.toolId==="prime-factorizer"&&p.releaseId==="v0-1-0")!;
  expect(pin).toBeDefined();
  const vendor=fileURLToPath(new URL("../../../vendor/browser-tools/",import.meta.url));
  await expect(verifyToolPin(vendor,{...pin,source:{kind:"github",repository:"https://github.com/example/other"}})).rejects.toThrow(/repository|source|origin/i);
 });
});

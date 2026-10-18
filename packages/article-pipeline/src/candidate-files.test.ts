import {afterEach,describe,it,expect} from "vitest";
import {mkdtemp,mkdir,writeFile,symlink,link,rm} from "node:fs/promises";
import {join,resolve} from "node:path";
import {tmpdir} from "node:os";
import {localFileManifest,assertCandidateContentAllowed} from "./candidate-astro.js";
import {sha256} from "./canonical.js";
import {readFile} from "node:fs/promises";
const roots:string[]=[];afterEach(async()=>{for(const path of roots.splice(0))await rm(path,{recursive:true,force:true});});
async function directory(){const path=await mkdtemp(join(tmpdir(),"candidate-manifest-"));roots.push(path);return path;}
describe("bounded candidate file walker",()=>{
 it("hashes the exact regular file bytes in bytewise path order",async()=>{
  const root=await directory();await mkdir(join(root,"a"));await writeFile(join(root,"z.txt"),"last");await writeFile(join(root,"a/first.txt"),"first");
  expect(await localFileManifest(root)).toEqual([{path:"a/first.txt",sha256:sha256("first"),sizeBytes:5},{path:"z.txt",sha256:sha256("last"),sizeBytes:4}]);
 });
 it("denies a linked file, a linked directory and a hard-linked file",async()=>{
  const root=await directory(),outside=await directory();await writeFile(join(outside,"secret"),"private");
  await symlink(join(outside,"secret"),join(root,"linked"));await expect(localFileManifest(root)).rejects.toThrow();
  await rm(join(root,"linked"));await symlink(outside,join(root,"linked"),"dir");await expect(localFileManifest(root)).rejects.toThrow();
  await rm(join(root,"linked"));await link(join(outside,"secret"),join(root,"linked"));await expect(localFileManifest(root)).rejects.toThrow("CANDIDATE_OUTPUT_FILE_INVALID");
 });
 it("refuses over-limit files before reading their bytes",async()=>{
  const root=await directory();await writeFile(join(root,"large.bin"),Buffer.alloc(24*1024*1024+1));
  await expect(localFileManifest(root)).rejects.toThrow("CANDIDATE_OUTPUT_FILE_INVALID");
 });
});
describe("normal article candidates cannot release migration holds",()=>{
 it("refuses every member of the retained 44 Blog cohort",async()=>{
  const root=resolve("."),map=JSON.parse(await readFile(join(root,"docs/migration/content-id-map-v1.json"),"utf8"));
  const entries=map.entries.filter((item:{collection:string})=>item.collection==="blog");expect(entries).toHaveLength(44);
  for(const item of entries)await expect(assertCandidateContentAllowed(root,item.vNextContentId)).rejects.toThrow("CANDIDATE_LEGACY_HOLD_PROTECTED");
  await expect(assertCandidateContentAllowed(root,"f8a847d4-8f5d-4bb0-a387-750f096479f2")).resolves.toBeUndefined();
 });
});

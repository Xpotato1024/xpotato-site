
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, it } from "vitest";
import { assertReleaseDist } from "./release-dist.js";
it.each([
  ["renamed.json",'{"mode":"draft","productionEligible":false}'],
  ["review.json",'{"activeAttemptId":"attempt-1","jobFingerprint":"hash"}'],
  ["renamed.txt",'{"mode":"draft","productionEligible":false}'],
  ["review.html",'<meta name="xpotato-private-draft-preview-v1">'],
  ["review.txt","xpotato-private-draft-preview-v1"],
])("release producer rejects renamed private bytes in %s",async(name,source)=>{
  const dir=await mkdtemp(join(tmpdir(),"release-private-"));
  try{await writeFile(join(dir,name),source);await expect(assertReleaseDist(dir)).rejects.toThrow("Private draft output");}
  finally{await rm(dir,{recursive:true,force:true});}
});
it("release producer admits ordinary public output",async()=>{
  const dir=await mkdtemp(join(tmpdir(),"release-public-"));
  try{await writeFile(join(dir,"data.json"),'{"version":1}');
    await writeFile(join(dir,"index.html"),"<h1>公開</h1>");
    await expect(assertReleaseDist(dir)).resolves.toBeUndefined();}
  finally{await rm(dir,{recursive:true,force:true});}
});

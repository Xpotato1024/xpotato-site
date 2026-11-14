
import { mkdtemp, writeFile, rm, mkdir, readFile } from "node:fs/promises";
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
it.each(['manifest.webmanifest','tools/other/manifest.webmanifest','tools/prime-factorizer/other.webmanifest'])("release producer rejects an unapproved manifest path %s",async path=>{
  const dir=await mkdtemp(join(tmpdir(),'release-manifest-'));
  try{await mkdir(join(dir,path,'..'),{recursive:true});await writeFile(join(dir,path),'{}');await expect(assertReleaseDist(dir)).rejects.toThrow('Unexpected output class');}
  finally{await rm(dir,{recursive:true,force:true});}
});
it("release producer admits only the Prime manifest path and still rejects private bytes there",async()=>{
  const dir=await mkdtemp(join(tmpdir(),'release-prime-manifest-')),path=join(dir,'tools/prime-factorizer/manifest.webmanifest');
  try{await mkdir(join(path,'..'),{recursive:true});await writeFile(path,'{"scope":"/tools/prime-factorizer/"}');await expect(assertReleaseDist(dir)).resolves.toBeUndefined();
    await writeFile(path,'{"mode":"draft","productionEligible":false}');await expect(assertReleaseDist(dir)).rejects.toThrow('Private draft output');}
  finally{await rm(dir,{recursive:true,force:true});}
});

const downloadPath = 'downloads/mujoco4-position-sweep-20261114.zip';
const approvedBytes = await readFile(new URL('../../../../apps/site/public/' + downloadPath, import.meta.url));
it.each(['approved', 'size', 'hash', 'unknown', 'wrong-directory', 'case'])(
  'release producer verifies public download: %s', async scenario => {
    const dir = await mkdtemp(join(tmpdir(), 'release-download-'));
    try {
      const relative = scenario === 'unknown' ? 'downloads/unknown.zip'
        : scenario === 'wrong-directory' ? 'other/mujoco4-position-sweep-20261114.zip'
        : scenario === 'case' ? downloadPath.replace('.zip', '.ZIP') : downloadPath;
      const bytes = Buffer.from(approvedBytes);
      if (scenario === 'hash') bytes[0] = bytes[0]! ^ 1;
      await mkdir(join(dir, relative, '..'), { recursive: true });
      await writeFile(join(dir, relative), scenario === 'size' ? bytes.subarray(1) : bytes);
      if (scenario === 'approved') await expect(assertReleaseDist(dir)).resolves.toBeUndefined();
      else await expect(assertReleaseDist(dir)).rejects.toThrow(
        ['size', 'hash'].includes(scenario) ? 'Approved public download bytes mismatch' : 'Unexpected output class',
      );
    } finally { await rm(dir, { recursive: true, force: true }); }
  },
);

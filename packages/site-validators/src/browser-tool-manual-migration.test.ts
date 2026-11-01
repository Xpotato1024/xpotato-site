import {afterEach,expect,it,vi} from "vitest";
import {execFileSync} from "node:child_process";
import {mkdtemp,readFile,writeFile,mkdir,rm,readdir,cp} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {migrateManualPrime,manualPrimeMigrationHead,checkBrowserToolInstallations,browserToolPlacementSchema,updatePublishedPrimeRelease} from "./browser-tool-installation.js";
import {verifyToolCandidate,adoptToolRelease} from './browser-tool-adoption.js';

vi.mock("node:fs/promises",{spy:true});
vi.mock('./browser-tool-adoption.js',{spy:true});
const actual=await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
const roots:string[]=[];
afterEach(async()=>{vi.mocked(writeFile).mockImplementation(actual.writeFile);vi.mocked(verifyToolCandidate).mockRestore();vi.mocked(adoptToolRelease).mockRestore();for(const root of roots.splice(0))await rm(root,{recursive:true,force:true});});
const interactive="apps/site/src/content-registry/interactive/";
it("rejects published Prime updates without the exact selected artifact before candidate access",async()=>{
 const f=await fixture();await migrateManualPrime({...f.input,apply:true});const before=await f.snapshot();
 await expect(updatePublishedPrimeRelease({siteRoot:f.siteRoot,sourceRoot:'missing-source',artifactRoot:'missing-artifact',review:{},releaseId:'v0-2-0',replaceArtifact:'0'.repeat(64),apply:true})).rejects.toThrow('Exact selected Prime artifact required');
 expect(await f.snapshot()).toEqual(before);
 await expect(readFile(join(f.siteRoot,'.local/browser-tool-install.lock'))).rejects.toThrow();
},60000);
const paths=["config/browser-tools/installations.json",...[
 "index.ts","component-ids.ts","component-imports.ts","manifest-sources.ts","releases.ts",
 "generated/records.ts","generated/components.ts","generated/manifests.ts"].map(path=>interactive+path),
 "apps/site/src/components/islands/PrimeFactorizer.tsx","apps/site/src/components/interactive-renderers/PrimeFactorizerStyles.astro",...["Load","Idle","Visible","Media"].map(h=>"apps/site/src/components/interactive-renderers/PrimeFactorizer"+h+".astro"),
 "apps/site/src/content/tools/prime-factorizer.mdx","apps/site/package.json","package-lock.json","config/browser-tools/prime-public-admission.json",
 "docs/acceptance/browser-tools/prime-factorizer/v0-1-5-source-review.json"];
async function fixture(){
 const root=await mkdtemp(join(tmpdir(),"prime-transfer-"));roots.push(root);
 const siteRoot=join(root,"site");
 execFileSync("git",["clone","--quiet","--shared","--no-checkout",resolve("."),siteRoot]);
 execFileSync("git",["-C",siteRoot,"config","core.autocrlf","false"]);
 execFileSync("git",["-C",siteRoot,"checkout",manualPrimeMigrationHead,"--",...paths,
  "apps/site/src/content-registry/taxonomy/phase5-generated.ts","vendor/browser-tools/prime-factorizer"]);
 // This is a historical installation transaction. Its lock and workspace
 // manifests must come from the same pinned baseline, not today's packages.
 // Mixing a new SDK manifest into the old lock forced uncached registry IO.
 const manifests=execFileSync('git',['ls-tree','-r','--name-only',manualPrimeMigrationHead],{encoding:'utf8'}).trim().split('\n')
  .filter(path=>/^(?:package\.json|(?:apps|packages)\/[^/]+\/package\.json)$/u.test(path));
 execFileSync('git',['-C',siteRoot,'checkout',manualPrimeMigrationHead,'--',...manifests.filter(path=>!paths.includes(path))]);
 const input={siteRoot,fromHead:manualPrimeMigrationHead};
 const snapshot=()=>Promise.all(paths.map(path=>readFile(join(siteRoot,path),"utf8")));
 return {root,...input,input,snapshot,before:await snapshot()};
}
it('updates the preserved Prime transaction and refuses historical IDs without writes',async()=>{
 const f=await fixture();await migrateManualPrime({...f.input,apply:true});
 const config=JSON.parse(await readFile(join(f.siteRoot,paths[0]!),'utf8')),prior=config.installations[0].pin;
 const review=JSON.parse(await readFile(join(f.siteRoot,'docs/acceptance/browser-tools/prime-factorizer/v0-1-5-source-review.json'),'utf8'));
 const {releaseId,...pinFields}=prior;
 vi.mocked(verifyToolCandidate).mockResolvedValue({pinFields,files:new Map()});
 vi.mocked(adoptToolRelease).mockImplementation(async input=>{await cp(join(f.siteRoot,'vendor/browser-tools/prime-factorizer/v0-1-5'),join(f.siteRoot,'vendor/browser-tools/prime-factorizer',input.releaseId),{recursive:true});return {...prior,releaseId:input.releaseId};});
 const input={siteRoot:f.siteRoot,sourceRoot:'source-not-executed',artifactRoot:'artifact-not-executed',review,releaseId:'reviewed-update-test',replaceArtifact:prior.artifactSha256};
 const before=await f.snapshot();
 await expect(updatePublishedPrimeRelease({...input,releaseId:'v0-1-2'})).rejects.toThrow(/history collision/);expect(await f.snapshot()).toEqual(before);
 await expect(updatePublishedPrimeRelease(input)).resolves.toMatchObject({contentChanged:false,publication:false});expect(await f.snapshot()).toEqual(before);
 await expect(updatePublishedPrimeRelease({...input,apply:true})).resolves.toMatchObject({applied:true,contentChanged:false});
 await checkBrowserToolInstallations(f.siteRoot);
 expect(await readFile(join(f.siteRoot,'apps/site/src/content/tools/prime-factorizer.mdx'),'utf8')).toBe(before[paths.indexOf('apps/site/src/content/tools/prime-factorizer.mdx')]);
 expect(JSON.parse(await readFile(join(f.siteRoot,paths[0]!),'utf8')).installations[0].pin.releaseId).toBe(input.releaseId);
},60000);

it('restores a failed update and preserves an unexpected concurrent edit',async()=>{
 for(const concurrent of [false,true]){
  const f=await fixture();await migrateManualPrime({...f.input,apply:true});const before=await f.snapshot();
  const prior=JSON.parse(await readFile(join(f.siteRoot,paths[0]!),'utf8')).installations[0].pin,{releaseId,...pinFields}=prior;
  const review=JSON.parse(await readFile(join(f.siteRoot,'docs/acceptance/browser-tools/prime-factorizer/v0-1-5-source-review.json'),'utf8'));
  vi.mocked(verifyToolCandidate).mockResolvedValue({pinFields,files:new Map()});
  vi.mocked(adoptToolRelease).mockImplementation(async input=>{await cp(join(f.siteRoot,'vendor/browser-tools/prime-factorizer/v0-1-5'),join(f.siteRoot,'vendor/browser-tools/prime-factorizer',input.releaseId),{recursive:true});return {...prior,releaseId:input.releaseId};});
  let writes=0;vi.mocked(writeFile).mockImplementation(async(path,data,options)=>{
   if(String(path).includes('.browser-tool-transfer-')&&++writes===3){if(concurrent)await actual.writeFile(join(f.siteRoot,'apps/site/package.json'),'USER EDIT\n');throw Error('Injected update write failure');}
   return actual.writeFile(path,data,options);
  });
  await expect(updatePublishedPrimeRelease({siteRoot:f.siteRoot,sourceRoot:'not-executed',artifactRoot:'not-executed',review,releaseId:'reviewed-failure-test',replaceArtifact:prior.artifactSha256,apply:true})).rejects.toThrow(concurrent?/preserve edits/:/Injected update/);
  vi.mocked(writeFile).mockImplementation(actual.writeFile);
  if(concurrent)expect(await readFile(join(f.siteRoot,'apps/site/package.json'),'utf8')).toBe('USER EDIT\n');else expect(await f.snapshot()).toEqual(before);
  await expect(readFile(join(f.siteRoot,'.local/browser-tool-install.lock'))).rejects.toThrow();
 }
},60000);
it("plans without writes, transfers the exact public release, replays without changes, and rolls back/reapplies",async()=>{
 const f=await fixture();
 expect(await migrateManualPrime(f.input)).toMatchObject({status:"planned",network:false,publication:false});
 expect(await f.snapshot()).toEqual(f.before);
 await expect(readdir(join(f.siteRoot,".local"))).rejects.toThrow();
 expect(await migrateManualPrime({...f.input,apply:true})).toMatchObject({status:"applied"});
 await checkBrowserToolInstallations(f.siteRoot);
 const config=JSON.parse(await readFile(join(f.siteRoot,paths[0]!),"utf8"));
 expect(config.installations).toHaveLength(1);
 expect(config.installations[0]).toMatchObject({pin:{toolId:"prime-factorizer",releaseId:"v0-1-5",sourceCommit:"99133842d311d944d09f258bd29afd3d17ba9514"},placement:{draft:false,contentId:"bca48f98-c89a-457f-84d8-168f941fe469"}});
 const after=await f.snapshot();
 for(const path of paths.filter(path=>!path.startsWith(interactive)&&path!==paths[0]))expect(after[paths.indexOf(path)]).toBe(f.before[paths.indexOf(path)]);
 for(const apply of [false,true])expect(await migrateManualPrime({...f.input,apply})).toMatchObject({status:"already-migrated",changedFiles:[]});
 expect(await f.snapshot()).toEqual(after);
 expect(await migrateManualPrime({...f.input,rollback:true})).toMatchObject({status:"rolled-back"});
 expect(await f.snapshot()).toEqual(f.before);
 await migrateManualPrime({...f.input,apply:true});await checkBrowserToolInstallations(f.siteRoot);
},60000);

it("keeps normal draft-only placement and rejects an unrecognized baseline or edited target/dependency",async()=>{
 const f=await fixture();
 expect(browserToolPlacementSchema.safeParse({draft:false}).success).toBe(false);
 await expect(migrateManualPrime({...f.input,fromHead:"0".repeat(40),apply:true})).rejects.toThrow(/baseline/);
 for(const path of [interactive+"index.ts",interactive+"generated/records.ts","apps/site/src/components/islands/PrimeFactorizer.tsx",
  "apps/site/src/content/tools/prime-factorizer.mdx","apps/site/package.json","package-lock.json","config/browser-tools/prime-public-admission.json",
  "docs/acceptance/browser-tools/prime-factorizer/v0-1-5-source-review.json"]){
  const original=await readFile(join(f.siteRoot,path),"utf8");await writeFile(join(f.siteRoot,path),original+"\nUSER EDIT\n");
  const edited=await f.snapshot();await expect(migrateManualPrime({...f.input,apply:true})).rejects.toThrow();expect(await f.snapshot()).toEqual(edited);
  await writeFile(join(f.siteRoot,path),original);
 }
 const collision=join(f.siteRoot,"apps/site/src/content/tools/prime-factorizer.md");await writeFile(collision,"Other page");
 await expect(migrateManualPrime({...f.input,apply:true})).rejects.toThrow(/route collision/);await rm(collision);
 const unmanaged=join(f.siteRoot,interactive,"generated/user.astro");await writeFile(unmanaged,"USER WORK");
 await expect(migrateManualPrime({...f.input,apply:true})).rejects.toThrow(/Unmanaged/);
 expect(await readFile(unmanaged,"utf8")).toBe("USER WORK");expect(await f.snapshot()).toEqual(f.before);
},60000);

it("restores every original registry and config when a write fails midway",async()=>{
 const f=await fixture();let failed=false,writes=0;
 vi.mocked(writeFile).mockImplementation(async(path,data,options)=>{
  if(String(path).includes(".browser-tool-transfer-")&&++writes===5&&!failed){failed=true;await actual.writeFile(path,String(data).slice(0,20),options);throw Error("Injected partial staged disk write failure");}
  return actual.writeFile(path,data,options);
 });
 await expect(migrateManualPrime({...f.input,apply:true})).rejects.toThrow(/Injected/);
 expect(failed).toBe(true);expect(await f.snapshot()).toEqual(f.before);
 await expect(readFile(join(f.siteRoot,".local/browser-tool-install.lock"))).rejects.toThrow();
 await checkBrowserToolInstallations(f.siteRoot);
 await migrateManualPrime({...f.input,apply:true});
},60000);

it("refuses unexpected edits during rollback and recovers a known partial transfer",async()=>{
 const f=await fixture();await migrateManualPrime({...f.input,apply:true});
 const path=join(f.siteRoot,interactive,"index.ts"),after=await readFile(path,"utf8");await writeFile(path,after+"// USER EDIT\n");
 const edited=await f.snapshot();await expect(migrateManualPrime({...f.input,rollback:true})).rejects.toThrow(/preserve edits/);expect(await f.snapshot()).toEqual(edited);
 await writeFile(path,after);await writeFile(path,f.before[paths.indexOf(interactive+"index.ts")]!);
 await expect(migrateManualPrime({...f.input,apply:true})).rejects.toThrow(/collision/);
 await migrateManualPrime({...f.input,rollback:true});expect(await f.snapshot()).toEqual(f.before);
},60000);

it("checks preserved content/admission and honors the shared installer lock",async()=>{
 const f=await fixture();await mkdir(join(f.siteRoot,".local"));const lock=join(f.siteRoot,".local/browser-tool-install.lock");await writeFile(lock,"other installer");
 await expect(migrateManualPrime({...f.input,apply:true})).rejects.toThrow(/EEXIST/);expect(await f.snapshot()).toEqual(f.before);await rm(lock);
 await migrateManualPrime({...f.input,apply:true});
 const page=join(f.siteRoot,"apps/site/src/content/tools/prime-factorizer.mdx");await writeFile(page,(await readFile(page,"utf8"))+"Changed editorial content\n");
 await expect(checkBrowserToolInstallations(f.siteRoot)).rejects.toThrow(/Preserved Prime content changed/);
 await expect(migrateManualPrime({...f.input,rollback:true})).rejects.toThrow(/dependency preimage changed/);
},60000);

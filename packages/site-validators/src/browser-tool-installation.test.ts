import {it,expect,afterEach} from "vitest";import {execFileSync} from "node:child_process";
import {mkdtemp,rm,mkdir,cp,readFile,writeFile} from "node:fs/promises";import {tmpdir} from "node:os";import {join,resolve} from "node:path";
import {browserToolReactPeers,browserToolReviewSchema} from "@xpotato/content-contracts";
import {toolHash} from "./browser-tool-adoption.js";
import {createToolFixture} from "./browser-tool-fixture.js";
import {installBrowserTool,checkBrowserToolInstallations,initializeBrowserToolInstallations,browserToolPlacementSchema} from "./browser-tool-installation.js";
const roots:string[]=[],originalCache=process.env.npm_config_cache;afterEach(async()=>{
 if(originalCache===undefined)delete process.env.npm_config_cache;else process.env.npm_config_cache=originalCache;
 for(const p of roots.splice(0))await rm(p,{recursive:true,force:true});
});
const placement={contentId:"74caa6aa-296f-48d1-b84f-788e2b5d7524",slug:"new-counter",title:"文字数",description:"端末内で文字数を数えます。",category:"calculation",tags:["math"],pubDate:"2026-10-22",hydration:"visible",draft:true};
async function fixture(){
 const root=await mkdtemp(join(tmpdir(),"tool-install-"));roots.push(root);const f=await createToolFixture(join(root,"fixture"));
 const siteRoot=join(root,"site");
 for(const p of ["config/browser-tools","apps/site/src/content/tools","apps/site/src/content-registry/interactive","apps/site/src/content-registry/taxonomy","vendor/browser-tools"])await mkdir(join(siteRoot,p),{recursive:true});
 await writeFile(join(siteRoot,"config/browser-tools/installations.json"),'{"schemaVersion":1,"installations":[]}\n');
 await cp(resolve("apps/site/src/content-registry/taxonomy/phase5-generated.ts"),join(siteRoot,"apps/site/src/content-registry/taxonomy/phase5-generated.ts"));
 await writeFile(join(siteRoot,"apps/site/src/content-registry/interactive/index.ts"),'export const interactiveModuleRegistry = Object.freeze({"prime-factorizer":{}});\n');
 await writeFile(join(siteRoot,"apps/site/package.json"),JSON.stringify({name:"@xpotato/site",version:"0.0.0",dependencies:browserToolReactPeers}));
 await writeFile(join(siteRoot,"package.json"),JSON.stringify({name:"test-install",private:true,workspaces:["apps/*"]}));
 // Model the real host's already-pinned React peers. Lock-only adoption must not
 // depend on a developer's cached registry packuments or download any package.
 const hostLock=JSON.parse(await readFile(resolve("package-lock.json"),"utf8")),packages:Record<string,unknown>={
  "":{name:"test-install",workspaces:["apps/*"]},
  "apps/site":{name:"@xpotato/site",version:"0.0.0",dependencies:browserToolReactPeers},
  "node_modules/@xpotato/site":{resolved:"apps/site",link:true}};
 for(const name of ["react","react-dom","scheduler"])packages["node_modules/"+name]=hostLock.packages["node_modules/"+name];
 await writeFile(join(siteRoot,"package-lock.json"),JSON.stringify({name:"test-install",lockfileVersion:3,requires:true,packages}));
 process.env.npm_config_cache=join(root,"empty-npm-cache");
 await initializeBrowserToolInstallations(siteRoot);
 const repository="https://github.com/Example/synthetic-only-test";
 execFileSync("git",["-C",f.sourceRoot,"remote","add","origin",repository]);
 const review={...f.review,source:{kind:"github" as const,repository},review:{reviewer:"synthetic unit-test evidence only",scope:"source-and-release" as const,decision:"admit" as const}};
 return {siteRoot,sourceRoot:f.sourceRoot,artifactRoot:f.artifactRoot,review,releaseId:"test-v1",placement};
}
it("plans without mutation then applies fixed artifact, static wrappers, registry, draft SEO page and npm-owned lock",async()=>{
 const f=await fixture();const before=await readFile(join(f.siteRoot,"config/browser-tools/installations.json"));
 expect(await installBrowserTool(f)).toMatchObject({draft:true,publication:false,network:false});
 expect(await readFile(join(f.siteRoot,"config/browser-tools/installations.json"))).toEqual(before);
 await installBrowserTool({...f,apply:true});await checkBrowserToolInstallations(f.siteRoot);
 const page=await readFile(join(f.siteRoot,"apps/site/src/content/tools/new-counter.mdx"),"utf8");expect(page).toContain('"draft": true');expect(page).toContain('"description"');expect(page).not.toContain("client:");
 expect(await readFile(join(f.siteRoot,"docs/acceptance/browser-tools/synthetic-counter/test-v1-source-review.json"),"utf8")).toContain("synthetic unit-test");
 const wrapper=await readFile(join(f.siteRoot,"apps/site/src/content-registry/interactive/generated/synthetic-counter-visible.astro"),"utf8");
 expect(wrapper).toContain('import Tool from "@xpotato-tool/synthetic-counter"');expect(wrapper).toContain("client:visible");expect(wrapper).toContain("tool.css");expect(wrapper).not.toContain("__STYLE__");
 const lock=JSON.parse(await readFile(join(f.siteRoot,"package-lock.json"),"utf8"));expect(lock.packages["node_modules/@xpotato-tool/synthetic-counter"].link).toBe(true);
 await expect(installBrowserTool({...f,apply:true})).rejects.toThrow(/replace-artifact/);
 const reviewPath=join(f.siteRoot,"docs/acceptance/browser-tools/synthetic-counter/test-v1-source-review.json"),stored=JSON.parse(await readFile(reviewPath,"utf8"));
 stored.artifactSha256="0".repeat(64);await writeFile(reviewPath,JSON.stringify(stored,null,2)+"\n");
 const configPath=join(f.siteRoot,"config/browser-tools/installations.json"),config=JSON.parse(await readFile(configPath,"utf8"));
 config.installations[0].pin.reviewSha256=toolHash(JSON.stringify(browserToolReviewSchema.parse(stored)));await writeFile(configPath,JSON.stringify(config));
 await initializeBrowserToolInstallations(f.siteRoot);
 await expect(checkBrowserToolInstallations(f.siteRoot)).rejects.toThrow(/review identity/);
 await writeFile(join(f.siteRoot,"apps/site/src/content-registry/interactive/generated/records.ts"),"tamper");
 await expect(checkBrowserToolInstallations(f.siteRoot)).rejects.toThrow(/Stale/);
},60000);
it("rejects unpublished identity/route/taxonomy mistakes and remote review mismatch before adoption",async()=>{
 const f=await fixture();
 for(const p of [{...placement,slug:"../escape"},{...placement,draft:false},{...placement,contentId:"unknown"},{...placement,category:"software"}])
  await expect(installBrowserTool({...f,placement:p})).rejects.toThrow();
 const collision=join(f.siteRoot,"apps/site/src/content/tools/new-counter.md");await writeFile(collision,"Other content");
 await expect(installBrowserTool(f)).rejects.toThrow(/Placement already exists/);await rm(collision);
 await writeFile(join(f.siteRoot,"apps/site/src/content/tools/existing.mdx"),placement.contentId);
 await expect(installBrowserTool(f)).rejects.toThrow(/ContentId/);
 expect(browserToolPlacementSchema.safeParse({...placement,description:""}).success).toBe(false);
},30000);

it("unmanaged wrapper collision is refused without mutation",async()=>{
 const f=await fixture(),path=join(f.siteRoot,"apps/site/src/content-registry/interactive/generated/synthetic-counter-visible.astro");
 await writeFile(path,"UNMANAGED USER WORK");const before=await readFile(join(f.siteRoot,"package-lock.json"));
 await expect(installBrowserTool({...f,apply:true})).rejects.toThrow(/Unmanaged/);
 expect(await readFile(path,"utf8")).toBe("UNMANAGED USER WORK");expect(await readFile(join(f.siteRoot,"package-lock.json"))).toEqual(before);
},30000);

it("failed offline npm restores registration/package/lock preimages and retains only an unselected immutable artifact",async()=>{
 const f=await fixture(),pkgPath=join(f.siteRoot,"package.json"),rootPackage=JSON.parse(await readFile(pkgPath,"utf8"));
 rootPackage.devDependencies={"xpotato-deliberately-uncached-install-test":"0.0.0-no-cache"};await writeFile(pkgPath,JSON.stringify(rootPackage));
 const paths=["config/browser-tools/installations.json","apps/site/package.json","package-lock.json","apps/site/src/content-registry/interactive/generated/records.ts"];
 const before=await Promise.all(paths.map(p=>readFile(join(f.siteRoot,p))));
 await expect(installBrowserTool({...f,apply:true})).rejects.toThrow();
 for(const [i,path]of paths.entries())expect(await readFile(join(f.siteRoot,path))).toEqual(before[i]);
 await expect(readFile(join(f.siteRoot,"apps/site/src/content/tools/new-counter.mdx"))).rejects.toThrow();
 expect(await readFile(join(f.siteRoot,"vendor/browser-tools/synthetic-counter/test-v1/browser-tool.json"),"utf8")).toContain("synthetic-counter");
},60000);

import {toolInstallationFixture} from "../../../../tests/fixtures/tool-installation.js";
import {it,expect,afterEach} from "vitest";import {execFileSync} from "node:child_process";
import {mkdtemp,rm,mkdir,cp,readFile,writeFile} from "node:fs/promises";import {tmpdir} from "node:os";import {join,resolve} from "node:path";
import {browserToolReactPeers,browserToolReviewSchema} from "@xpotato/content-contracts";
import {toolHash} from "./browser-tool-adoption.js";
import {createToolFixture} from "../../../../tests/fixtures/browser-tools.js";
import {checkBrowserToolInstallations,browserToolPlacementSchema,render,assertToolDisplayPolicy,configuration,toolLicenseText} from "./browser-tool-installation.js";
import {installBrowserTool,initializeBrowserToolInstallations} from "../../../../tools/authoring/browser-tool-installation.js";
const roots:string[]=[],originalCache=process.env.npm_config_cache;afterEach(async()=>{
 if(originalCache===undefined)delete process.env.npm_config_cache;else process.env.npm_config_cache=originalCache;
 for(const p of roots.splice(0))await rm(p,{recursive:true,force:true});
});
const placement={contentId:"74caa6aa-296f-48d1-b84f-788e2b5d7524",slug:"new-counter",title:"文字数",description:"端末内で文字数を数えます。",category:"calculation",tags:["math"],pubDate:"2026-10-22",hydration:"visible",draft:true};
async function fixture(){const f=await toolInstallationFixture();roots.push(f.root);return f;}

it("plans without mutation then applies fixed artifact, static wrappers, registry, draft SEO page and npm-owned lock",async()=>{
 const f=await fixture();const before=await readFile(join(f.siteRoot,"config/browser-tools/installations.json"));
 expect(await installBrowserTool(f)).toMatchObject({draft:true,publication:false,network:false});
 expect(await readFile(join(f.siteRoot,"config/browser-tools/installations.json"))).toEqual(before);
 await installBrowserTool({...f,apply:true});await checkBrowserToolInstallations(f.siteRoot);
 const page=await readFile(join(f.siteRoot,"apps/site/src/content/tools/new-counter.mdx"),"utf8");expect(page).toContain('"draft": true');expect(page).toContain('"description"');expect(page).not.toContain("client:");
 expect(await readFile(join(f.siteRoot,"docs/acceptance/browser-tools/synthetic-counter/test-v1-source-review.json"),"utf8")).toContain("synthetic unit-test");
 const wrapper=await readFile(join(f.siteRoot,"apps/site/src/components/interactive-renderers/SyntheticCounterVisible.astro"),"utf8");
 expect(wrapper).toContain('import SyntheticCounter from "../islands/SyntheticCounter.js"');expect(wrapper).toContain("client:visible");expect(await readFile(join(f.siteRoot,"apps/site/src/components/interactive-renderers/SyntheticCounterStyles.astro"),"utf8")).toContain("tool.css?url");expect(wrapper).not.toContain("__STYLE__");
 expect(await readFile(join(f.siteRoot,'apps/site/src/components/islands/SyntheticCounter.tsx'),'utf8')).not.toContain('AGPL');
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
it('rejects case-colliding generated names and borrowed or missing AGPL integration offers',async()=>{
 const f=await fixture(),pin=(await import('./browser-tool-adoption.js').then(m=>m.verifyToolCandidate(f))).pinFields;
 const installations=['foo-bar','foobar'].map((toolId,i)=>({pin:{...pin,toolId,packageName:'@xpotato-tool/'+toolId,releaseId:'fixture-v1'},placement:{contentId:i?'84caa6aa-296f-48d1-b84f-788e2b5d7524':placement.contentId,slug:toolId,hydration:'visible'}}));
 expect(()=>render(configuration.parse({schemaVersion:1,installations}))).toThrow('Case-colliding');
 await expect(assertToolDisplayPolicy(f.siteRoot,'synthetic-counter','AGPL-3.0-only')).rejects.toThrow('offer');
 await expect(assertToolDisplayPolicy(f.siteRoot,'synthetic-counter','AGPL-3.0-only',{capabilitiesOwnedBy:'host',additionalNotices:[],integrationLicense:'AGPL-3.0-only',integrationSourceOffer:'apps/site/licenses/prime-factorizer/SOURCE_OFFER.md'})).rejects.toThrow('another tool');
});
it('copies valid license text as exact bytes and refuses lossy decoding',()=>{
 for(const bytes of [Buffer.from('Copyright © example\r\n'),Buffer.from('\ufeffLicense\n')])expect(Buffer.from(toolLicenseText(bytes))).toEqual(bytes);
 expect(()=>toolLicenseText(Buffer.from([0xff,0xfe,0x41]))).toThrow();
});
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

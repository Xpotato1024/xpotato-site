import {execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,cp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';
import {browserToolReactPeers} from '@xpotato/content-contracts';
import {createToolFixture} from './browser-tools.js';
import {initializeBrowserToolInstallations} from '../../tools/authoring/browser-tool-installation.js';
const placement={contentId:"74caa6aa-296f-48d1-b84f-788e2b5d7524",slug:"new-counter",title:"文字数",description:"端末内で文字数を数えます。",category:"calculation",tags:["math"],pubDate:"2026-10-22",hydration:"visible",draft:true};
export async function toolInstallationFixture({withCurrentTool=false}={}){
 const root=await mkdtemp(join(tmpdir(),"tool-install-"));const f=await createToolFixture(join(root,"fixture"));
 const siteRoot=join(root,"site");
 for(const p of ["config/browser-tools","apps/site/src/content/tools","apps/site/src/content-registry/interactive","apps/site/src/content-registry/taxonomy","vendor/browser-tools"])await mkdir(join(siteRoot,p),{recursive:true});
 await writeFile(join(siteRoot,"config/browser-tools/installations.json"),'{"schemaVersion":1,"installations":[]}\n');
 await writeFile(join(siteRoot,"config/browser-tools/public-admissions.json"),'{"schemaVersion":1,"releases":[]}\n');
 await writeFile(join(siteRoot,"apps/site/src/content-registry/interactive/releases.ts"),'export const browserToolReleases=[...generatedReleases,];\n');
 await cp(resolve("apps/site/src/content-registry/taxonomy/phase5-generated.ts"),join(siteRoot,"apps/site/src/content-registry/taxonomy/phase5-generated.ts"));
 await writeFile(join(siteRoot,"apps/site/src/content-registry/interactive/index.ts"),'export const interactiveModuleRegistry = Object.freeze({...generatedModules});\n');
 await writeFile(join(siteRoot,"apps/site/package.json"),JSON.stringify({name:"@xpotato/site",version:"0.0.0",dependencies:browserToolReactPeers}));
 await writeFile(join(siteRoot,"package.json"),JSON.stringify({name:"test-install",private:true,workspaces:["apps/*"]}));
 // Model the real host's already-pinned React peers. Lock-only adoption must not
 // depend on a developer's cached registry packuments or download any package.
 const hostLock=JSON.parse(await readFile(resolve("package-lock.json"),"utf8")),packages:Record<string,unknown>={
  "":{name:"test-install",workspaces:["apps/*"]},
  "apps/site":{name:"@xpotato/site",version:"0.0.0",dependencies:browserToolReactPeers},
  "node_modules/@xpotato/site":{resolved:"apps/site",link:true}};
 for(const name of ["react","react-dom","scheduler"])packages["node_modules/"+name]=hostLock.packages["node_modules/"+name];
 if(withCurrentTool){
  const config=JSON.parse(await readFile(resolve('config/browser-tools/installations.json'),'utf8')),item=config.installations[0],{pin}=item;
  const paths=['config/browser-tools/installations.json','config/browser-tools/public-admissions.json',
   'apps/site/src/content/tools/'+item.placement.slug+'.mdx','vendor/browser-tools/'+pin.toolId+'/'+pin.releaseId,
   'docs/acceptance/browser-tools/'+pin.toolId+'/'+pin.releaseId+'-source-review.json',item.placement.display.integrationSourceOffer];
  for(const path of paths){await mkdir(join(siteRoot,path,'..'),{recursive:true});await cp(resolve(path),join(siteRoot,path),{recursive:true});}
  const dependency='file:../../vendor/browser-tools/'+pin.toolId+'/'+pin.releaseId;
  const dependencies={...browserToolReactPeers,[pin.packageName]:dependency};
  await writeFile(join(siteRoot,'apps/site/package.json'),JSON.stringify({name:'@xpotato/site',version:'0.0.0',dependencies}));
  packages['apps/site']={name:'@xpotato/site',version:'0.0.0',dependencies};
  packages['node_modules/'+pin.packageName]=hostLock.packages['node_modules/'+pin.packageName];
  const vendor='vendor/browser-tools/'+pin.toolId+'/'+pin.releaseId;packages[vendor]=hostLock.packages[vendor];
 }
 await writeFile(join(siteRoot,"package-lock.json"),JSON.stringify({name:"test-install",lockfileVersion:3,requires:true,packages}));
 process.env.npm_config_cache=join(root,"empty-npm-cache");
 await initializeBrowserToolInstallations(siteRoot);
 const repository="https://github.com/Example/synthetic-counter";
 execFileSync("git",["-C",f.sourceRoot,"remote","add","origin",repository]);
 const review={...f.review,source:{kind:"github" as const,repository},review:{reviewer:"synthetic unit-test evidence only",scope:"source-and-release" as const,decision:"admit" as const}};
 return {root,siteRoot,sourceRoot:f.sourceRoot,artifactRoot:f.artifactRoot,review,releaseId:"test-v1",placement};
}

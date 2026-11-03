// Private actual-Site fixture. Uses the ordinary installer, build and validators.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,readFile,writeFile,cp,rm} from 'node:fs/promises';
import {join,resolve,relative,isAbsolute} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createToolFixture} from '../../tests/fixtures/browser-tools.js';
import {installBrowserTool} from '../authoring/browser-tool-installation.js';
import {verifyToolCandidate} from '../../packages/site-validators/src/browser-tools/browser-tool-adoption.js';
import {parseStaticHeaderRules,headersForPath} from '../../packages/site-validators/src/delivery/static-headers.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),temporary=await mkdtemp(join(tmpdir(),'xpotato-common-tools-')),workspace=join(temporary,'site');
const npm=process.env.npm_execpath;if(!npm||!isAbsolute(npm))throw Error('Pinned npm entrypoint required');
const run=(args:string[],cwd=workspace)=>execFileSync(process.execPath,args,{cwd,stdio:'pipe',maxBuffer:8*1024*1024,env:{...process.env,ASTRO_TELEMETRY_DISABLED:'1'}});
let created=false;
try{
 execFileSync('git',['worktree','add','--detach',workspace,'HEAD'],{cwd:root,stdio:'pipe'});created=true;
 const pins=[];
 for(const [i,toolId,bounded]of [[0,'synthetic-words',false],[1,'synthetic-transformer',true]] as const){
  const f=await createToolFixture(join(temporary,toolId),{toolId,bounded}),repository='https://github.com/Example/'+toolId;
  execFileSync('git',['-C',f.sourceRoot,'remote','add','origin',repository]);
  const review={...f.review,source:{kind:'github' as const,repository},review:{reviewer:'PRIVATE synthetic Site workflow harness; not an external release review',scope:'source-and-release' as const,decision:'admit' as const}};
  await installBrowserTool({siteRoot:workspace,...f,review,releaseId:'fixture-v1',apply:true,placement:{contentId:i?'84caa6aa-296f-48d1-b84f-788e2b5d7524':'74caa6aa-296f-48d1-b84f-788e2b5d7524',slug:toolId,title:'PRIVATE SYNTHETIC '+toolId,description:'Isolated workflow proof, never a public release',category:'calculation',tags:['math'],pubDate:'2026-11-03',hydration:'load',draft:true}});
  const c=JSON.parse(await readFile(join(workspace,'config/browser-tools/installations.json'),'utf8'));pins.push(c.installations.find((p:any)=>p.pin.toolId===toolId).pin);
  const path=join(workspace,'apps/site/src/content/tools',toolId+'.mdx');await writeFile(path,(await readFile(path,'utf8')).replace('"draft": true','"draft": false'));
  // The next install checks existing public entries too, so add this synthetic
  // exact admission before invoking the same entrypoint for the second tool.
  const pathAdmission=join(workspace,'config/browser-tools/public-admissions.json'),admission=JSON.parse(await readFile(pathAdmission,'utf8'));admission.releases.push(pins.at(-1));await writeFile(pathAdmission,JSON.stringify(admission,null,2)+'\n');
  const prior=pins.at(-1),page=await readFile(path,'utf8'),next=await createToolFixture(join(temporary,toolId+'-update'),{toolId,bounded,version:'1.0.1'});
  execFileSync('git',['-C',next.sourceRoot,'remote','add','origin',repository]);
  const nextReview={...next.review,source:review.source,review:review.review},releaseId='fixture-v2';
  const nextPin={...(await verifyToolCandidate({...next,review:nextReview})).pinFields,releaseId};
  await installBrowserTool({siteRoot:workspace,...next,review:nextReview,releaseId,replaceArtifact:prior.artifactSha256,publicAdmission:nextPin,apply:true});
  assert.equal(await readFile(path,'utf8'),page);pins[pins.length-1]=nextPin;
 }
 run([npm,'ci','--offline','--ignore-scripts','--no-audit','--no-fund']);
 run([npm,'run','browser-tools:install','--','check']);run([npm,'run','build']);run([npm,'run','publication:check']);run([npm,'run','validate:static']);run([npm,'run','migration:interactive:check']);
 const dist=join(workspace,'apps/site/dist'),headers=parseStaticHeaderRules(await readFile(join(dist,'_headers'),'utf8'));
 for(const {toolId}of pins){const route='/tools/'+toolId+'/',html=await readFile(join(dist,route.slice(1),'index.html'),'utf8'),csp=headersForPath(route,headers)['content-security-policy'];
  assert.ok(csp);assert.ok(html.includes('data-interactive-module="'+toolId+'"'));assert.equal(csp.includes('worker-src blob:'),toolId==='synthetic-transformer');assert.equal(csp.includes("'wasm-unsafe-eval'"),toolId==='synthetic-transformer');}
 await mkdir(join(root,'.local'),{recursive:true});const output=await mkdtemp(join(root,'.local/common-tool-workflows-'));await cp(dist,join(output,'dist'),{recursive:true});
 const receipt={scope:'PRIVATE_SYNTHETIC_ACTUAL_SITE_BUILD',sourceSha:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),dist:relative(root,join(output,'dist')),tools:pins.map(p=>({toolId:p.toolId,releaseId:p.releaseId,artifactSha256:p.artifactSha256,createdAndUpdated:true})),providerCalls:0,productionEligible:false};
 await writeFile(join(root,'.local/common-tool-workflows.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
}finally{
 const within=relative(resolve(tmpdir()),resolve(workspace));if(created&&within&&!within.startsWith('..')&&!isAbsolute(within))execFileSync('git',['worktree','remove','--force',workspace],{cwd:root,stdio:'pipe'});
 const owned=relative(resolve(tmpdir()),resolve(temporary));if(!owned||owned.startsWith('..')||isAbsolute(owned)||!owned.startsWith('xpotato-common-tools-'))throw Error('Unsafe fixture cleanup target');
 await rm(temporary,{recursive:true,force:true});
}

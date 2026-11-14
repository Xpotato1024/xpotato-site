import {checkBuiltPayloadIntegrity} from './built-payload-integrity.js';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {browserToolReleases} from '../../../../apps/site/src/content-registry/interactive/releases.js';
import {interactiveModuleRegistry} from '../../../../apps/site/src/content-registry/interactive/index.js';
import {readRegisteredToolRoutes,validateRegisteredToolHtml} from './tool-runtime-policy.js';
import {verifyToolPin} from './browser-tool-adoption.js';
import {load} from './browser-tool-installation.js';
import {headersForPath,parseStaticHeaderRules} from '../delivery/static-headers.mjs';
/** Common actual-dist acceptance. Product calculation/algorithm matrices belong to the admitted upstream release. */
export async function checkInstalledToolsReadiness(root:string){
 const tools=await readRegisteredToolRoutes(),configuration=await load(root),headers=parseStaticHeaderRules(await readFile(join(root,'apps/site/dist/_headers'),'utf8'));
 const siteCommit=execFileSync('git',['-c','core.fsmonitor=false','-C',root,'rev-parse','HEAD'],{encoding:'utf8',env:{...process.env,GIT_NO_REPLACE_OBJECTS:'1',GIT_OPTIONAL_LOCKS:'0'}}).trim();
 assert.match(siteCommit,/^[a-f0-9]{40}$/u);const results=[];
 for(const tool of tools){
  const module=interactiveModuleRegistry[tool.moduleId],pin=browserToolReleases.find(p=>p.toolId===tool.moduleId&&p.releaseId===module?.releaseId);assert.ok(pin,'Selected release required');
  const manifest=await verifyToolPin(join(root,'vendor/browser-tools'),pin),item=configuration.installations.find(i=>i.pin.toolId===pin.toolId);assert.ok(item,'Common installation required');
  const path=tool.route.slice(1)+'index.html',html=await readFile(join(root,'apps/site/dist',path),'utf8');
  assert.deepEqual(validateRegisteredToolHtml(path,html,tools),[]);assert.ok(html.includes('data-tool-release='+JSON.stringify(pin.releaseId)));assert.ok(html.includes(pin.sourceCommit));
  if(item.placement.display?.integrationSourceOffer){assert.ok(html.includes('data-site-source-commit="'+siteCommit+'"'));assert.ok(html.includes('https://github.com/Xpotato1024/xpotato-site/blob/'+siteCommit+'/'+item.placement.display.integrationSourceOffer));}
  for(const notice of item.placement.display?.additionalNotices??[]){
   const bytes:Buffer=await readFile(join(root,'vendor/browser-tools',pin.toolId,pin.releaseId,notice.file));
   const publicPath:string='tool-licenses/'+pin.toolId+'-v'+manifest.version+'/'+notice.file.split('/').at(-1);
   assert.deepEqual(await readFile(join(root,'apps/site/public',publicPath)),bytes);assert.deepEqual(await readFile(join(root,'apps/site/dist',publicPath)),bytes);assert.ok(html.includes('/'+publicPath));}
  const csp=headersForPath(tool.route,headers)['content-security-policy']!;
  assert.equal(csp.includes("'wasm-unsafe-eval'"),manifest.runtime.capabilities.wasm);
  assert.equal(csp.includes('worker-src blob:'),manifest.runtime.capabilities.worker);assert.ok(csp.includes("connect-src 'none'"));
  assert.ok(!csp.includes("'unsafe-eval'")&&!csp.includes("'unsafe-inline'"));
  const payloads=await checkBuiltPayloadIntegrity({dist:join(root,'apps/site/dist'),route:tool.route,html,artifactRoot:join(root,'vendor/browser-tools',pin.toolId,pin.releaseId),artifactSha256:pin.artifactSha256,modules:'embeddedWorkerModules' in manifest.runtime?manifest.runtime.embeddedWorkerModules:[]});
  results.push({payloads,toolId:pin.toolId,releaseId:pin.releaseId,sourceCommit:pin.sourceCommit,artifactSha256:pin.artifactSha256,route:tool.route});
 }
 for(const path of ['/','/search/','/articles/unpublished/','/unknown/']){const csp=headersForPath(path,headers)['content-security-policy']!;assert.ok(!csp.includes("'wasm-unsafe-eval'")&&!csp.includes('worker-src blob:'));}
 return results;
}

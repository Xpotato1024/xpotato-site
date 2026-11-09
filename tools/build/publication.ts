import {buildPrimePwa} from './prime-pwa/build.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readSiteContent} from '../../packages/site-validators/src/site-content.js';
import {selectPublishedCatalog} from "../../apps/site/src/lib/discovery/catalog.js";
import {mediaRegistries} from '../../apps/site/src/content-registry/media/index.js';
import {publishedMediaEvidence} from '../../apps/site/src/content-registry/media-evidence/index.js';
import {buildPublicationMediaManifest} from "../../apps/site/src/lib/media/publication-media-manifest.js";
import {publicationMediaManifestPath} from "../../scripts/release/deployment/publication-media-policy.mjs";
import {compilePublicationPlan,readPublicationFiles} from "../../scripts/release/deployment/publication-plan.mjs";
import {analyzeBuiltHtml,readBuiltHtml,readBuiltSecurityAssets,renderSecurityHeaderArtifact,validateBuiltHtmlAgainstSecurityHeaders} from "../../packages/site-validators/src/delivery/security-headers.js";
import {readRegisteredToolRoutes} from "../../packages/site-validators/src/browser-tools/tool-runtime-policy.js";
import {readPublicArtifactTargets} from "../../scripts/release/deployment/manual-deployment.mjs";
import {validateOptionalServicesAbsent} from "../../packages/site-validators/src/delivery/optional-services.js";
const root=new URL("../../",import.meta.url),dist=new URL('apps/site/dist/',root);
const entries=selectPublishedCatalog((await readSiteContent()).catalog),ids=new Set(entries.map(e=>e.routeRecord.contentId));
const inputs=mediaRegistries.filter(r=>ids.has(r.contentId)&&r.assets.some(a=>a.status==='active')).map(registry=>{
 const evidence=publishedMediaEvidence[registry.contentId];
 if(!evidence)throw Error('PUBLICATION_MEDIA_EVIDENCE_REQUIRED');
 return {registry,evidence};
});
const sourceSha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const media=buildPublicationMediaManifest(sourceSha,inputs),tools=await readRegisteredToolRoutes();
const html=await readBuiltHtml(fileURLToPath(dist)),assets=await readBuiltSecurityAssets(fileURLToPath(dist));
const analysis=analyzeBuiltHtml(html,tools),headers=renderSecurityHeaderArtifact(analysis);
const errors=[...validateBuiltHtmlAgainstSecurityHeaders(headers,html,assets,tools),...validateOptionalServicesAbsent(html,assets)];
if(errors.length)throw Error('PUBLICATION_SECURITY_INVALID\n'+errors.join('\n'));
if(!process.argv.includes('--check'))await writeFile(new URL('_headers',dist),headers);
await buildPrimePwa(fileURLToPath(dist),{check:process.argv.includes('--check')});
const files=await readPublicationFiles(fileURLToPath(dist));
const manifest=compilePublicationPlan({files,sourceSha,media,headers,publishedRoutes:entries.map(e=>e.routeRecord.route)});
const output=new URL(publicationMediaManifestPath,dist),text=JSON.stringify(manifest)+'\n';
if(process.argv.includes('--check')){
 if(await readFile(output,'utf8')!==text||await readFile(new URL('_headers',dist),'utf8')!==headers)throw Error('PUBLICATION_PROJECTION_CHANGED');
 const legacy=JSON.parse(await readFile(new URL('docs/migration/content-materialization-v1.json',root),'utf8'));
 await readPublicArtifactTargets(fileURLToPath(root),sourceSha,legacy.records.filter((row:{collection:string})=>row.collection==='blog').map((row:{vNextContentId:string})=>row.vNextContentId));
}else{
 await writeFile(new URL('_headers',dist),headers);await writeFile(output,text);
}
console.log('Publication/CSP artifact: '+manifest.routes.length+' routes, '+manifest.targets.length+' checks, '+media.objects.length+' registered media objects; no provider access');

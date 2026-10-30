import {parseArgs} from 'node:util';import {mkdir} from 'node:fs/promises';import {resolve,join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {contentMediaRegistrySchema} from '@xpotato/content-contracts';
import {inspectPublicationPreparation,publicationMetadataPlanSchema} from '../packages/article-pipeline/src/publication-preparation.js';
import {safeRead,safeReadBytes,noLinks,immutable} from '../packages/article-pipeline/src/private-files.js';
import {inspectRasterBytes} from '@xpotato/media-ingest';
import {sha256} from '../packages/article-pipeline/src/canonical.js';
import {taxonomyRegistry} from '../apps/site/src/content-registry/taxonomy/index.js';
import {mediaRegistries} from '../apps/site/src/content-registry/media/index.js';
import {publishedMediaEvidence} from '../apps/site/src/content-registry/media-evidence/index.js';
import {splitDraft} from '../packages/article-pipeline/src/draft-job.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const {values}=parseArgs({options:{draft:{type:'string'},route:{type:'string'},preview:{type:'string'}}});
if(!values.draft||!values.route)throw Error('--draft and --route required');
function localInput(value:string,extension:string){const path=resolve(root,value),r=relative(root,path).replaceAll('\\','/');if(!/^(?:tests\/fixtures\/|\.local\/)/u.test(r)||r.split('/').some(s=>s==='..')||!r.endsWith(extension))throw Error('PREPARATION_INPUT_PATH_DENIED');return path;}
const mdx=await safeRead(localInput(values.draft,'.mdx')),fm=splitDraft(mdx).frontmatter;
const plan=publicationMetadataPlanSchema.parse(JSON.parse(await safeRead(join(root,'docs/acceptance/articles/3d-print-publication-plan.json'))));
let preview:Parameters<typeof inspectPublicationPreparation>[0]['preview'];
if(values.preview){
 const path=localInput(values.preview,'.json'),p=JSON.parse(await safeRead(path)),registry=contentMediaRegistrySchema.parse(p.media?.registry);
 if(p.productionEligible!==false||typeof p.identity?.mdxSha256!=='string'||typeof p.heroState!=='string'||!Array.isArray(p.media?.localObjects))throw Error('PREPARATION_PREVIEW_INVALID');
 const folder=resolve(path,'..'),objects=p.media.localObjects as {sha256:string;path:string;contentType:string}[];
 const refs=registry.assets.flatMap(a=>[a.delivery.master,...a.delivery.variants]);
 if(objects.length!==new Set(refs.map(r=>r.sha256)).size||new Set(objects.map(o=>o.sha256)).size!==objects.length||refs.some(ref=>objects.filter(o=>o.sha256===ref.sha256).length!==1))throw Error('PREPARATION_OBJECT_SET_MISMATCH');
 for(const object of objects){
  if(!/^[a-z0-9-]+\.png$/u.test(object.path)||object.contentType!=='image/png')throw Error('PREPARATION_OBJECT_PATH_OR_MIME_DENIED');
  const bytes=await safeReadBytes(join(folder,object.path)),meta=await inspectRasterBytes(bytes);
  if(sha256(bytes)!==object.sha256||meta.format!=='png'||refs.filter(r=>r.sha256===object.sha256).some(r=>r.format!=='png'||r.sizeBytes!==bytes.length||r.width!==meta.width||r.height!==meta.height))throw Error('PREPARATION_OBJECT_BYTES_OR_METADATA_CHANGED');
 }
 preview={mdxSha256:p.identity.mdxSha256,heroState:p.heroState,socialProfileId:p.identity?.social?.profileId??'',registry,objectsVerified:true};
}
// Read canonical content through its real files; never import the fixture there.
const {readSiteContent}=await import('../packages/site-validators/src/site-content.js');
const canonicalContentPresent=(await readSiteContent()).sourcePaths.has(fm.id);
const matches=mediaRegistries.filter(r=>r.contentId===fm.id);if(matches.length>1)throw Error('PREPARATION_REGISTRY_DUPLICATE');
const report=inspectPublicationPreparation({mdx,route:values.route,categories:taxonomyRegistry.blogCategories,tags:taxonomyRegistry.tags,canonicalContentPresent,
 ...(plan.contentId===fm.id?{metadataPlan:plan}:{}),
 ...(matches[0]?{registry:matches[0]}:{}),...(publishedMediaEvidence[fm.id]?{evidence:publishedMediaEvidence[fm.id]}:{}),...(preview?{preview}:{})});
const out=join(root,'.local/article-publication-preparation');await noLinks(root);await mkdir(out,{recursive:true});await noLinks(out);
await immutable(join(out,report.reportSha256+'.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,productionEligible:report.productionEligible,contentId:report.content.contentId,reportSha256:report.reportSha256,checks:report.checks},null,2));

import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {readSiteContent} from '../packages/site-validators/src/site-content.js';
import {selectPublishedCatalog} from '../apps/site/src/lib/catalog.js';
import {mediaRegistries} from '../apps/site/src/content-registry/media/index.js';
import {publishedMediaEvidence} from '../apps/site/src/content-registry/media-evidence/index.js';
import {buildPublicationMediaManifest} from '../apps/site/src/lib/publication-media-manifest.js';
import {publicationMediaManifestPath} from './release/publication-media-policy.mjs';
const root=new URL('../',import.meta.url);
const ids=new Set(selectPublishedCatalog((await readSiteContent()).catalog).map(e=>e.routeRecord.contentId));
const inputs=mediaRegistries.filter(r=>ids.has(r.contentId)&&r.assets.some(a=>a.status==='active')).map(registry=>{
 const evidence=publishedMediaEvidence[registry.contentId];
 if(!evidence)throw Error('PUBLICATION_MEDIA_EVIDENCE_REQUIRED');
 return {registry,evidence};
});
const manifest=buildPublicationMediaManifest(execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),inputs);
const output=new URL('apps/site/dist/'+publicationMediaManifestPath,root),text=JSON.stringify(manifest)+'\n';
if(process.argv.includes('--check')){if(await readFile(output,'utf8')!==text)throw Error('PUBLICATION_MEDIA_PROJECTION_CHANGED');}
else await writeFile(output,text);
console.log('Published media build projection: '+manifest.objects.length+' exact objects; no provider access');

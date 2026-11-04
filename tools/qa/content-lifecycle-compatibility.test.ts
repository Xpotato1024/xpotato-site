import {it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {readSiteContent} from '../../packages/site-validators/src/site-content.js';
import {readRegisteredToolRoutes} from '../../packages/site-validators/src/browser-tools/tool-runtime-policy.js';
import {readPreviousPublication,revisionPaths} from '../../packages/article-pipeline/src/publication/publication-revision.js';
import {publicationRegistryIndexChanges} from '../../packages/article-pipeline/src/publication/publication-export-patch.js';
import {fingerprint} from '../../packages/article-pipeline/src/canonical.js';

it('the actual installed public tool uses the same release/admission route reader',async()=>{
 const routes=await readRegisteredToolRoutes();expect(routes.length).toBeGreaterThan(0);
 expect(routes.every(r=>r.route.startsWith('/tools/')&&r.contentId&&r.moduleId)).toBe(true);
});
it('actual published Article Job records satisfy the common update preimage and registry projection contract',async()=>{
 const root=resolve('.'),{catalog,sourcePaths}=await readSiteContent(root);let checked=0;
 for(const entry of catalog.filter(e=>e.disposition==='published'&&e.source.collection==='blog')){
  const id=entry.routeRecord.contentId,paths=revisionPaths(id,entry.source.slug),base:Record<string,string>={};
  for(const path of Object.values(paths))base[path]=await readFile(resolve(root,path),'utf8');
  expect(sourcePaths.get(id)).toBe(resolve(root,paths.mdx));
  const previous=readPreviousPublication(id,entry.source.slug,base);expect(previous.binding.route).toBe(entry.routeRecord.route);
  const index=async(name:string)=>readFile(resolve(root,'apps/site/src/content-registry/'+name+'/index.ts'),'utf8');
  const changes=publicationRegistryIndexChanges({id,provenanceSha256:fingerprint(previous.provenance),media:await index('media'),rights:await index('media-rights'),provenance:await index('provenance'),redirects:null,routeChanged:false});
  for(const source of Object.values(changes))expect(source.split('from "./blog/'+id+'.json"')).toHaveLength(2);
  checked++;
 }
 expect(checked).toBeGreaterThan(0);
});

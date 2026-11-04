import {randomUUID} from 'node:crypto';
import {lstat,readFile,realpath,writeFile} from 'node:fs/promises';
import {join,relative,resolve} from 'node:path';
import {stringify} from 'yaml';
import {pageFrontmatterSchema,slugSchema} from '@xpotato/content-contracts';
import {deriveContentCatalog,selectPublishedCatalog} from '../../../apps/site/src/lib/catalog.js';
import {taxonomyRegistry} from '../../../apps/site/src/content-registry/taxonomy/index.js';
import {applicationRedirects} from '../../../apps/site/src/content-registry/redirects.js';
import {readSiteContent} from './site-content.js';

/** Small fixed-page draft writer; article exports and tool installations have their own existing owners. */
export async function createPageDraft(repository:string,input:{slug:string;title:string;description:string}){
 const root=await realpath(repository),slug=slugSchema.parse(input.slug);
 const packageJson=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
 if(packageJson.name!=='xpotato-site-vnext')throw Error('SITE_REPOSITORY_REQUIRED');
 const data=pageFrontmatterSchema.parse({id:randomUUID(),title:input.title,description:input.description,draft:true});
 const folder=join(root,'apps/site/src/content/pages');
 let parent=root;
 for(const part of relative(root,folder).split(/[\\/]/u)){
  parent=join(parent,part);if((await lstat(parent)).isSymbolicLink())throw Error('PAGE_SYMLINK_DENIED');
 }
 if(resolve(await realpath(folder))!==resolve(folder))throw Error('PAGE_PATH_ESCAPE');
 for(const collection of ['blog','notes','projects','tools','pages'])if((await lstat(join(folder,'..',collection))).isSymbolicLink())throw Error('PAGE_SYMLINK_DENIED');
 const existing=await readSiteContent(root);
 const catalog=deriveContentCatalog([...existing.catalog.map(e=>e.source),{collection:'pages',slug,data}],taxonomyRegistry);
 const route=catalog.find(e=>e.routeRecord.contentId===data.id)!.routeRecord.route;
 if(applicationRedirects.some(r=>r.sourcePath===route))throw Error('PAGE_REDIRECT_COLLISION');
 const body=await readFile(new URL('../../../templates/content/page.md',import.meta.url),'utf8');
 const source='---\n'+stringify(data,{lineWidth:0}).trimEnd()+'\n---\n\n'+body;
 const file=join(folder,slug+'.mdx');await writeFile(file,source,{flag:'wx',encoding:'utf8'});
 return {file:relative(root,file).replaceAll('\\','/'),contentId:data.id,route,draft:true,productionEligible:false,
  published:selectPublishedCatalog(catalog).some(e=>e.routeRecord.contentId===data.id)};
}

import {randomUUID} from 'node:crypto';
import {lstat,readFile,realpath,writeFile} from 'node:fs/promises';
import {join,relative,resolve} from 'node:path';
import {stringify} from 'yaml';
import {noteFrontmatterSchema,pageFrontmatterSchema,slugSchema} from '@xpotato/content-contracts';
import {deriveContentCatalog,selectPublishedCatalog,type CatalogSourceRecord} from '../../apps/site/src/lib/discovery/catalog.js';
import {taxonomyRegistry} from '../../apps/site/src/content-registry/taxonomy/index.js';
import {applicationRedirects} from '../../apps/site/src/content-registry/redirects.js';
import {readSiteContent} from '../../packages/site-validators/src/site-content.js';

type DraftInput = {slug:string;title:string;description:string} & (
 | {collection:'pages'}
 | {collection:'notes';pubDate:string;subject?:string;tags?:string[]}
);

/** Shared draft scaffolding, never a publisher. Article Jobs and tool installers keep their owners. */
export async function createContentDraft(repository:string,input:DraftInput){
 const root=await realpath(repository),slug=slugSchema.parse(input.slug);
 const packageJson=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
 if(packageJson.name!=='xpotato-site-vnext')throw Error('SITE_REPOSITORY_REQUIRED');
 const common={id:randomUUID(),title:input.title,description:input.description,draft:true};
 const source:CatalogSourceRecord=input.collection==='pages'
  ? {collection:'pages',slug,data:pageFrontmatterSchema.parse(common)}
  : {collection:'notes',slug,data:noteFrontmatterSchema.parse({...common,pubDate:input.pubDate,subject:input.subject??'everyday',tags:input.tags??[]})};
 if(source.collection==='notes'){
  if(!taxonomyRegistry.noteSubjects.some(t=>t.id===source.data.subject&&t.status==='active'))throw Error('CONTENT_SUBJECT_UNKNOWN');
  if(source.data.tags.some(id=>!taxonomyRegistry.tags.some(t=>t.id===id&&t.status==='active')))throw Error('CONTENT_TAG_UNKNOWN');
 }
 const folder=join(root,'apps/site/src/content',source.collection);
 let parent=root;
 for(const part of relative(root,folder).split(/[\\/]/u)){
  parent=join(parent,part);if((await lstat(parent)).isSymbolicLink())throw Error('CONTENT_SYMLINK_DENIED');
 }
 if(resolve(await realpath(folder))!==resolve(folder))throw Error('CONTENT_PATH_ESCAPE');
 for(const collection of ['blog','notes','projects','tools','pages'])if((await lstat(join(folder,'..',collection))).isSymbolicLink())throw Error('CONTENT_SYMLINK_DENIED');
 const existing=await readSiteContent(root);
 const catalog=deriveContentCatalog([...existing.catalog.map(e=>e.source),source],taxonomyRegistry);
 const route=catalog.find(e=>e.routeRecord.contentId===source.data.id)!.routeRecord.route;
 if(applicationRedirects.some(r=>r.sourcePath===route))throw Error('CONTENT_REDIRECT_COLLISION');
 const template=source.collection==='pages'?'page.md':'note.md';
 const body=await readFile(new URL('../../templates/content/'+template,import.meta.url),'utf8');
 // Astro's frontmatter reader accepts YAML 1.1 timestamps; keep editorial dates as strings there too.
 const document='---\n'+stringify(source.data,{lineWidth:0,defaultKeyType:'PLAIN',defaultStringType:'QUOTE_DOUBLE'}).trimEnd()+'\n---\n\n'+body;
 const file=join(folder,slug+'.mdx');await writeFile(file,document,{flag:'wx',encoding:'utf8'});
 return {file:relative(root,file).replaceAll('\\','/'),contentId:source.data.id,route,draft:true,productionEligible:false,
  published:selectPublishedCatalog(catalog).some(e=>e.routeRecord.contentId===source.data.id)};
}

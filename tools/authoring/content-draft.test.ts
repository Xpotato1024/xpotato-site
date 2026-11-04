import {it,expect} from 'vitest';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createContentDraft} from './content-draft.js';
import {readSiteContent} from '../../packages/site-validators/src/site-content.js';
import {selectPublishedCatalog,selectSearchEligibleCatalog,selectWebIndexableCatalog} from '../../apps/site/src/lib/discovery/catalog.js';
import {generateArchivePages,selectRelated} from '../../apps/site/src/lib/discovery/discovery.js';
import {renderRssFeed} from '../../apps/site/src/lib/discovery/rss.js';
import {taxonomyRegistry} from '../../apps/site/src/content-registry/taxonomy/index.js';

async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'content-draft-'));
 await writeFile(join(root,'package.json'),JSON.stringify({name:'xpotato-site-vnext'}));
 for(const c of ['blog','notes','projects','tools','pages'])await mkdir(join(root,'apps/site/src/content',c),{recursive:true});
 return root;
}
const input={collection:'notes' as const,slug:'ordinary-day',title:'日常 " のこと',description:'短い抜粋です。',pubDate:'2026-11-04'};
it('creates a memo without technical classification or media and keeps it out of every public selection',async()=>{
 const root=await fixture();
 try{
  const draft=await createContentDraft(root,input),catalog=(await readSiteContent(root)).catalog;
  expect(draft).toMatchObject({route:'/notes/ordinary-day/',draft:true,published:false,productionEligible:false});
  expect(catalog[0]!.source.data).toMatchObject({title:input.title,draft:true,subject:'everyday',tags:[]});
  expect(selectPublishedCatalog(catalog)).toEqual([]);expect(selectSearchEligibleCatalog(catalog)).toEqual([]);
  const records=selectWebIndexableCatalog(catalog).map(e=>e.discoveryRecord);
  expect(generateArchivePages(records,taxonomyRegistry).find(p=>p.collection==='notes')!.items).toEqual([]);
  expect(renderRssFeed(records,taxonomyRegistry,{name:'fixture',description:'fixture',canonicalOrigin:'https://xpotato.net/'})).not.toContain('<item>');
  expect(selectRelated(catalog[0]!.discoveryRecord,records,taxonomyRegistry)).toEqual([]);
  const before=await readFile(join(root,draft.file),'utf8');
  expect(before).toContain('pubDate: "2026-11-04"');
  expect(before).not.toContain('dot のひとこと');
  await expect(createContentDraft(root,input)).rejects.toThrow();
  expect(await readFile(join(root,draft.file),'utf8')).toBe(before);
  for(const overrides of [{slug:'../escape'},{subject:'unknown'},{tags:['unknown']},{tags:['astro','astro']},{pubDate:'not-a-date'}])
   await expect(createContentDraft(root,{...input,slug:'rejected',...overrides})).rejects.toThrow();
  expect((await readSiteContent(root)).catalog).toHaveLength(1);
 }finally{await rm(root,{recursive:true,force:true});}
});
it.skipIf(process.platform==='win32')('shares the fixed-page symlink guard and leaves outside files untouched',async()=>{
 const root=await fixture();
 try{
  const folder=join(root,'apps/site/src/content/notes'),outside=join(root,'untouched');
  await rm(folder,{recursive:true});await mkdir(outside);await symlink(outside,folder);
  await expect(createContentDraft(root,input)).rejects.toThrow('CONTENT_SYMLINK_DENIED');
  expect(await readdir(outside)).toEqual([]);
 }finally{await rm(root,{recursive:true,force:true});}
});

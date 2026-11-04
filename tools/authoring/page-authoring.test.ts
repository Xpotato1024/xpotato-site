import {it,expect} from 'vitest';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createPageDraft} from './page-authoring.js';
import {readSiteContent} from '../../packages/site-validators/src/site-content.js';
import {selectPublishedCatalog,selectSearchEligibleCatalog} from "../../apps/site/src/lib/discovery/catalog.js";
it('creates a schema-valid fixed page with one stable ID, safely outside public discovery',async()=>{
 const root=await mkdtemp(join(tmpdir(),'page-draft-'));
 try{
  await writeFile(join(root,'package.json'),JSON.stringify({name:'xpotato-site-vnext'}));
  for(const c of ['blog','notes','projects','tools','pages'])await mkdir(join(root,'apps/site/src/content',c),{recursive:true});
  const page=await createPageDraft(root,{slug:'workflow-example',title:'引用符 " と日本語',description:'固定ページの下書きです。'});
  const catalog=(await readSiteContent(root)).catalog;
  expect(catalog).toHaveLength(1);expect(catalog[0]!.source.data.title).toBe('引用符 " と日本語');
  expect(page).toMatchObject({route:'/workflow-example/',draft:true,published:false,productionEligible:false});
  expect(selectPublishedCatalog(catalog)).toEqual([]);expect(selectSearchEligibleCatalog(catalog)).toEqual([]);
  const before=await readFile(join(root,page.file),'utf8');
  await expect(createPageDraft(root,{slug:'workflow-example',title:'別の本文',description:'上書き禁止'})).rejects.toThrow();
  expect(await readFile(join(root,page.file),'utf8')).toBe(before);
  for(const slug of ['../escape','articles','tools','search'])await expect(createPageDraft(root,{slug,title:'確認',description:'予約URL'})).rejects.toThrow();
  expect((await readSiteContent(root)).catalog[0]!.routeRecord.contentId).toBe(page.contentId);
 }finally{await rm(root,{recursive:true,force:true});}
});
it.skipIf(process.platform==='win32')('refuses a linked content directory before reading it or writing a page',async()=>{
 const root=await mkdtemp(join(tmpdir(),'page-linked-'));
 try{
  await writeFile(join(root,'package.json'),JSON.stringify({name:'xpotato-site-vnext'}));
  for(const c of ['blog','notes','projects','tools'])await mkdir(join(root,'apps/site/src/content',c),{recursive:true});
  const outside=join(root,'untouched');await mkdir(outside);await symlink(outside,join(root,'apps/site/src/content/pages'));
  await expect(createPageDraft(root,{slug:'example',title:'下書き',description:'検証'})).rejects.toThrow('PAGE_SYMLINK_DENIED');
  expect(await readdir(outside)).toEqual([]);
 }finally{await rm(root,{recursive:true,force:true});}
});

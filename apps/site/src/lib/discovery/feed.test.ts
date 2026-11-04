import {it,expect} from 'vitest';
import {deriveContentCatalog,selectFeedEligibleCatalog,selectPublishedCatalog,selectSearchEligibleCatalog,selectWebIndexableCatalog,type CatalogSourceRecord} from './catalog.js';
import {renderRssFeed} from './rss.js';
import {taxonomyRegistry} from '../../content-registry/taxonomy/index.js';
import {readSiteContent} from '../../../../../packages/site-validators/src/site-content.js';
import {blogFrontmatterSchema,noteFrontmatterSchema,projectFrontmatterSchema,toolFrontmatterSchema,pageFrontmatterSchema,contentDiscoveryRecordSchema} from '@xpotato/content-contracts';

const site={canonicalOrigin:'https://xpotato.net/',name:'fixture',description:'fixture'};
const common={id:'11111111-1111-4111-8111-111111111111',title:'synthetic',description:'synthetic',pubDate:'2026-11-04',tags:[],draft:false};
const entry=(collection:'blog'|'notes'|'tools',options:{feed?:boolean;draft?:boolean;seo?:{noindex:boolean}}={}):CatalogSourceRecord=>{
 const data={...common,...options};
 return collection==='blog'?{collection,slug:'synthetic',data:{...data,category:'software'}}
  :collection==='notes'?{collection,slug:'synthetic',data:{...data,subject:'everyday'}}
  :{collection,slug:'synthetic',data:{...data,category:'calculation'}};
};

it.each([
 ['blog',undefined,true],['blog',false,false],['blog',true,true],
 ['notes',undefined,false],['notes',false,false],['notes',true,true],
 ['tools',undefined,false],['tools',false,false],['tools',true,true],
] as const)('preserves default participation and explicit intent for %s / feed=%s', (collection,feed,included)=>{
 const catalog=deriveContentCatalog([entry(collection,feed===undefined?{}:{feed})],taxonomyRegistry);
 expect(selectPublishedCatalog(catalog)).toHaveLength(1);
 expect(selectSearchEligibleCatalog(catalog)).toHaveLength(1);
 expect(selectWebIndexableCatalog(catalog)).toHaveLength(1);
 expect(selectFeedEligibleCatalog(catalog)).toHaveLength(included?1:0);
 const xml=renderRssFeed(catalog.map(e=>e.discoveryRecord),taxonomyRegistry,site);
 expect(xml.includes('<item>')).toBe(included);
 expect(catalog[0]!.discoveryRecord.feed).toBe(feed);
});

it.each([[true,false],[false,true],[true,true]] as const)('feed opt-in cannot override draft=%s / noindex=%s',(draft,noindex)=>{
 const catalog=deriveContentCatalog([entry('notes',{feed:true,draft,seo:{noindex}})],taxonomyRegistry);
 expect(selectPublishedCatalog(catalog)).toHaveLength(draft?0:1);
 expect(selectFeedEligibleCatalog(catalog)).toEqual([]);
 expect(selectSearchEligibleCatalog(catalog)).toEqual([]);
 expect(renderRssFeed(catalog.map(e=>e.discoveryRecord),taxonomyRegistry,site)).not.toContain('<item>');
});

it('does not enroll undated pages or allow nonboolean participation values',()=>{
 const page={id:common.id,title:common.title,description:common.description,draft:false,feed:true};
 const catalog=deriveContentCatalog([{collection:'pages',slug:'synthetic',data:page}],taxonomyRegistry);
 expect(selectPublishedCatalog(catalog)).toHaveLength(1);expect(selectFeedEligibleCatalog(catalog)).toEqual([]);
 for(const [schema,data] of [[blogFrontmatterSchema,{...common,category:'software'}],[noteFrontmatterSchema,{...common,subject:'everyday'}],
  [projectFrontmatterSchema,{...common,status:'active'}],[toolFrontmatterSchema,{...common,category:'calculation'}],[pageFrontmatterSchema,page]] as const){
  expect(schema.safeParse({...data,feed:false}).success).toBe(true);
  expect(schema.safeParse({...data,feed:'true'}).success).toBe(false);
 }
 expect(contentDiscoveryRecordSchema.safeParse({...catalog[0]!.discoveryRecord,feed:'true'}).success).toBe(false);
});

it('keeps current unconfigured content on the original Blog-only feed without hiding public notes',async()=>{
 const {catalog:current}=await readSiteContent();
 const catalog=current.filter(e=>e.source.data.feed===undefined);
 const publicRecords=selectWebIndexableCatalog(catalog).map(e=>e.discoveryRecord);
 expect(publicRecords.some(e=>e.collection==='notes')).toBe(true);
 const selected=selectFeedEligibleCatalog(catalog).map(e=>e.discoveryRecord);
 expect(selected).toEqual(publicRecords.filter(e=>e.collection==='blog'));
 expect(renderRssFeed(publicRecords,taxonomyRegistry,site)).toBe(renderRssFeed(publicRecords.filter(e=>e.collection==='blog'),taxonomyRegistry,site));
});

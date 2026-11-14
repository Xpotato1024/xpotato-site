import {describe,expect,it} from 'vitest';
import type {ContentDiscoveryRecord} from '@xpotato/content-contracts';
import {taxonomyRegistry} from '../../content-registry/taxonomy/index.js';
import {phase5TaxonomyRegistryData} from '../../content-registry/taxonomy/phase5-generated.js';
import {blogTags} from '../articles/blog-taxonomy.js';
import {assertBlogTagArchives,generateArchivePages} from './discovery.js';
import {buildTagDirectory} from './tag-directory.js';
const article:ContentDiscoveryRecord={contentId:'all-tags',collection:'blog',route:'/articles/stable/',title:'fixture',description:'fixture',categoryId:'robotics',tagIds:taxonomyRegistry.tags.filter(t=>t.status==='active').map(t=>t.id),featured:false,webIndexable:true,siteSearchEligible:true};
describe('every assigned public Blog tag has a real archive',()=>{
 it('links every active term, including Python, and preserves existing slugs and SEO policy',()=>{
  const pages=generateArchivePages([article],taxonomyRegistry), directory=buildTagDirectory(pages,taxonomyRegistry);
  expect(directory).toHaveLength(article.tagIds.length);
  for(const tag of blogTags(article.tagIds,taxonomyRegistry,true)){
   expect(tag.href).toBe(`/articles/tag/${taxonomyRegistry.tags.find(t=>t.id===tag.id)!.slug}/`);
   expect(directory.find(t=>t.id===tag.id)?.route).toBe(tag.href);
   expect(pages.find(p=>p.route===tag.href)?.itemContentIds).toEqual([article.contentId]);
  }
  for(const frozen of phase5TaxonomyRegistryData.tags){const current=taxonomyRegistry.tags.find(t=>t.id===frozen.id)!;expect(current.slug).toBe(frozen.slug);expect(current.indexable).toBe(frozen.indexable)}
  expect(phase5TaxonomyRegistryData.tags.find(t=>t.id==='python')?.archive).toBe(false);
 });
 it('fails on absent targets or absent article membership instead of silently dropping links',()=>{
  const pages=generateArchivePages([article],taxonomyRegistry);
  expect(()=>assertBlogTagArchives([article],taxonomyRegistry,pages.filter(p=>p.route!=='/articles/tag/python/'))).toThrow('MISSING_BLOG_TAG_ARCHIVE');
  expect(()=>assertBlogTagArchives([article],taxonomyRegistry,pages.map(p=>p.route==='/articles/tag/python/'?{...p,itemContentIds:[]}:p))).toThrow('MISSING_BLOG_TAG_ARCHIVE');
  for(const id of ['unknown','python']){
   const taxonomy={...taxonomyRegistry,tags:taxonomyRegistry.tags.map(t=>t.id===id?{...t,archive:false}:t)};
   expect(()=>generateArchivePages([{...article,tagIds:[id]}],taxonomy)).toThrow();
  }
 });
 it('keeps unpublished/unused terms out of generated archives',()=>{
  for(const records of [[],[{...article,webIndexable:false}]])expect(generateArchivePages(records,taxonomyRegistry).filter(p=>p.scope.kind==='tag')).toEqual([]);
 });
 it('checks membership across pagination, not only page one',()=>{
  const records=Array.from({length:25},(_,i)=>({...article,contentId:`article-${i}`,tagIds:['python']}));
  const pages=generateArchivePages(records,taxonomyRegistry);
  expect(pages.filter(p=>p.scope.kind==='tag')).toHaveLength(3);
  expect(()=>assertBlogTagArchives(records,taxonomyRegistry,pages)).not.toThrow();
 });
});

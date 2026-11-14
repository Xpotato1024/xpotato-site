import { describe, it, expect } from 'vitest';
import { blogFrontmatterSchema, noteFrontmatterSchema, tagRecordSchema, taxonomyRegistrySchema, type ContentDiscoveryRecord } from '@xpotato/content-contracts';
import { taxonomyRegistry } from "../../content-registry/taxonomy/index.js";
import { categoryLineage, blogBreadcrumbs, blogTags } from './blog-taxonomy.js';
import { generateArchivePages } from "../discovery/discovery.js";
import { deriveBreadcrumbList } from "../discovery/seo.js";
import {phase5TaxonomyRegistryData} from "../../content-registry/taxonomy/phase5-generated.js";
import {withEditorialTaxonomy} from "../../content-registry/taxonomy/editorial.js";

const child = (id:string,parentId:string) => ({...taxonomyRegistry.blogCategories[0]!,id,slug:id,label:id,parentId});
const tree = () => taxonomyRegistrySchema.parse({...taxonomyRegistry,blogCategories:[...taxonomyRegistry.blogCategories,child('fixture-electronics','robotics'),child('boards','fixture-electronics')]});
describe('single primary tree and independent cross-cutting tags',()=>{
  it('rejects unknown/retired parents, cycles and depth greater than three',()=>{
    for(const categories of [
      [child('x','missing')], [child('x','x')], [child('x','y'),child('y','x')],
      [{...child('x','y')},{...child('y','software'),status:'retired'}],
      [...tree().blogCategories,child('too-deep','boards')],
    ]) expect(()=>taxonomyRegistrySchema.parse({...taxonomyRegistry,blogCategories:categories})).toThrow();
  });
  it('uses one ancestry for visible breadcrumbs and JSON-LD, preserving category-independent article URL',()=>{
    const taxonomy=tree(), canonical='https://xpotato.net/articles/a-stable-slug/';
    expect(categoryLineage('boards',taxonomy).map(t=>t.id)).toEqual(['robotics','fixture-electronics','boards']);
    const crumbs=blogBreadcrumbs({categoryId:'boards',title:'日本語の記事',canonical,origin:'https://xpotato.net/',taxonomy});
    expect(crumbs.map(c=>c.name)).toEqual(['記事','ロボティクス','fixture-electronics','boards','日本語の記事']);
    expect(deriveBreadcrumbList(crumbs)?.itemListElement.map(c=>c.item)).toEqual(crumbs.map(c=>c.url));
    expect(crumbs.at(-1)?.url).toBe(canonical);
  });
  it('aggregates descendants into each ancestor once and excludes nonindexable records',()=>{
    const record:ContentDiscoveryRecord={contentId:'article',collection:'blog',route:'/articles/stable/',title:'記事',description:'説明',categoryId:'boards',tagIds:[],featured:false,webIndexable:true,siteSearchEligible:true};
    const pages=generateArchivePages([record,{...record,contentId:'held',webIndexable:false}],tree());
    for(const id of ['robotics','fixture-electronics','boards'])expect(pages.find(p=>p.scope.kind==='category'&&p.scope.id===id)?.itemContentIds).toEqual(['article']);
  });
  it('rejects non-linkable public tags but keeps preview tags unlinked',()=>{
    const taxonomy={...taxonomyRegistry,tags:[{...taxonomyRegistry.tags[0]!,id:'meta',slug:'meta',archive:false}]};
    expect(()=>blogTags(['meta'],taxonomy,true)).toThrow('BLOG_TAG_ARCHIVE_DISABLED');
    expect(blogTags(['meta','meta'],taxonomy,false)).toEqual([{id:'meta',label:taxonomy.tags[0]!.label,kind:taxonomy.tags[0]!.kind,href:undefined}]);
    expect(blogTags([taxonomyRegistry.tags[0]!.id],taxonomyRegistry,false)[0]?.href).toBeUndefined();
    expect(()=>blogTags(['unknown'],taxonomyRegistry,true)).toThrow('UNKNOWN_BLOG_TAG');
  });
  it('keeps the frozen migration records while keeping broad categories and flat technology tags and reusing the existing purpose tag ID',()=>{
    for(const category of phase5TaxonomyRegistryData.blogCategories)expect(taxonomyRegistry.blogCategories.find(c=>c.id===category.id)).toEqual(category);
    expect(categoryLineage('making',taxonomyRegistry).map(c=>c.label)).toEqual(['工作']);
    expect(taxonomyRegistry.blogCategories.filter(c=>c.status==='active').every(c=>!c.parentId)).toBe(true);
    expect(categoryLineage('3d-printing',taxonomyRegistry).map(c=>c.label)).toEqual(['3Dプリンタ']);
    expect(blogTags(['3d-printing'],taxonomyRegistry,true)[0]).toMatchObject({label:'3Dプリンタ',kind:'technology',href:'/articles/tag/3d-printing/'});
    expect(taxonomyRegistry.tags.filter(t=>t.id==='troubleshooting')).toHaveLength(1);
    const tags=blogTags(['fdm','design','troubleshooting'],taxonomyRegistry,true);
    expect(tags.map(t=>t.kind)).toEqual(['technology','purpose','purpose']);
    expect(tags.map(t=>t.href)).toEqual(['/articles/tag/fdm/','/articles/tag/design/','/articles/tag/troubleshooting/']);
    const old={...phase5TaxonomyRegistryData,tags:phase5TaxonomyRegistryData.tags.filter(t=>t.id!=='troubleshooting')};
    expect(()=>withEditorialTaxonomy(old)).toThrow('EDITORIAL_TAXONOMY_BASE_DRIFT');
  });
  it('classifies robot simulation with explicitly requested technologies',()=>{
    const tags=blogTags(['python','mujoco','simulation'],taxonomyRegistry,true);
    expect(tags.map(t=>t.label)).toEqual(['Python','MuJoCo','シミュレーション']);
    expect(tags.map(t=>t.kind)).toEqual(['technology','technology','technology']);
    expect(tags.map(t=>t.href)).toEqual(['/articles/tag/python/','/articles/tag/mujoco/','/articles/tag/simulation/']);
    expect(categoryLineage('robotics',taxonomyRegistry).at(-1)?.label).toBe('ロボティクス');
    expect(blogTags(['release'],taxonomyRegistry,true)[0]?.kind).toBe('topic');
    expect(blogTags(['explanation'],taxonomyRegistry,true)[0]).toMatchObject({label:'解説',kind:'purpose',href:'/articles/tag/explanation/'});
    for(const id of ['mujoco','simulation'])expect(taxonomyRegistry.tags.filter(t=>t.id===id)).toHaveLength(1);
  });
  it('does not create taxonomy archives until a discoverable matching article exists',()=>{
    const record:ContentDiscoveryRecord={contentId:'simulation-article',collection:'blog',route:'/articles/stable-simulation/',title:'記事',description:'説明',categoryId:'robotics',tagIds:['python','mujoco','simulation'],featured:false,webIndexable:true,siteSearchEligible:true};
    const pages=generateArchivePages([record],taxonomyRegistry);
    for(const id of ['mujoco','simulation']){
      expect(pages.find(p=>p.scope.kind==='tag'&&p.scope.id===id)?.itemContentIds).toEqual(['simulation-article']);
      expect(generateArchivePages([],taxonomyRegistry).some(p=>p.scope.kind==='tag'&&p.scope.id===id)).toBe(false);
      expect(generateArchivePages([{...record,webIndexable:false}],taxonomyRegistry).some(p=>p.scope.kind==='tag'&&p.scope.id===id)).toBe(false);
    }
  });
  it('creates no category or purpose archive before a discoverable article exists',()=>{
    const empty=generateArchivePages([],taxonomyRegistry);
    expect(empty.some(p=>p.scope.kind==='category'&&['making','3d-printing'].includes(p.scope.id))).toBe(false);
    expect(empty.some(p=>p.scope.kind==='tag'&&['fdm','design','troubleshooting'].includes(p.scope.id))).toBe(false);
  });
});


describe('flat technology granularity and multiple article purposes',()=>{
 it('accepts broad and specific tags together without category-to-tag assignments',()=>{
  const ids=['3d-printing','fdm','analysis','fea','control','modern-control','explanation','engineering','troubleshooting'];
  const tags=blogTags(ids,taxonomyRegistry,true);
  expect(tags.filter(t=>t.kind==='technology')).toHaveLength(6);
  expect(tags.filter(t=>t.kind==='purpose').map(t=>t.label)).toEqual(['解説','エンジニアリング','トラブルシューティング']);
  for(const category of ['robotics','electronics','metalworking','making','software']){
   expect(blogFrontmatterSchema.parse({id:'11111111-1111-4111-8111-111111111111',title:'fixture',description:'fixture',pubDate:'2026-11-14',draft:true,category,tags:ids}).tags).toEqual(ids);
   expect(categoryLineage(category,taxonomyRegistry)).toHaveLength(1);
  }
 });
 it('does not confuse display pagination with a tag-assignment cap',()=>{
  const ids=taxonomyRegistry.tags.filter(t=>t.status==='active').map(t=>t.id);
  expect(ids.length).toBeGreaterThan(64);
  expect(blogTags(ids,taxonomyRegistry,true)).toHaveLength(ids.length);
  expect(blogFrontmatterSchema.parse({id:'11111111-1111-4111-8111-111111111111',title:'fixture',description:'fixture',pubDate:'2026-11-14',draft:true,category:'robotics',tags:ids}).tags).toEqual(ids);
 });
 it('keeps tags flat, reuses stable IDs and gives different dimensions distinct labels',()=>{
  const analysis=taxonomyRegistry.tags.find(t=>t.id==='analysis')!;
  expect(analysis).toMatchObject({kind:'technology',label:'解析'});
  expect(analysis.aliases).toContain('Analysis');
  for(const id of ['analysis','python','rust','go'])expect(taxonomyRegistry.tags.filter(t=>t.id===id)).toHaveLength(1);
  expect(()=>tagRecordSchema.parse({...analysis,parentId:'fea'})).toThrow();
  expect(blogTags(['software-development'],taxonomyRegistry,true)[0]?.label).toBe('ソフトウェア開発');
  expect(blogTags(['promotion'],taxonomyRegistry,true)[0]).toMatchObject({label:'PR',kind:'purpose'});
  const empty=generateArchivePages([],taxonomyRegistry);
  expect(empty.some(p=>p.scope.kind==='category'||p.scope.kind==='tag')).toBe(false);
 });
});


it('expresses product reviews and quick observations with the existing schemas',()=>{
 const shared={id:'11111111-1111-4111-8111-111111111111',title:'fixture',description:'fixture',pubDate:'2026-11-14',draft:true};
 const ids=['power-bank','semi-solid-state-battery','review','explanation'];
 expect(blogFrontmatterSchema.parse({...shared,category:'gadgets',tags:ids}).tags).toEqual(ids);
 expect(noteFrontmatterSchema.parse({...shared,subject:'everyday',tags:['power-bank']}).tags).toEqual(['power-bank']);
 expect(blogFrontmatterSchema.parse({...shared,category:'gadgets',tags:[]}).tags).toEqual([]);
 expect(blogTags(ids,taxonomyRegistry,true).map(t=>t.kind)).toEqual(['technology','technology','purpose','purpose']);
 expect(categoryLineage('gadgets',taxonomyRegistry).map(c=>c.label)).toEqual(['ガジェット']);
});

import { describe, it, expect } from 'vitest';
import { taxonomyRegistrySchema, type ContentDiscoveryRecord } from '@xpotato/content-contracts';
import { taxonomyRegistry } from '../content-registry/taxonomy/index.js';
import { categoryLineage, blogBreadcrumbs, blogTags } from './blog-taxonomy.js';
import { generateArchivePages } from './discovery.js';
import { deriveBreadcrumbList } from './seo.js';
import {phase5TaxonomyRegistryData} from '../content-registry/taxonomy/phase5-generated.js';
import {withEditorialTaxonomy} from '../content-registry/taxonomy/editorial.js';

const child = (id:string,parentId:string) => ({...taxonomyRegistry.blogCategories[0]!,id,slug:id,label:id,parentId});
const tree = () => taxonomyRegistrySchema.parse({...taxonomyRegistry,blogCategories:[...taxonomyRegistry.blogCategories,child('electronics','robotics'),child('boards','electronics')]});
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
    expect(categoryLineage('boards',taxonomy).map(t=>t.id)).toEqual(['robotics','electronics','boards']);
    const crumbs=blogBreadcrumbs({categoryId:'boards',title:'日本語の記事',canonical,origin:'https://xpotato.net/',taxonomy});
    expect(crumbs.map(c=>c.name)).toEqual(['Articles','ロボティクス','electronics','boards','日本語の記事']);
    expect(deriveBreadcrumbList(crumbs)?.itemListElement.map(c=>c.item)).toEqual(crumbs.map(c=>c.url));
    expect(crumbs.at(-1)?.url).toBe(canonical);
  });
  it('aggregates descendants into each ancestor once and excludes nonindexable records',()=>{
    const record:ContentDiscoveryRecord={contentId:'article',collection:'blog',route:'/articles/stable/',title:'記事',description:'説明',categoryId:'boards',tagIds:[],featured:false,webIndexable:true,siteSearchEligible:true};
    const pages=generateArchivePages([record,{...record,contentId:'held',webIndexable:false}],tree());
    for(const id of ['robotics','electronics','boards'])expect(pages.find(p=>p.scope.kind==='category'&&p.scope.id===id)?.itemContentIds).toEqual(['article']);
  });
  it('never links metadata-only or preview tags and rejects unknown terms',()=>{
    const taxonomy={...taxonomyRegistry,tags:[{...taxonomyRegistry.tags[0]!,id:'meta',slug:'meta',archive:false}]};
    expect(blogTags(['meta','meta'],taxonomy,true)).toEqual([{id:'meta',label:taxonomy.tags[0]!.label,kind:taxonomy.tags[0]!.kind,href:undefined}]);
    expect(blogTags([taxonomyRegistry.tags[0]!.id],taxonomyRegistry,false)[0]?.href).toBeUndefined();
    expect(()=>blogTags(['unknown'],taxonomyRegistry,true)).toThrow('UNKNOWN_BLOG_TAG');
  });
  it('keeps the frozen migration records while adding the selected hierarchy and reusing the existing purpose tag ID',()=>{
    for(const category of phase5TaxonomyRegistryData.blogCategories)expect(taxonomyRegistry.blogCategories.find(c=>c.id===category.id)).toEqual(category);
    expect(categoryLineage('3d-printing',taxonomyRegistry).map(c=>c.label)).toEqual(['工作','3Dプリンタ']);
    expect(taxonomyRegistry.tags.filter(t=>t.id==='troubleshooting')).toHaveLength(1);
    const tags=blogTags(['fdm','design','troubleshooting'],taxonomyRegistry,true);
    expect(tags.map(t=>t.kind)).toEqual(['technology','purpose','purpose']);
    expect(tags.map(t=>t.href)).toEqual(['/articles/tag/fdm/','/articles/tag/design/','/articles/tag/troubleshooting/']);
    const old={...phase5TaxonomyRegistryData,tags:phase5TaxonomyRegistryData.tags.filter(t=>t.id!=='troubleshooting')};
    expect(()=>withEditorialTaxonomy(old)).toThrow('EDITORIAL_TAXONOMY_BASE_DRIFT');
  });
  it('creates no category or purpose archive before a discoverable article exists',()=>{
    const empty=generateArchivePages([],taxonomyRegistry);
    expect(empty.some(p=>p.scope.kind==='category'&&['making','3d-printing'].includes(p.scope.id))).toBe(false);
    expect(empty.some(p=>p.scope.kind==='tag'&&['fdm','design','troubleshooting'].includes(p.scope.id))).toBe(false);
  });
});

import {taxonomyRegistrySchema,type TaxonomyRegistry} from '@xpotato/content-contracts';

/** Owner-selected additions (2026-10-30). The frozen Phase 5 source and
 * content assignments remain reproducible; this facade owns later editing.
 */
export function withEditorialTaxonomy(input:unknown):TaxonomyRegistry {
 const base=taxonomyRegistrySchema.parse(input);
 const troubleshooting=base.tags.find(t=>t.id==='troubleshooting');
 if(!troubleshooting||troubleshooting.kind!=='topic'||troubleshooting.slug!=='troubleshooting')throw Error('EDITORIAL_TAXONOMY_BASE_DRIFT');
 return taxonomyRegistrySchema.parse({...base,
  blogCategories:[...base.blogCategories,
   {id:'making',label:'工作',description:'ものづくりの設計と製作',slug:'making',indexable:true,aliases:[],status:'active',sortOrder:40},
   {id:'3d-printing',label:'3Dプリンタ',description:'3Dプリンタによる造形と設計・設定',slug:'3d-printing',parentId:'making',indexable:true,aliases:[],status:'active',sortOrder:10}],
  tags:[...base.tags.map(t=>t.id==='troubleshooting'?{...t,kind:'purpose' as const,label:'トラブルシューティング',aliases:[...new Set([...t.aliases,'Troubleshooting'])]}:t),
   {id:'fdm',label:'FDM/FFF',slug:'fdm',kind:'technology',description:'樹脂を溶かして積層する造形方式',aliases:['fff'],archive:true,indexable:true,status:'active'},
   {id:'design',label:'設計',slug:'design',kind:'purpose',description:'形状・構造・設定の選択を考える記事',aliases:[],archive:true,indexable:true,status:'active'}],
 });
}

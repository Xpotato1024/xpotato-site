import {taxonomyRegistrySchema,type TaxonomyRegistry} from '@xpotato/content-contracts';

/** Editorial additions (2026-10-30 onward). The frozen Phase 5 source and
 * content assignments remain reproducible; this facade owns later editing.
 */
export function withEditorialTaxonomy(input:unknown):TaxonomyRegistry {
 const base=taxonomyRegistrySchema.parse(input);
 const troubleshooting=base.tags.find(t=>t.id==='troubleshooting');
 if(!troubleshooting||troubleshooting.kind!=='topic'||troubleshooting.slug!=='troubleshooting')throw Error('EDITORIAL_TAXONOMY_BASE_DRIFT');
 return taxonomyRegistrySchema.parse({...base,
  noteSubjects:[...base.noteSubjects,
   {id:'everyday',label:'日々のこと',description:'日常の出来事や、ふと思いついたこと。',slug:'everyday',indexable:true,aliases:[],status:'active',archive:true}],
  blogCategories:[...base.blogCategories,
   {id:'making',label:'工作',description:'ものづくりの設計と製作',slug:'making',indexable:true,aliases:[],status:'active',sortOrder:40},
   // Compatibility category for the reviewed article; new articles use making + technology tag.
   {id:'3d-printing',label:'3Dプリンタ',description:'3Dプリンタによる造形と設計・設定',slug:'3d-printing',indexable:true,aliases:[],status:'active',sortOrder:10}],
  tags:[...base.tags.map(t=>t.id==='troubleshooting'?{...t,kind:'purpose' as const,label:'トラブルシューティング',aliases:[...new Set([...t.aliases,'Troubleshooting'])]}:t),
   {id:'3d-printing',label:'3Dプリンタ',slug:'3d-printing',kind:'technology',description:'3Dプリンタによる造形と設計・設定',aliases:['3D printing','3Dプリンター'],archive:true,indexable:true,status:'active'},
   {id:'fdm',label:'FDM/FFF',slug:'fdm',kind:'technology',description:'樹脂を溶かして積層する造形方式',aliases:['fff'],archive:true,indexable:true,status:'active'},
   {id:'mujoco',label:'MuJoCo',slug:'mujoco',kind:'technology',description:'ロボットの運動と接触を扱う物理シミュレータ',aliases:[],archive:true,indexable:true,status:'active'},
   {id:'simulation',label:'シミュレーション',slug:'simulation',kind:'technology',description:'モデルを用いた動作・物理現象の再現と検証',aliases:[],archive:true,indexable:true,status:'active'},
   {id:'explanation',label:'解説',slug:'explanation',kind:'purpose',description:'技術の仕組みや変更点を理解するための記事',aliases:[],archive:true,indexable:true,status:'active'},
   {id:'design',label:'設計',slug:'design',kind:'purpose',description:'形状・構造・設定の選択を考える記事',aliases:[],archive:true,indexable:true,status:'active'}],
 });
}

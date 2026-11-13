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
   {id:'electronics',label:'電子工作',description:'電子回路や電子機器の製作',slug:'electronics',indexable:true,aliases:[],status:'active',sortOrder:20},
   {id:'metalworking',label:'金属加工',description:'金属部品の加工と製作',slug:'metalworking',indexable:true,aliases:[],status:'active',sortOrder:30},
   {id:'making',label:'工作',description:'ものづくりの設計と製作',slug:'making',indexable:true,aliases:[],status:'active',sortOrder:40},
   // Compatibility category for the reviewed article; new articles use making + technology tag.
   {id:'3d-printing',label:'3Dプリンタ',description:'3Dプリンタによる造形と設計・設定',slug:'3d-printing',indexable:true,aliases:[],status:'active',sortOrder:10}],
  tags:[...base.tags.map(t=>t.id==='troubleshooting'?{...t,kind:'purpose' as const,label:'トラブルシューティング',aliases:[...new Set([...t.aliases,'Troubleshooting'])]}:t.id==='analysis'?{...t,kind:'technology' as const,label:'解析',description:'モデルや計算による対象の解析',aliases:[...new Set([...t.aliases,'Analysis'])]}:t),
   {id:'3d-printing',label:'3Dプリンタ',slug:'3d-printing',kind:'technology',description:'3Dプリンタによる造形と設計・設定',aliases:['3D printing','3Dプリンター'],archive:true,indexable:true,status:'active'},
   {id:'fdm',label:'FDM/FFF',slug:'fdm',kind:'technology',description:'樹脂を溶かして積層する造形方式',aliases:['fff'],archive:true,indexable:true,status:'active'},
   {id:'mujoco',label:'MuJoCo',slug:'mujoco',kind:'technology',description:'ロボットの運動と接触を扱う物理シミュレータ',aliases:[],archive:true,indexable:true,status:'active'},
   {id:'simulation',label:'シミュレーション',slug:'simulation',kind:'technology',description:'モデルを用いた動作・物理現象の再現と検証',aliases:[],archive:true,indexable:true,status:'active'},
   {id:'control',label:'制御',slug:'control',kind:'technology',description:'制御の考え方や方式',aliases:[],archive:true,indexable:true,status:'active'},
   {id:'modern-control',label:'現代制御',slug:'modern-control',kind:'technology',description:'現代制御を扱う手法',aliases:[],archive:true,indexable:true,status:'active'},
   {id:'embedded',label:'組み込み',slug:'embedded',kind:'technology',description:'機器に組み込むソフトウェアやシステム',aliases:[],archive:true,indexable:true,status:'active'},
   {id:'software-development',label:'ソフトウェア開発',slug:'software-development',kind:'technology',description:'ソフトウェアの設計と実装',aliases:[],archive:true,indexable:true,status:'active'},
   {id:'fea',label:'FEA',slug:'fea',kind:'technology',description:'有限要素解析',aliases:[],archive:true,indexable:true,status:'active'},
   {id:'soldering',label:'半田付け',slug:'soldering',kind:'technology',description:'半田付けの作業と手法',aliases:[],archive:true,indexable:true,status:'active'},
   {id:'reflow',label:'リフロー',slug:'reflow',kind:'technology',description:'リフロー工程',aliases:[],archive:true,indexable:true,status:'active'},
   {id:'circuit-design',label:'回路設計',slug:'circuit-design',kind:'technology',description:'電子回路の設計',aliases:[],archive:true,indexable:true,status:'active'},
   {id:'transistor',label:'トランジスタ',slug:'transistor',kind:'technology',description:'トランジスタを使う回路や部品',aliases:[],archive:true,indexable:true,status:'active'},
   {id:'microcontroller',label:'マイコン',slug:'microcontroller',kind:'technology',description:'マイクロコントローラを使う機器',aliases:[],archive:true,indexable:true,status:'active'},
   {id:'milling-machine',label:'フライス盤',slug:'milling-machine',kind:'technology',description:'フライス盤による加工',aliases:[],archive:true,indexable:true,status:'active'},
   {id:'lathe',label:'旋盤',slug:'lathe',kind:'technology',description:'旋盤による加工',aliases:[],archive:true,indexable:true,status:'active'},
   {id:'drill-press',label:'ボール盤',slug:'drill-press',kind:'technology',description:'ボール盤による加工',aliases:[],archive:true,indexable:true,status:'active'},
   {id:'cnc',label:'CNC',slug:'cnc',kind:'technology',description:'数値制御を使う加工',aliases:[],archive:true,indexable:true,status:'active'},
   {id:'vat-photopolymerization',label:'光造形',slug:'vat-photopolymerization',kind:'technology',description:'光造形による立体の製作',aliases:[],archive:true,indexable:true,status:'active'},
   {id:'laser-processing',label:'レーザー加工',slug:'laser-processing',kind:'technology',description:'レーザーを使う加工',aliases:[],archive:true,indexable:true,status:'active'},
   {id:'wasm',label:'WASM',slug:'wasm',kind:'technology',description:'WebAssemblyを使う実装',aliases:[],archive:true,indexable:true,status:'active'},
   {id:'explanation',label:'解説',slug:'explanation',kind:'purpose',description:'技術の仕組みや変更点を理解するための記事',aliases:[],archive:true,indexable:true,status:'active'},
   {id:'promotion',label:'PR',slug:'promotion',kind:'purpose',description:'製品やサービス等の紹介・告知を主目的とする記事',aliases:[],archive:true,indexable:true,status:'active'},
   {id:'engineering',label:'エンジニアリング',slug:'engineering',kind:'purpose',description:'要件や制約に基づく設計・実装・検証を扱う記事',aliases:[],archive:true,indexable:true,status:'active'},
   {id:'design',label:'設計',slug:'design',kind:'purpose',description:'形状・構造・設定の選択を考える記事',aliases:[],archive:true,indexable:true,status:'active'}],
 });
}

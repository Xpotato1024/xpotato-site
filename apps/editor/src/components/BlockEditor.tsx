import {useMemo,useState} from 'react';
import {sourceBlocks,replaceBlock,moveBlock,insertBlock,blockTemplates,moduleSource,type SourceBlock} from '@xpotato/editor-core/blocks';
interface Props {body:string;onChange:(value:string)=>void;onError:(message:string)=>void}
const labels:Record<string,string>={paragraph:'段落',heading:'見出し',list:'リスト',table:'表',code:'コード・数式',blockquote:'引用',thematicBreak:'区切り',definition:'リンク参照',mdxJsxFlowElement:'共通部品'};
function ModuleFields({block,onApply,onError}:{block:SourceBlock;onApply:(source:string)=>void;onError:(text:string)=>void}){
 const attributes=useMemo(()=>{const props:Record<string,string>={};for(const match of block.source.matchAll(/([A-Za-z][A-Za-z0-9]*)=(?:"([^"]*)"|'([^']*)')/gu))props[match[1]!]=(match[2]??match[3]??'').replaceAll('&quot;','"').replaceAll('&amp;','&');return props;},[block.source]);
 const [values,setValues]=useState(attributes);
 const apply=()=>{try{const name=block.name!,close='</'+name+'>',end=block.source.lastIndexOf(close);const body=end>=0?block.source.slice(block.source.indexOf('>')+1,end).trim():undefined;onApply(moduleSource(name,values,body));}catch(error){onError(error instanceof Error?error.message:'部品の入力を確認してください');}};
 return <div className="module-fields">{Object.entries(values).map(([name,value])=><label key={name}><span>{({asset:'画像ID',alt:'代替テキスト',title:'タイトル',caption:'キャプション',kind:'種類',summary:'開閉ラベル',module:'ツールID',unit:'単位',max:'最大値',rows:'系列データ（JSON）'} as Record<string,string>)[name]??name}</span>{name==='rows'?<textarea value={value} rows={4} onChange={event=>setValues({...values,[name]:event.target.value})}/>:<input value={value} onChange={event=>setValues({...values,[name]:event.target.value})}/>}</label>)}<button type="button" onClick={apply}>部品の入力を適用</button></div>;
}
export function BlockEditor({body,onChange,onError}:Props){
 const [insert,setInsert]=useState<keyof typeof blockTemplates>('paragraph');
 const parsed=useMemo(()=>{try{return {blocks:sourceBlocks(body),error:''}}catch{return {blocks:[] as SourceBlock[],error:'構文が未完成です。MDXソースで続きを編集できます。本文はそのまま保持されています。'}}},[body]);
 const act=(fn:()=>string)=>{try{onChange(fn());onError('');}catch(error){onError(error instanceof Error?error.message:'編集を適用できませんでした');}};
 return <section className="block-editor" aria-label="ブロック編集">
  <div className="insert-bar"><label>ブロックを追加<select value={insert} onChange={event=>setInsert(event.target.value as keyof typeof blockTemplates)}>{Object.keys(blockTemplates).map(key=><option key={key} value={key}>{({paragraph:'段落',heading:'見出し',list:'箇条書き',table:'表',code:'コード',math:'数式',Figure:'画像・図',Gallery:'画像の比較',Steps:'手順',Callout:'補足・注意',BarChart:'棒グラフ',Details:'折りたたみ',ArticleEndnote:'エンドノート',Demo:'ブラウザツール'} as Record<string,string>)[key]}</option>)}</select></label><button type="button" className="primary" onClick={()=>act(()=>insertBlock(body,insert))}>追加</button></div>
  {parsed.error&&<p className="notice">{parsed.error}</p>}
  {!body.trim()&&<div className="empty-editor"><h2>まずは、ひとことから。</h2><p>段落を追加するか、MDXソースに直接書き始めてください。</p></div>}
  {parsed.blocks.map((block,index)=><article className="editor-block" key={index+'-'+block.type}><div className="block-heading"><strong>{block.name??labels[block.type]??block.type}</strong><div className="block-actions"><button type="button" aria-label="前へ移動" disabled={index===0} onClick={()=>act(()=>moveBlock(body,index,-1))}>↑</button><button type="button" aria-label="後ろへ移動" disabled={index===parsed.blocks.length-1} onClick={()=>act(()=>moveBlock(body,index,1))}>↓</button><button type="button" onClick={()=>act(()=>replaceBlock(body,index,''))}>削除</button></div></div>
   {block.type==='heading'?<input className="heading-input" aria-label="見出し" value={block.source} onChange={event=>act(()=>replaceBlock(body,index,event.target.value))}/>:<textarea className={block.type==='mdxJsxFlowElement'?'block-source':'block-text'} aria-label={(block.name??labels[block.type]??'本文')+'を編集'} rows={Math.min(16,Math.max(3,block.source.split('\n').length+1))} value={block.source} onChange={event=>{const result=body.slice(0,block.start)+event.target.value+body.slice(block.end);onChange(result)}}/>}
   {block.name&&<details><summary>部品の項目を編集</summary><ModuleFields key={block.source} block={block} onError={onError} onApply={source=>act(()=>replaceBlock(body,index,source))}/></details>}
  </article>)}
 </section>;
}

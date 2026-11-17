import {unified} from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import remarkGfm from 'remark-gfm';
import {semanticContentModulePropsSchemas} from '@xpotato/content-contracts/content';
import {validatePortableMdx} from '@xpotato/portable-content';
const processor=unified().use(remarkParse).use(remarkMdx).use(remarkGfm);
export interface SourceBlock {index:number; type:string; name?:string; start:number; end:number; source:string}
export function sourceBlocks(body:string):SourceBlock[]{
 const tree=processor.parse(body);
 return tree.children.map((node,index)=>({index,type:node.type,...('name' in node&&typeof node.name==='string'?{name:node.name}:{}),start:node.position!.start.offset!,end:node.position!.end.offset!,source:body.slice(node.position!.start.offset!,node.position!.end.offset!)}));
}
export function replaceBlock(body:string,index:number,replacement:string):string {
 const block=sourceBlocks(body)[index];if(!block)throw Error('BLOCK_NOT_FOUND');
 const result=body.slice(0,block.start)+replacement+body.slice(block.end);
 const issues=validatePortableMdx(result);if(issues.length)throw Error(issues.join('; '));return result;
}
export function moveBlock(body:string,index:number,direction:-1|1):string {
 const blocks=sourceBlocks(body),other=index+direction;
 if(index<0||other<0||index>=blocks.length||other>=blocks.length)return body;
 const left=blocks[Math.min(index,other)]!,right=blocks[Math.max(index,other)]!;
 const result=body.slice(0,left.start)+right.source+body.slice(left.end,right.start)+left.source+body.slice(right.end);
 const issues=validatePortableMdx(result);if(issues.length)throw Error(issues.join('; '));return result;
}
export function removeBlock(body:string,index:number):string {return replaceBlock(body,index,'');}
export const moduleNames=Object.freeze(Object.keys(semanticContentModulePropsSchemas));
const attrEscape=(s:string)=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
export function moduleSource(name:string,props:Record<string,unknown>,children?:string):string {
 const schema=semanticContentModulePropsSchemas[name as keyof typeof semanticContentModulePropsSchemas];if(!schema)throw Error('MODULE_UNKNOWN');
 const data=schema.parse(props) as Record<string,unknown>;
 const attributes=Object.entries(data).filter(([,v])=>v!==undefined&&v!==false).map(([k,v])=>v===true?k:k+'="'+attrEscape(String(v))+'"').join(' ');
 const start='<'+name+(attributes?' '+attributes:'');
 const text=children===undefined?start+' />':start+'>\n\n'+children+'\n\n</'+name+'>';
 const issues=validatePortableMdx(text);if(issues.length)throw Error(issues.join('; '));return text;
}
export const blockTemplates=Object.freeze({
 paragraph:'本文を入力してください。',heading:'## 見出し',list:'- 項目1\n- 項目2',
 table:'| 項目 | 値 |\n| --- | --- |\n| サンプル | 0 |',code:'```text\nコードを入力\n```',math:'```math label="式の説明"\nE = mc^2\n```',
 Figure:'<Figure asset="figure-1" alt="図の内容" />',
 Gallery:'<Gallery>\n  <Figure asset="figure-1" alt="図1" />\n  <Figure asset="figure-2" alt="図2" />\n</Gallery>',
 Steps:'<Steps>\n  <Step title="最初の手順">\n\n操作を記述します。\n\n  </Step>\n</Steps>',
 Callout:'<Callout kind="note" title="補足">\n\n補足内容。\n\n</Callout>',
 BarChart:"<BarChart title=\"比較\" unit=\"件\" max=\"10\" rows='[{\"label\":\"条件A\",\"value\":5}]' />",
 Details:'<Details summary="詳細">\n\n説明。\n\n</Details>',
 ArticleEndnote:'<ArticleEndnote>\n\n検証条件と出典について。\n\n</ArticleEndnote>',
 Demo:'<Demo module="prime-factorizer" title="試してみる" />'
});
export function insertBlock(body:string,kind:keyof typeof blockTemplates):string {return body.replace(/\s*$/u,'')+'\n\n'+blockTemplates[kind]+'\n';}

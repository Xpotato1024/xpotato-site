import {parseFragment,serialize,type DefaultTreeAdapterMap} from 'parse5';
type Node=DefaultTreeAdapterMap['node'];
const hasMedia=(node:Node):boolean=>('tagName' in node && ['img','picture','svg','video','audio','iframe','canvas','math'].includes(node.tagName)) || ('childNodes' in node && node.childNodes.some(hasMedia));
/** Extract only the first plain introductory paragraphs, preserving DOM order and content. */
export function splitArticleLead(html:string,limit=2):{lead:string;body:string}{
 const tree=parseFragment(html); let count=0,end=0;
 for(let i=0;i<tree.childNodes.length && count<limit;i++){
  const node=tree.childNodes[i]!;
  if(node.nodeName==='#comment'||(node.nodeName==='#text'&&'value' in node&&!node.value.trim()))continue;
  if(!('tagName' in node)||node.tagName!=='p'||hasMedia(node))break;
  count++;end=i+1;
 }
 if(!count)return {lead:'',body:html};
 const lead=parseFragment('');lead.childNodes=tree.childNodes.splice(0,end);
 for(const node of lead.childNodes)node.parentNode=lead;
 return {lead:serialize(lead),body:serialize(tree)};
}

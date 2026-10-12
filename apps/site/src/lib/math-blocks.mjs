import katex from 'katex';
import { fromHtml } from 'hast-util-from-html';

const mathTags=new Set(['span','math','semantics','annotation','mrow','mi','mn','mo','mtext','mfrac','msqrt','mroot','msub','msup','msubsup','munder','mover','munderover','mtable','mtr','mtd','mspace','mpadded','mstyle','menclose','mmultiscripts','mprescripts','none']);
export function renderSafeMath(source,label){
  if(typeof source!=='string'||source.length>4096||!source.trim())throw Error('Math source must contain 1–4096 characters');
  if(typeof label!=='string'||!label.trim()||label.length>160)throw Error('Math block requires a concise Japanese label');
  if(/\\(?:href|url|includegraphics|html\w*|class|style|color|textcolor|definecolor|require|def|gdef|newcommand)\b/u.test(source))throw Error('Math link, styling, external reference and macro definitions are not supported');
  const html=katex.renderToString(source,{output:'mathml',displayMode:true,throwOnError:true,strict:'error',trust:false,maxExpand:100,maxSize:8});
  const tree=fromHtml(html,{fragment:true});
  const inspect=node=>{
    if(node.type==='element'){
      if(!mathTags.has(node.tagName))throw Error('Unexpected generated math element: '+node.tagName);
      for(const [name,value] of Object.entries(node.properties??{}))if(/^on/iu.test(name)||['style','href','src','xLinkHref'].includes(name)||/^(?:https?:)?\/\//u.test(String(value))&&name!=='xmlns')throw Error('Unsafe generated math attribute: '+name);
      if(node.tagName==='annotation')node.properties['data-search-exclude']='true';
    }else if(!['root','text'].includes(node.type))throw Error('Unexpected generated math node');
    for(const child of node.children??[])inspect(child);
  };
  inspect(tree);return tree.children;
}

/** A fenced semantic syntax; arbitrary article HTML/JSX remains forbidden. */
export function remarkMathBlocks(){
  return tree=>{
    const toMdx=node=>node.type==='text' ? {type:'text',value:node.value} : {
      type:'mdxJsxTextElement',name:node.tagName,
      attributes:Object.entries(node.properties??{}).map(([name,value])=>({type:'mdxJsxAttribute',name,value:Array.isArray(value)?value.join(' '):String(value)})),
      children:(node.children??[]).map(toMdx),
    };
    const visit=node=>{
      if(node.type==='code'&&node.lang==='math'){
        const match=/^label="([^"\r\n]+)"(?: print="(source)")?$/u.exec(node.meta??'');
        if(!match)throw Error('Use a math fence with label="式の説明"');
        const label=match[1], source=node.value, math=renderSafeMath(source,label);
        const sourcePrint=match[2]==='source'||source.length>160;
        const generated=toMdx({type:'element',tagName:'div',properties:{className:['math-block',...(sourcePrint?['math-source-print']:[])],role:'group','aria-label':label,tabIndex:0},children:[{type:'element',tagName:'p',properties:{className:['math-label']},children:[{type:'text',value:label}]},...math,{type:'element',tagName:'pre',properties:{className:['math-print-source'],'data-search-exclude':'true'},children:[{type:'text',value:'式の原文（TeX）\n'+source}]}]});
        Object.assign(node,generated,{type:'mdxJsxFlowElement'});
        delete node.lang;delete node.value;delete node.meta;
      }
      for(const child of node.children??[])visit(child);
    };
    visit(tree);
  };
}

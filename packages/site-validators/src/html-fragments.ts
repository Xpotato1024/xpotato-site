import { parse, type DefaultTreeAdapterMap } from 'parse5';
import type { BuiltHtmlInput } from './security-headers.js';
type Node = DefaultTreeAdapterMap['node'];
const attr=(node:Node,name:string)=>'attrs' in node ? node.attrs.find(a=>a.name===name)?.value : undefined;
const inspect=(html:string)=>{
  const ids=new Set<string>(), duplicates:string[]=[], anchors:string[]=[];
  let noindex=false;
  const visit=(node:Node,literal=false)=>{
    if('tagName' in node){
      const id=attr(node,'id') ?? (node.tagName==='a' ? attr(node,'name') : undefined);
      if(id){if(ids.has(id))duplicates.push(id);ids.add(id)}
      if(node.tagName==='meta' && ['robots','googlebot'].includes(attr(node,'name')??'') && /\b(noindex|none)\b/iu.test(attr(node,'content')??''))noindex=true;
      literal ||= ['pre','code'].includes(node.tagName);
      if(node.tagName==='a' && !literal && attr(node,'href'))anchors.push(attr(node,'href')!);
    }
    if('childNodes' in node)for(const child of node.childNodes)visit(child,literal);
  };
  visit(parse(html));return {ids,duplicates,anchors,noindex};
};
const routeFor=(path:string)=>path==='index.html' ? '/' : '/'+path.replace(/index\.html$/u,'');
export const validateHtmlFragments=(pages:readonly BuiltHtmlInput[],canonicalOrigin:string):readonly string[]=>{
  const byRoute=new Map(pages.flatMap(page=>{const value=inspect(page.html);return [[routeFor(page.path),value],['/'+page.path,value]] as const}));
  const errors:string[]=[];
  for(const page of pages){
    const source=routeFor(page.path), metadata=inspect(page.html);
    for(const id of metadata.duplicates)errors.push(`Duplicate HTML id: ${source} #${id}`);
    for(const href of metadata.anchors){
      let url:URL;try{url=new URL(href,new URL(source,canonicalOrigin))}catch{continue}
      if(url.origin!==new URL(canonicalOrigin).origin || !url.hash)continue;
      const target=byRoute.get(url.pathname);if(!target)continue; // Existing route validation handles non-HTML/missing pages.
      let fragment:string;try{fragment=decodeURIComponent(url.hash.slice(1).split(':~:text=')[0]!)}catch{errors.push(`Invalid encoded fragment: ${source} -> ${href}`);continue}
      if(fragment && !target.ids.has(fragment))errors.push(`Broken internal fragment: ${source} -> ${href}`);
    }
  }
  return errors;
};
/** Inventory only. Never sends source/private content or URLs to a third-party service. */
export const collectPublicExternalLinks=(pages:readonly BuiltHtmlInput[],canonicalOrigin:string)=>{
  const links=new Set<string>();let omittedQueryCount=0;
  for(const page of pages){const value=inspect(page.html);if(value.noindex)continue;
    for(const href of value.anchors){let url:URL;try{url=new URL(href,new URL(routeFor(page.path),canonicalOrigin))}catch{continue}
      if(url.protocol!=='https:' || url.origin===new URL(canonicalOrigin).origin || url.username || url.password)continue;
      if(url.search){omittedQueryCount++;continue}
      if(url.hostname==='localhost'||url.hostname.endsWith('.local')||url.hostname.endsWith('.invalid')||/^\d|^\[/u.test(url.hostname))continue;
      url.hash='';links.add(url.href);
    }
  }
  return {urls:[...links].sort(),omittedQueryCount};
};

import {parse,type DefaultTreeAdapterTypes} from 'parse5';
export const editorRoute='editor/index.html';
export const editorCsp="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'";
export function validateEditorShell(html:string):string[]{
 const errors:string[]=[],scripts:string[]=[],links:{rel:string;href:string}[]=[];let root=0,noindex=false;
 const walk=(node:DefaultTreeAdapterTypes.Node)=>{if('tagName' in node){
  const attr=(name:string)=>node.attrs.find(a=>a.name===name)?.value;
  if(node.tagName==='div'&&attr('id')==='root')root++;
  if(node.tagName==='meta'&&attr('name')==='robots')noindex=attr('content')==='noindex,nofollow';
  if(node.tagName==='script'){if(attr('type')!=='module'||!attr('src')||node.childNodes.some(child=>'value' in child&&child.value.trim()))errors.push('Editor runtime must use external modules only');scripts.push(attr('src')??'');}
  if(node.tagName==='style'||node.tagName==='iframe'||node.tagName==='object'||node.tagName==='base')errors.push('Unexpected editor shell element');
  if(node.attrs.some(a=>/^on/iu.test(a.name)||a.name==='style'))errors.push('Editor shell has inline executable styling or handler');
  if(node.tagName==='link')links.push({rel:attr('rel')??'',href:attr('href')??''});
 }if('childNodes'in node)for(const child of node.childNodes)walk(child);};walk(parse(html));
 if(root!==1||!noindex)errors.push('Editor shell requires one root and noindex');
 if(scripts.length!==1||!/^\/editor\/assets\/index-[a-zA-Z0-9_-]+\.js$/u.test(scripts[0]??''))errors.push('Editor entrypoint must belong to its fixed route');
 if(!links.some(l=>l.rel==='manifest'&&l.href==='/editor/manifest.webmanifest'))errors.push('Editor manifest missing');
 for(const link of links)if(!/^\/editor\/(?:assets\/[a-zA-Z0-9_.-]+\.(?:css|js)|manifest\.webmanifest|icon\.svg)$/u.test(link.href)&&!(link.rel==='apple-touch-icon'&&link.href==='/icon-apple-touch.png'))errors.push('Editor shell resource outside owned namespace');
 return errors;
}
export const editorHeaderLines=()=>[
 '/editor/*','  ! Content-Security-Policy','  Content-Security-Policy: '+editorCsp,'  X-Robots-Tag: noindex, nofollow','  Referrer-Policy: no-referrer','',
 '/editor/sw.js','  Cache-Control: no-cache','  Content-Type: text/javascript; charset=utf-8','  Service-Worker-Allowed: /editor/','',
 '/editor/manifest.webmanifest','  Cache-Control: no-cache','  Content-Type: application/manifest+json; charset=utf-8',''
];

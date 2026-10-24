import {parse,type DefaultTreeAdapterTypes as Tree} from 'parse5';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';
import * as ts from 'typescript';
import {sha256} from '@xpotato/content-contracts/canonical';
import {derivePageShare} from '../../../apps/site/src/lib/page-share.js';

export const pageSharePath='/scripts/page-share.js';
const attr=(n:Tree.Element,name:string)=>n.attrs.find(a=>a.name===name)?.value;
const hasClass=(n:Tree.Element,name:string)=>(attr(n,'class')??'').split(/\s+/u).includes(name);
const text=(n:Tree.Node):string=>'value' in n?n.value:'childNodes' in n?n.childNodes.map(text).join(''):'';
const elements=(root:Tree.Node):Tree.Element[]=>{
 const nodes:Tree.Element[]=[];const visit=(n:Tree.Node)=>{if('tagName' in n)nodes.push(n);if('childNodes' in n)n.childNodes.forEach(visit);};visit(root);return nodes;
};

/** Admit only the matching shared component, on an indexable article/tool with a canonical public URL. */
export const inspectPageShareMarkup=(html:string,route:string)=>{
 let duplicate=false;const nodes=elements(parse(html,{sourceCodeLocationInfo:true,onParseError:e=>{if(e.code==='duplicate-attribute')duplicate=true;}}));
 const scripts=nodes.filter(n=>n.tagName==='script'&&attr(n,'src')!==undefined&&new URL(attr(n,'src')!,'https://xpotato.net/').pathname===pageSharePath);
 const sections=nodes.filter(n=>attr(n,'data-page-share')!==undefined);
 if(!scripts.length&&!sections.length)return{htmlWithoutPageShare:html,pageShareScripts:0};
 const fail=()=>{throw Error('Page sharing requires one matching public article/tool component and exact local module');};
 if(duplicate||scripts.length!==1||sections.length!==1)fail();
 const script=scripts[0]!,section=sections[0]!,position=script.sourceCodeLocation;
 if(!position||script.attrs.length!==2||attr(script,'src')!==pageSharePath||attr(script,'type')!=='module'||script.childNodes.length)fail();
 const main=nodes.find(n=>n.tagName==='main'&&attr(n,'data-search-collection'));
 const heading=nodes.filter(n=>n.tagName==='h1');
 const canonical=nodes.filter(n=>n.tagName==='link'&&attr(n,'rel')==='canonical');
 const noindex=nodes.some(n=>n.tagName==='meta'&&((attr(n,'name')==='robots'&&/noindex/iu.test(attr(n,'content')??''))||attr(n,'name')==='xpotato-private-draft-preview-v1'));
 const publicPath='/'+route.replace(/^\/+/, '').replace(/index\.html$/u,'');
 if(!main||heading.length!==1||canonical.length!==1||noindex||attr(main!,'data-search-collection')!==publicPath.split('/')[1])fail();
 const expected=derivePageShare({collection:attr(main!,'data-search-collection')!,title:text(heading[0]!),canonical:attr(canonical[0]!,'href')??'',canonicalOrigin:'https://xpotato.net/',published:true,noindex:false,preview:false});
 if(!expected||!hasClass(section,'page-share')||new URL(expected.url).pathname!==publicPath||attr(section,'data-share-title')!==expected.title||attr(section,'data-share-url')!==expected.url)fail();
 const inside=elements(section),links=inside.filter(n=>n.tagName==='a'),buttons=inside.filter(n=>n.tagName==='button'),fields=inside.filter(n=>n.tagName==='input');
 if(links.length!==2||buttons.length!==2||fields.length!==1)fail();
 for(const [i,href]of [expected!.x,expected!.line].entries()){
  const link=links[i]!,rel=(attr(link,'rel')??'').split(/\s+/u);
  if(attr(link,'href')!==href||attr(link,'target')!=='_blank'||attr(link,'referrerpolicy')!=='no-referrer'||!['noopener','noreferrer','nofollow'].every(v=>rel.includes(v)))fail();
 }
 const controls=['data-share-copy','data-share-native'].map(action=>inside.filter(n=>attr(n,action)!==undefined));
 if(controls.some(matches=>matches.length!==1||matches[0]!.tagName!=='button'||attr(matches[0]!,'type')!=='button'||attr(matches[0]!,'hidden')===undefined)||controls[0]![0]===controls[1]![0])fail();
 const manual=inside.filter(n=>hasClass(n,'page-share-manual')),status=inside.filter(n=>hasClass(n,'page-share-status'));
 if(manual.length!==1||manual[0]!.tagName!=='details'||status.length!==1||attr(status[0]!,'role')!=='status'||attr(status[0]!,'aria-live')!=='polite'||attr(status[0]!,'aria-atomic')!=='true')fail();
 if(attr(fields[0]!,'value')!==expected!.url||attr(fields[0]!,'readonly')===undefined||!elements(manual[0]!).includes(fields[0]!))fail();
 return{htmlWithoutPageShare:html.slice(0,position!.startOffset)+html.slice(position!.endOffset),pageShareScripts:1};
};

export const validatePageShareSource=(sourceText:string)=>{
 if(!sourceText.length||Buffer.byteLength(sourceText)>4096||gzipSync(sourceText).length>1800)throw Error('Page sharing exceeds its bounded source budget');
 const source=ts.createSourceFile(pageSharePath,sourceText,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 const inspect=(n:ts.Node):void=>{
  if(ts.isImportDeclaration(n)||ts.isImportEqualsDeclaration(n)||ts.isExportDeclaration(n)
   ||(ts.isNewExpression(n)&&ts.isIdentifier(n.expression)&&['Function','Worker','SharedWorker','WebSocket','XMLHttpRequest'].includes(n.expression.text))
   ||(ts.isCallExpression(n)&&(n.expression.kind===ts.SyntaxKind.ImportKeyword||(ts.isIdentifier(n.expression)&&['require','eval','Function','fetch','importScripts'].includes(n.expression.text))||(ts.isPropertyAccessExpression(n.expression)&&['require','fetch','sendBeacon','readText','read'].includes(n.expression.name.text))))
   ||(ts.isIdentifier(n)&&['location','localStorage','sessionStorage','indexedDB'].includes(n.text)))throw Error('Page sharing dependencies, network, state collection or dynamic code are forbidden');
  ts.forEachChild(n,inspect);
 };inspect(source);
};

/** Count this conditional enhancement separately; it cannot carry a framework/search/network dependency. */
export const measurePageShareRuntime=async(dist:string,html:string,route:string)=>{
 const markup=inspectPageShareMarkup(html,route);
 if(!markup.pageShareScripts)return{...markup,pageShareAssets:[]};
 const bytes=await readFile(join(dist,pageSharePath.slice(1))),gzipBytes=gzipSync(bytes).length;
 const canonicalSource=await readFile(new URL('../../../apps/site/public/scripts/page-share.js',import.meta.url));
 if(!bytes.equals(canonicalSource))throw Error('Page sharing source/budget differs from the reviewed local enhancement');
 validatePageShareSource(bytes.toString('utf8'));
 return{...markup,pageShareAssets:[{path:pageSharePath,bytes:bytes.length,gzipBytes,sha256:sha256(bytes)}]};
};

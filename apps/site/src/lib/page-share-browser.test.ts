import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {describe,it,expect,vi} from 'vitest';

const source=readFileSync(new URL('../../public/scripts/page-share.js',import.meta.url),'utf8');
const url='https://xpotato.net/tools/prime-factorizer/';
const failure=(name:string)=>Object.assign(new Error(name),{name});
function deferred(){let resolve!:(value?:unknown)=>void,reject!:(reason:unknown)=>void;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
function fixture({secure=true,clipboard,share,canShare}: {secure?:boolean;clipboard?:object;share?:Function;canShare?:Function}={}){
 let activation=false;
 class Node {
  hidden=true; textContent=''; value=url; selected=false;
  attrs=new Map<string,string>(); listeners=new Map<string,Function[]>();
  addEventListener(name:string,fn:Function){this.listeners.set(name,[...(this.listeners.get(name)??[]),fn]);}
  setAttribute(name:string,value:string){this.attrs.set(name,value);}
  removeAttribute(name:string){this.attrs.delete(name);}
  getAttribute(name:string){return this.attrs.get(name);}
  select(){this.selected=true;}
  setSelectionRange(start:number,end:number){expect([start,end]).toEqual([0,url.length]);}
  scrollIntoView(){}
  focus(){document.activeElement=this;for(const fn of document.listeners.get('focusin')??[])fn({target:this});}
 }
 const copy=new Node(),native=new Node(),field=new Node(),status=new Node(),x=new Node(),line=new Node();
 const controls=[x,line,native,copy];
 for(const [index,node]of controls.entries())node.attrs.set('aria-describedby','hint-'+index);
 const actions={querySelectorAll:()=>controls,querySelector:()=>null,contains:(node:Node)=>controls.includes(node)};
 const manual={querySelector:()=>field};
 const nodes:Record<string,unknown>={'.page-share-status':status,'[data-share-copy]':copy,'[data-share-native]':native,'.page-share-manual':manual,'.page-share-actions':actions};
 const section=Object.assign(new Node(),{dataset:{shareTitle:'素因数分解機',shareUrl:url},matches:()=>false,querySelector:(selector:string)=>nodes[selector]});
 const document={activeElement:copy as Node,listeners:new Map<string,Function[]>(),querySelectorAll:()=>[section],querySelector:()=>null,
  addEventListener(name:string,fn:Function){this.listeners.set(name,[...(this.listeners.get(name)??[]),fn]);}};
 const navigator={clipboard,share,canShare};
 runInNewContext(source,{document,navigator,window:{isSecureContext:secure}});
 const click=(node:Node)=>{
  node.focus();activation=true;
  try{return node.listeners.get('click')?.[0]?.();}finally{activation=false;}
 };
 return{copy,native,field,status,x,line,navigator,document,click,active:()=>activation};
}

describe('page sharing browser capability paths (simulated APIs, not iOS hardware)',()=>{
 it('calls clipboard with its receiver during the click, using only the public URL',async()=>{
  let host:ReturnType<typeof fixture>;const clipboard={writeText:vi.fn(function(this:object,text:string){expect(this).toBe(clipboard);expect(host.active()).toBe(true);expect(text).toBe(url);return Promise.resolve();})};
  host=fixture({clipboard});await host.click(host.copy);
  expect(host.status.textContent).toContain('コピーしました');expect(host.copy.attrs.has('aria-busy')).toBe(false);
 });
 it.each([false,true])('offers selectable manual URL when secure=%s but the API is absent',async secure=>{
  const host=fixture({secure});await host.click(host.copy);
  expect(host.field.selected).toBe(true);expect(host.document.activeElement).toBe(host.field);expect(host.status.textContent).toContain('長押し');
 });
 it('distinguishes denial and preserves a focus change while permission is pending',async()=>{
  const write=deferred(),host=fixture({clipboard:{writeText:()=>write.promise}}),pending=host.click(host.copy);
  host.document.activeElement=host.line;for(const fn of host.document.listeners.get('focusin')??[])fn({target:host.line});
  write.reject(failure('NotAllowedError'));await pending;
  expect(host.status.textContent).toContain('拒否');expect(host.field.selected).toBe(false);expect(host.document.activeElement).toBe(host.line);
 });
 it('handles synchronous platform rejection with a manual URL and no unhandled event error',async()=>{
  const host=fixture({clipboard:{writeText(){throw failure('NotAllowedError');}}});
  await host.click(host.copy);expect(host.field.selected).toBe(true);expect(host.status.textContent).toContain('拒否');
 });
 it('handles a denied clipboard property getter',async()=>{
  const host=fixture();Object.defineProperty(host.navigator,'clipboard',{get(){throw failure('NotAllowedError');}});
  await host.click(host.copy);expect(host.field.selected).toBe(true);expect(host.status.textContent).toContain('拒否');
 });
 it('keeps native share available during an unsettled clipboard call and ignores stale copy feedback',async()=>{
  const write=deferred(),share=vi.fn().mockResolvedValue(undefined),host=fixture({clipboard:{writeText:()=>write.promise},share});
  const pending=host.click(host.copy),copyFeedback=host.status.textContent;
  await host.click(host.native);expect(share).toHaveBeenCalledOnce();expect(host.status.textContent).toContain('共有メニュー');
  expect(copyFeedback).toContain('応答がない場合');
  write.reject(failure('NotAllowedError'));await pending;expect(host.status.textContent).toContain('共有メニュー');expect(host.field.selected).toBe(false);
 });
 it('keeps copying available while a share sheet is open and ignores its late cancellation',async()=>{
  const share=deferred(),host=fixture({share:()=>share.promise,clipboard:{writeText:()=>Promise.resolve()}}),pending=host.click(host.native);
  await host.click(host.copy);expect(host.status.textContent).toContain('コピーしました');
  share.reject(failure('AbortError'));await pending;expect(host.status.textContent).toContain('コピーしました');
 });
 it('does not retry the same unresolved clipboard operation',async()=>{
  const write=deferred(),writeText=vi.fn(()=>write.promise),host=fixture({clipboard:{writeText}}),pending=host.click(host.copy);
  await host.click(host.copy);expect(writeText).toHaveBeenCalledOnce();
  write.resolve();await pending;expect(host.copy.attrs.has('aria-busy')).toBe(false);
 });
 it('lets a manual field click select the URL and suppress late clipboard feedback',async()=>{
  const write=deferred(),host=fixture({clipboard:{writeText:()=>write.promise}}),pending=host.click(host.copy);
  host.click(host.field);expect(host.field.selected).toBe(true);
  write.resolve();await pending;expect(host.status.textContent).not.toContain('コピーしました');
 });
 it('invokes native share during activation with the Navigator receiver',async()=>{
  let host:ReturnType<typeof fixture>;const share=vi.fn(function(this:object,payload:unknown){expect(this).toBe(host.navigator);expect(host.active()).toBe(true);expect(payload).toEqual({title:'素因数分解機',url});return Promise.resolve();});
  host=fixture({share});expect(host.native.hidden).toBe(false);await host.click(host.native);expect(share).toHaveBeenCalledOnce();
 });
 it.each(['AbortError','NotAllowedError','DataError'])('reports native %s without copying or claiming delivery',async name=>{
  const writeText=vi.fn(),host=fixture({share:()=>Promise.reject(failure(name)),clipboard:{writeText}});
  await host.click(host.native);expect(writeText).not.toHaveBeenCalled();expect(host.status.textContent).not.toContain('渡しました');
  expect(host.status.textContent).toContain(name==='AbortError'?'完了していません':name==='NotAllowedError'?'拒否':'利用できません');
 });
 it.each([false,undefined])('hides unavailable native sharing with canShare=%s',canShare=>{
  const host=fixture(canShare===false?{share:()=>Promise.resolve(),canShare:()=>false}:{});
  expect(host.native.hidden).toBe(true);expect(host.copy.hidden).toBe(false);
 });
 it('does not expose native sharing if support detection throws',()=>{
  const host=fixture({share:()=>Promise.resolve(),canShare(){throw failure('NotAllowedError');}});
  expect(host.native.hidden).toBe(true);
 });
 it('keeps X/LINE as native anchors without a click interceptor',()=>{
  const host=fixture();expect(host.x.listeners.has('click')).toBe(false);expect(host.line.listeners.has('click')).toBe(false);
 });
});

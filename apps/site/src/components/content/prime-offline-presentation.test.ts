import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {describe,it,expect} from 'vitest';
const read=(file:string)=>readFile(new URL(file,import.meta.url),'utf8');
describe('Prime offline presentation',()=>{
  it('keeps the save control and status visible outside the compact disclosure',async()=>{
    const source=await read('./PrimeOffline.astro');
    expect(source).toMatch(/<section[^>]*id="prime-offline-guide"[^>]*data-prime-offline[^>]*aria-labelledby="prime-offline-title"/u);
    expect(source.indexOf('data-prime-offline-save')).toBeLessThan(source.indexOf('<details'));
    expect(source.indexOf('data-prime-offline-status')).toBeLessThan(source.indexOf('<details'));
    for(const text of ['初回はオンラインで','通信と端末の空き容量が必要','入力・計算結果・設定は保存しません','検索・記事・外部リンクには通信が必要','サイトデータの削除で保存が消える','別の保存領域','すべて閉じた後に反映'])expect(source).toContain(text);
    expect(source).toContain('role="status" aria-live="polite"');
    expect(source.match(/<details\b/gu)).toHaveLength(1);
    expect(source).not.toMatch(/<details[^>]*\bopen\b|<h2|<span>PWA|prime-offline-intro|prime-offline-label/u);
  });
  it('links the existing description to the lower save control on the Prime page only',async()=>{
    const route=await read('../../pages/tools/[...slug].astro');
    expect(route).toContain('{release?.toolId === "prime-factorizer" && <a slot="metadata"');
    expect(route).toContain('data-prime-offline-guide-link href="#prime-offline-guide"');
    expect(route).toContain('{release?.toolId === "prime-factorizer" && <PrimeOffline />}');
    expect(route.indexOf('<Content components=')).toBeLessThan(route.indexOf('<PrimeOffline />'));
    expect(route.indexOf('<PrimeOffline />')).toBeLessThan(route.indexOf('<ToolReleaseNotice'));
  });
  it('retains the description and contact routes without promotional or technical labels',async()=>{
    const source=await read('../../content/tools/prime-factorizer.mdx');
    expect(source).toContain('初回保存後はオフラインでも使えます');
    expect(source).toContain('入力値・結果は外部送信せず');
    const contact=await read('./ToolContact.astro');
    expect(contact).not.toContain('GitHub Issueは公開されます');
    expect(contact).toContain('GitHubでIssueを作成');
    expect(contact).toContain('/contact/#contact-bugs');
  });
});
async function guidanceFixture(hash='',secure=false,path='/tools/prime-factorizer/'){
  const events=new Map<string,()=>void>(),guide={open:false};
  let click:(event:Record<string,unknown>)=>void=()=>{};
  const root={querySelector:(selector:string)=>selector==='details'?guide:{}};
  const location={pathname:path,hash};
  const context={location,isSecureContext:secure,navigator:{},window:{addEventListener:(name:string,handler:()=>void)=>events.set(name,handler)},
    document:{querySelector:(selector:string)=>selector==='[data-prime-offline]'?root:{addEventListener:(_name:string,handler:typeof click)=>{click=handler;}}}};
  vm.runInNewContext(await read('../../../public/scripts/prime-pwa.js'),context);
  return{guide,location,events,click:(event:Record<string,unknown>={button:0})=>click(event)};
}
describe('Prime offline guidance enhancement',()=>{
  it.each([false,true])('opens the guide without a usable offline API (secure=%s)',async secure=>{
    const f=await guidanceFixture('',secure);
    expect(f.guide.open).toBe(false);
    f.click();expect(f.guide.open).toBe(true);
    f.guide.open=false;f.click();expect(f.guide.open).toBe(true);
  });
  it('supports direct fragments and Back/Forward without changing other fragments',async()=>{
    const f=await guidanceFixture('#prime-offline-guide');
    expect(f.guide.open).toBe(true);
    f.guide.open=false;f.location.hash='#main-content';f.events.get('hashchange')!();
    expect(f.guide.open).toBe(false);
    f.location.hash='#prime-offline-guide';f.events.get('hashchange')!();expect(f.guide.open).toBe(true);
  });
  it('preserves modified clicks and remains inert outside Prime',async()=>{
    for(const event of [{button:1},{button:0,ctrlKey:true},{button:0,metaKey:true},{button:0,shiftKey:true},{button:0,altKey:true}]){
      const f=await guidanceFixture();f.click(event);expect(f.guide.open).toBe(false);
    }
    const f=await guidanceFixture('#prime-offline-guide',false,'/search/');f.click();
    expect(f.guide.open).toBe(false);expect(f.events.size).toBe(0);
  });
});

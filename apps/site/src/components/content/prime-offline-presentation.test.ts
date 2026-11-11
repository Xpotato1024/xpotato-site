import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {describe,it,expect} from 'vitest';
import {inspectPrimePwaMarkup} from '../../../../../packages/site-validators/src/delivery/prime-pwa-runtime.js';
const read=(file:string)=>readFile(new URL(file,import.meta.url),'utf8');
describe('Prime offline presentation',()=>{
  it('keeps the save control and status visible outside the compact disclosure',async()=>{
    const source=await read('./PrimeOffline.astro');
    expect(source).toMatch(/<section[^>]*id="prime-offline-guide"[^>]*data-prime-offline[^>]*aria-labelledby="prime-offline-title"/u);
    expect(source.indexOf('data-prime-offline-save')).toBeLessThan(source.indexOf('<details'));
    expect(source.indexOf('data-prime-offline-status')).toBeLessThan(source.indexOf('<details'));
    for(const text of ['インターネットに接続し、端末に空き容量がある状態','計算中は保存できません','入力した数値・計算結果・設定は保存しません','必要な結果は、画面を閉じる前に控えて','検索・記事・外部リンクを開くには、インターネット接続が必要','サイトのデータを消したとき','アプリ内でも','すべて閉じた後の次回起動時に反映'])expect(source).toContain(text);
    expect(source).toContain('role="status" aria-live="polite"');
    expect(source.indexOf('必要な結果は')).toBeLessThan(source.indexOf('<ol>'));
    expect(source.match(/<h2 data-font-family="body">/gu)).toHaveLength(4);
    expect(source).not.toContain('<h3>');
    expect(source).not.toMatch(/別の保存領域|公開アプリのファイル/u);
    expect(source.match(/<details\b/gu)).toHaveLength(1);
    expect(source).not.toMatch(/<details[^>]*\bopen\b|<span>PWA|prime-offline-intro|prime-offline-label/u);
  });
  it('uses the shared fragment offset without counting the header twice',async()=>{
    const source=await read('./PrimeOffline.astro');
    const global=await read('../../styles/global.css');
    expect(global).toMatch(/html\s*\{\s*scroll-padding-top:\s*calc\(var\(--site-header-bottom,/u);
    expect(source).not.toMatch(/scroll-margin(?:-top|-block-start)?\s*:|--site-header-height/u);
  });
  it('links the existing description to the lower save control on the Prime page only',async()=>{
    const route=await read('../../pages/tools/[...slug].astro');
    expect(route).toContain('{release?.toolId === "prime-factorizer" && <div slot="metadata"');
    expect(route).toContain('data-prime-offline-guide-link href="#prime-offline-guide"');
    expect(route).toContain('{release?.toolId === "prime-factorizer" && <PrimeOffline />}');
    expect(route.indexOf('<Content components=')).toBeLessThan(route.indexOf('<PrimeOffline />'));
    expect(route.indexOf('<PrimeOffline />')).toBeLessThan(route.indexOf('<ToolReleaseNotice'));
  });
  it('places a native try link above the offline link and targets the stable primary tool shell',async()=>{
    const route=await read('../../pages/tools/[...slug].astro'),demo=await read('./Demo.astro');
    expect(route).toMatch(/<div slot="metadata" class="prime-intro-links" data-search-exclude="true">/u);
    expect(route).toMatch(/<a class="prime-offline-link" href="#tool-demo">さっそく試してみる <span aria-hidden="true">↓<\/span><\/a>/u);
    expect(route.indexOf('href="#tool-demo"')).toBeLessThan(route.indexOf('data-prime-offline-guide-link'));
    expect(demo).toContain('id={isPrimePage ? "tool-demo" : undefined} tabindex={isPrimePage ? -1 : undefined}');
    expect(demo).toContain('const isPrimePage = pageOwnsReleaseNotice && moduleId === "prime-factorizer";');
    expect(demo).toContain('const pageOwnsReleaseNotice = collection === "tools" && record.role === "primary_tool";');
    expect(route).toMatch(/\.prime-intro-links\s*\{[^}]*flex-direction:\s*column/u);
    // Native fragments work before hydration and retain Back/Forward behavior.
    // The shared html scroll-padding already accounts for the sticky header.
    expect(demo).not.toMatch(/scroll-margin(?:-top|-block-start)?\s*:/u);
    expect(route).not.toContain('scrollIntoView');
  });
  it('uses a decorative navigation arrow without shrinking the touch targets',async()=>{
    const route=await read('../../pages/tools/[...slug].astro'),offline=await read('./PrimeOffline.astro');
    const link=route.match(/<a\b[^>]*data-prime-offline-guide-link[^>]*>([\s\S]*?)<\/a>/u)?.[1]??'';
    expect(link).toMatch(/オフライン保存の手順を見る\s*<span aria-hidden="true">→<\/span>/u);
    const global=await read('../../styles/global.css');
    const iconFloor=Number(global.match(/--control-icon-size:\s*(\d+(?:\.\d+)?)px/u)?.[1]);
    expect(iconFloor).toBeGreaterThanOrEqual(44);
    expect(global).toMatch(/--control-min-size:\s*max\([^;]*var\(--control-icon-size\)\)/u);
    expect(route).toMatch(/\.prime-offline-link\s*\{[^}]*min-height:\s*var\(--control-min-size\)/u);
    expect(offline).toMatch(/<button\b[^>]*class="action-primary"[^>]*data-prime-offline-save/u);
    expect(global).toMatch(/\.action-primary\s*\{[^}]*min-height:\s*var\(--control-min-size\)/u);
    expect(offline).toContain('class="disclosure-summary"');
    expect(global).toMatch(/\.disclosure-summary\s*\{[^}]*min-height:\s*var\(--control-min-size\)/u);
  });
  it('limits the compact heading spacing to the Prime guide link',async()=>{
    const route=await read('../../pages/tools/[...slug].astro');
    const styles=route.match(/<style>([\s\S]*?)<\/style>/u)?.[1]??'';
    const headingSelectors=[...styles.matchAll(/([^{}]+)\{[^{}]*\}/gu)]
      .map(match=>match[1]!.trim()).filter(selector=>selector.includes('.content-heading'));
    expect(headingSelectors).toEqual([':global(.content-heading:has(.prime-offline-link))']);
  });
  it('keeps shared tool styles outside the exact Prime offline shell guard',async()=>{
    const route=await read('../../pages/tools/[...slug].astro');
    const styles=route.match(/<style>([\s\S]*?)<\/style>/u)?.[1];
    expect(styles).toBeTruthy();
    const html='<style>'+styles+'</style><main>Synthetic tool</main>';
    for(const path of ['tools/synthetic-words/index.html','tools/synthetic-transformer/index.html']){
      expect(inspectPrimePwaMarkup(html,path)).toEqual({htmlWithoutPrimePwa:html,script:false});
    }
  });
  it('does not add another divider above the offline save section',async()=>{
    const source=await read('./PrimeOffline.astro');
    const rootRule=source.match(/\.prime-offline\s*\{([^}]*)\}/u)?.[1];
    expect(rootRule).toBeTruthy();
    expect(rootRule).not.toMatch(/\bborder(?:-[a-z-]+)?\s*:/u);
  });
  it('keeps privacy in the description and offline guidance in its existing section',async()=>{
    const source=await read('../../content/tools/prime-factorizer.mdx');
    expect(source).toContain('入力値・結果は外部送信しません');
    const offline=await read('./PrimeOffline.astro');
    expect(offline).toContain('保存後は、同じブラウザでこのページを開けば、通信なしで計算できます');
    const contact=await read('./ToolContact.astro');
    expect(contact).not.toContain('GitHub Issueは公開されます');
    expect(contact).toContain('GitHubでIssueを作成');
    expect(contact).toContain('/contact/#contact-bugs');
  });
});
async function guidanceFixture(hash='',secure=false,path='/tools/prime-factorizer/',cold=false){
  const events=new Map<string,()=>void>(),guide={open:false},frames:Array<()=>void>=[];
  let click:(event:Record<string,unknown>)=>void=()=>{},mutate=()=>{},loaded=false,disconnected=false,corrections=0;
  const root={querySelector:(selector:string)=>selector==='details'?guide:{},scrollIntoView:()=>{corrections++;}};
  const tool={querySelector:()=>loaded?{}:null};
  const location={pathname:path,hash};
  const context={location,isSecureContext:secure,navigator:{},scrollY:100,requestAnimationFrame:(callback:()=>void)=>frames.push(callback),
    MutationObserver:class{constructor(callback:()=>void){mutate=callback;}observe(){}disconnect(){disconnected=true;}},
    window:{addEventListener:(name:string,handler:()=>void)=>events.set(name,handler),removeEventListener:(name:string)=>events.delete(name)},
    document:{activeElement:root as unknown,querySelector:(selector:string)=>selector==='[data-prime-offline]'?root:selector==='[data-interactive-module]'?(cold?tool:null):selector==='[data-prime-offline-guide-link]'?{addEventListener:(_name:string,handler:typeof click)=>{click=handler;}}:null}};
  const flush=()=>{while(frames.length)frames.shift()!();};
  vm.runInNewContext(await read('../../../public/scripts/prime-pwa.js'),context);
  return{guide,location,events,context,flush,click:(event:Record<string,unknown>={button:0})=>click(event),
    hydrate:(paint=true)=>{loaded=true;if(!disconnected)mutate();if(paint)flush();},
    observed:()=>({disconnected,corrections})};
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

describe('Prime offline cold layout correction',()=>{
  const cold=()=>guidanceFixture('#prime-offline-guide',false,'/tools/prime-factorizer/',true);
  it('corrects the fragment once after hydration and releases its observer/listeners',async()=>{
    const f=await cold();f.flush();f.hydrate();f.hydrate();
    expect(f.observed()).toEqual({disconnected:true,corrections:1});
    for(const name of ['wheel','touchstart','pointerdown','keydown'])expect(f.events.has(name)).toBe(false);
  });
  it.each(['wheel','touchstart','pointerdown','keydown'])('does not reclaim the viewport after %s',async name=>{
    const f=await cold();f.flush();f.hydrate(false);f.events.get(name)!();f.flush();
    expect(f.observed()).toEqual({disconnected:true,corrections:0});
  });
  it.each(['scroll','focus','fragment'])('respects changed %s before hydration',async change=>{
    const f=await cold();f.flush();
    if(change==='scroll')f.context.scrollY+=40;
    if(change==='focus')f.context.document.activeElement=null;
    if(change==='fragment')f.location.hash='#main-content';
    f.hydrate();expect(f.observed()).toEqual({disconnected:true,corrections:0});
  });
});

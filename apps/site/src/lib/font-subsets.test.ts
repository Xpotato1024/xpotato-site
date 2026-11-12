import {describe,expect,it} from "vitest";
import {dynamicFontText,loadToolFontText,matchesUnicodeRange,renderedFontText,selectFontFaces} from "./font-subsets.mjs";
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {materializeHistoricalToolFixture} from '../../../../tests/fixtures/historical-browser-tool.js';

describe("local font slice selection",()=>{
  const face=(file:string,range:string,weight='400',style='normal')=>`@font-face {font-family: 'Example';font-style: ${style};font-weight: ${weight};font-display: swap;src: url(/fonts/${file}.woff2);unicode-range: ${range};}`;
  it('preserves overlapping original faces without assuming declared ranges equal their cmaps',()=>{
    const source=face('first','U+0041-005A')+face('second','U+0041-005A');
    for(const file of ['first','second'])expect(selectFontFaces(source,{Example:'ABC'})).toContain(file+'.woff2');
    const css=selectFontFaces(source,{Example:'AZ'},face('core','U+0041-0043'));
    for(const file of ['first','second','core'])expect(css).toContain(file+'.woff2');
  });
  it('keeps different stretch and family faces outside core suppression',()=>{
    const source=face('normal','U+0041-005A')+face('condensed','U+0041-005A').replace('font-display:', 'font-stretch: condensed;font-display:')+face('other','U+0041-005A').replace("'Example'", "'Other'");
    const css=selectFontFaces(source,{Example:'ABC',Other:'ABC'},face('core','U+0041-0043'));
    expect(css).not.toContain('normal.woff2');
    for(const file of ['condensed','other','core'])expect(css).toContain(file+'.woff2');
  });
  it('omits original slices fully covered by the later core for this route',()=>{
    const source=face('original','U+0041-005A'),core=face('core','U+0041-0043');
    expect(selectFontFaces(source,{Example:'ABC'},core)).not.toContain('original.woff2');
    expect(selectFontFaces(source,{Example:'ABC'},core)).toContain('core.woff2');
  });
  it('retains the original source, full range and cascade order for new non-core text',()=>{
    const original=face('original','U+0041-005A'),core=face('core','U+0041-0043');
    const css=selectFontFaces(original,{Example:'AZ'},core);
    expect(css).toContain('U+0041-005A');
    expect(css.indexOf('original.woff2')).toBeLessThan(css.indexOf('core.woff2'));
    expect(selectFontFaces(original,{Example:'Z'},core)).not.toContain('core.woff2');
  });
  it('never treats another weight or style as core coverage',()=>{
    const source=face('original400','U+0041-005A')+face('original500','U+0041-005A','500')+face('italic','U+0041-005A','400','italic');const core=face('core400','U+0041-0043');
    const css=selectFontFaces(source,{Example:'ABC'},core);
    expect(css).not.toContain('original400.woff2');
    for(const file of ['original500','italic','core400'])expect(css).toContain(file+'.woff2');
  });
  it('keeps the effective selected face for every known glyph and weight',()=>{
    const source=face('original400','U+0041-005A')+face('original500','U+0041-005A','500');const core=face('core400','U+0041-0043')+face('core500','U+0041-0042','500');
    const effective=(css:string,char:string,weight:string)=>[...css.matchAll(/@font-face\s*\{([^}]+)\}/gu)].filter(m=>m[1]!.includes('font-weight:'+weight)||m[1]!.includes('font-weight: '+weight)).filter(m=>matchesUnicodeRange(char.codePointAt(0)!,/unicode-range:\s*([^;]+)/u.exec(m[1]!)![1]!)).at(-1)?.[1]!.match(/url\(([^)]+)\)/u)?.[1];
    for(const text of ['ABC','AZ','A','Z'])for(const char of text)for(const weight of ['400','500'])expect(effective(selectFontFaces(source,{Example:text},core),char,weight)).toBe(effective(source+core,char,weight));
  });
  it('keeps rollback to an admitted release without a dedicated font-text file buildable',async()=>{
    const historical=await materializeHistoricalToolFixture('v0-1-0');
    try{
    const text=await loadToolFontText(pathToFileURL(join(historical.root,'src')+'/'));
    expect(text).toContain('計算ファイルを準備しています。');
    expect(text).toContain('分解');
    }finally{await historical.cleanup();}
  });
  it('covers every fixed Japanese status glyph for search, copy and share after interaction',async()=>{
    const [search,code,share,source]=await Promise.all([
      readFile(new URL("../search/search-client.ts",import.meta.url),'utf8'),
      readFile(new URL("../../public/scripts/code-copy.js",import.meta.url),'utf8'),
      readFile(new URL("../../public/scripts/page-share.js",import.meta.url),'utf8'),
      readFile(new URL("../styles/fonts.css",import.meta.url),'utf8'),
    ]);
    for(const html of ['<main data-search-client></main>','<script src="/scripts/code-copy.js"></script>','<script src="/scripts/page-share.js"></script>','<section data-interactive-module="prime-factorizer"></section>']){
      const text=dynamicFontText(html,{search,code,share});
      const css=selectFontFaces(source,{'Zen Kaku Gothic New':text});
      const ranges=[...css.matchAll(/unicode-range:([^;]+)/gu)].map(m=>m[1]!);
      for(const char of new Set(text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu)??[]))
        expect(ranges.some(range=>matchesUnicodeRange(char.codePointAt(0)!,range)),char).toBe(true);
    }
  });
  it('includes dynamic glyphs only for the rendered component, even on private routes',()=>{
    const ui={search:'検索読込失敗',code:'コピー完了',tools:{'tool-one':'素因数中止','tool-two':'変換完了'},share:'共有メニューへ渡しました。'};
    expect(dynamicFontText('<main>About</main>',ui)).toBe('');
    expect(dynamicFontText('<section data-interactive-module="tool-two"></section>',ui)).toBe(ui.tools['tool-two']);
    expect(()=>dynamicFontText('<section data-interactive-module="unregistered"></section>',ui)).toThrow('Unregistered');
    expect(dynamicFontText('<main data-search-client></main>',ui)).toBe(ui.search);
    expect(dynamicFontText('<script src="/scripts/code-copy.js"></script>',ui)).toBe(ui.code);
    expect(dynamicFontText('<script src="/scripts/page-share.js"></script>',ui)).toBe(ui.share);
    expect(dynamicFontText('<section data-interactive-module="tool-one"></section>',ui)).toBe(ui.tools['tool-one']);
    expect(dynamicFontText('<script>data-search-client</script><p>code-copy.js</p>',ui)).toBe('');
  });
  it('uses the adopted toolkit fixed UI text rather than the thin React re-export',()=>{
    const text=dynamicFontText('<section data-interactive-module="prime-factorizer"></section>',{search:'',code:''});
    expect(text).toContain('対');expect(text).toContain('対応ソース');expect(text).toContain('入力');
  });
  it('keeps disclosure glyphs on their own page while excluding non-search metadata from the search collection',()=>{
    const html='<h1>計算</h1><p>検索本文</p><aside data-search-exclude="true"><h2>配布</h2><p>上限確度</p></aside><p data-search-exclude="false">表示</p>';
    const page=renderedFontText(html),search=renderedFontText(html,{searchCollection:true});
    expect(page['Zen Kaku Gothic New']).toContain('上限確度');expect(page['Noto Serif JP']).toContain('配布');
    expect(search['Zen Kaku Gothic New']).toContain('検索本文');expect(search['Zen Kaku Gothic New']).toContain('表示');
    expect(search['Zen Kaku Gothic New']).not.toMatch(/配布|上限確度/u);expect(search['Noto Serif JP']).toBe('計算');
  });
  it('keeps an explicitly body-font UI heading out of serif slices while preserving all its visible glyphs',()=>{
    const text=renderedFontText('<h1>見出し</h1><h2 data-font-family="body">共有</h2><h2>説明</h2>');
    expect(text['Noto Serif JP']).toBe('見出し説明');
    expect(text['Zen Kaku Gothic New']).toContain('共有');
  });
  it('keeps the Japanese serif glyphs used by the bilingual home headline',()=>{
    const text=renderedFontText('<h1 id="home-title"><span>Think.</span><span data-font-family="japanese-display" aria-hidden="true">ものづくりプログラミング日々の試行錯誤</span></h1>');
    expect(text['Noto Serif JP']).toBe('ものづくりプログラミング日々の試行錯誤');
    expect(text['Noto Serif']).toContain('Think.');
  });
  it("matches ranges, singleton supplementary characters and wildcard ranges",()=>{
    expect(matchesUnicodeRange(0x4e00,"U+0041, U+4E00-4E09")).toBe(true);
    expect(matchesUnicodeRange(0x4e10,"U+4E0?")).toBe(false);
    expect(matchesUnicodeRange(0x1f600,"U+1F600")).toBe(true);
  });
  it("reads rendered headings and decodes entities without treating metadata or scripts as visible text",()=>{
    const text=renderedFontText('<html><head><title>隠</title></head><body><h1 id="home-title">Think.</h1><h2>&#x6559;育</h2><p>本文</p><script>保留</script></body></html>');
    expect(text["Noto Serif"]).toBe("Think.");expect(text["Noto Serif JP"]).toBe("教育");expect(text["Zen Kaku Gothic New"]).toContain("本文");expect(text["Zen Kaku Gothic New"]).not.toMatch(/隠|保留/u);
  });
  it("retains original Unicode ranges and sources for used slices, excludes unused slices deterministically",()=>{
    const source="@font-face {font-family: 'Example'; src: url(/fonts/a.woff2); unicode-range: U+0041-005A;} @font-face {font-family: 'Example'; src: url(/fonts/b.woff2); unicode-range: U+4E00-4E09;}";
    const css=selectFontFaces(source,{Example:"ABC"});expect(css).toContain("a.woff2");expect(css).toContain("U+0041-005A");expect(css).not.toContain("b.woff2");expect(css).toBe(selectFontFaces(source,{Example:"CBA"}));
  });
});

it('includes update UI glyphs only on marked update routes',()=>{
  const texts={search:'検索',code:'コピー',updates:'直近13週で今日昨日日前48時間以内今週'};
  expect(dynamicFontText('<section data-update-activity></section>',texts)).toBe(texts.updates);
  expect(dynamicFontText('<main>記事</main>',texts)).toBe('');
});

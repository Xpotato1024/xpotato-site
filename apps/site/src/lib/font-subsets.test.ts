import {describe,expect,it} from "vitest";
import {matchesUnicodeRange,renderedFontText,selectFontFaces} from "./font-subsets.mjs";

describe("local font slice selection",()=>{
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

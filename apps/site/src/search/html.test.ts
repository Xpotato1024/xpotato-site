import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {createSearchIndexFromDocuments,loadSearchIndex,serializeSearchIndex,searchSearchIndex} from './runtime.js';
import {extractSearchDocumentFromHtml} from './html.js';

it('indexes plain headings with Japanese IDs and literal code without adding control text',()=>{
  const html='<main data-search-body data-search-id="38f4cc36-81fb-4d7c-8063-686eb8000352" data-search-collection="notes" data-search-title="題" data-search-description="説明"><h2 id="日本">日本 &amp; &lt;x&gt;</h2><h3 id="日本-1">日本</h3><pre><code>&lt;h2 id="literal"&gt;code&lt;/h2&gt;</code></pre></main>';
  const doc=extractSearchDocumentFromHtml(html,'/notes/test/')!;
  expect(doc.headingText).toBe('日本 & <x> 日本');
  expect(doc.bodyText).toContain('<h2 id="literal">code</h2>');
  expect(doc.bodyText).not.toContain('の節リンク');
});

it('does not index navigation or legacy heading control text',()=>{
  const html='<main data-search-body data-search-id="38f4cc36-81fb-4d7c-8063-686eb8000352" data-search-collection="notes" data-search-title="題" data-search-description="説明"><nav data-search-exclude="true">目次の重複</nav><h2>節<a><span aria-hidden="true">#</span></a></h2><p>本文</p></main>';
  const doc=extractSearchDocumentFromHtml(html,'/notes/test/')!;
  expect(doc.bodyText).toBe('節 本文');expect(doc.headingText).toBe('節');
});


it('prunes excluded headings and their descendants from every searchable field',()=>{
  const html=`<main data-search-body data-search-id="38f4cc36-81fb-4d7c-8063-686eb8000352" data-search-collection="tools" data-search-title="素因数分解" data-search-description="計算方法">
    <h1>素因数分解</h1><h2>計算方法</h2><p>Pollard Brent ECM SIQS WebAssembly SIMD Worker 楕円曲線法</p>
    <section data-search-exclude="true"><div><h2>秘密共有 hidden-sharing</h2></div></section>
    <section hidden><h2>非表示 hidden-section</h2></section>
    <section aria-hidden="TRUE"><h3>隠蔽 hidden-accessibility</h3></section>
    <h4 data-search-exclude="true">除外 hidden-heading</h4>
    <template><h2>雛型 hidden-template</h2></template>
    <h2 aria-hidden="false" data-search-exclude="false">通常 normal-heading</h2>
    <a data-search-exclude="true" href="/tools/">一覧へ戻る hidden-navigation</a>
  </main>`;
  const doc=extractSearchDocumentFromHtml(html,'/tools/prime-factorizer/')!;
  expect(doc.headingText).toBe('素因数分解 計算方法 通常 normal-heading');
  expect(doc.bodyText).not.toMatch(/秘密|非表示|隠蔽|除外|雛型|一覧へ戻る|hidden-/u);
  expect(doc.cjkSingles).not.toMatch(/秘|隠|雛/u);
  const index=loadSearchIndex(serializeSearchIndex(createSearchIndexFromDocuments([doc])));
  for(const query of ['Pollard','Brent','ECM','SIQS','WebAssembly','SIMD','Worker','楕円曲線法','通常']) {
    expect(searchSearchIndex(index,query).map(match=>match.route)).toEqual(['/tools/prime-factorizer/']);
  }
  for(const query of ['hidden-sharing','hidden-section','hidden-accessibility','hidden-heading','hidden-template','hidden-navigation','秘密共有']) {
    expect(searchSearchIndex(index,query)).toHaveLength(0);
  }
});

it('marks shared back navigation as excluded from search',()=>{
  const layout=readFileSync(new URL('../layouts/ContentLayout.astro',import.meta.url),'utf8');
  expect(layout).toMatch(/<a class="back-link" data-search-exclude="true"/u);
});

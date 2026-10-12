import {expect,it} from 'vitest';
import {addSectionLinks} from './section-links.js';
import {extractSearchDocumentFromHtml} from '../search/html.js';
import {parseFragment} from 'parse5';
it('escapes heading labels/IDs and retains actual IDs and literal code',()=>{
  const html='<h2 id="日本">日本 &amp; &lt;x&gt;</h2><h3 id="日本-1">日本</h3><pre><code>&lt;h2 id="literal"&gt;code&lt;/h2&gt;</code></pre>';
  const output=addSectionLinks(html,[{depth:2,slug:'日本',text:'日本 & <x>'},{depth:3,slug:'日本-1',text:'日本'}]);
  expect(output).toContain('href="#%E6%97%A5%E6%9C%AC"');
  const heading=parseFragment(output).childNodes[0];
  if(!heading || !('childNodes' in heading))throw Error('Missing heading');
  const anchor=heading.childNodes.at(-1);
  expect(anchor && 'attrs' in anchor && anchor.attrs.find(a=>a.name==='aria-label')?.value).toBe('# 日本 & <x>の節リンク');
  expect((output.match(/class="section-anchor"/gu)??[])).toHaveLength(2);
  expect(addSectionLinks(html,[])).toBe(html);
});
it('does not index generated navigation or heading control text',()=>{
  const html='<main data-search-body data-search-id="38f4cc36-81fb-4d7c-8063-686eb8000352" data-search-collection="notes" data-search-title="題" data-search-description="説明"><nav data-search-exclude="true">目次の重複</nav><h2>節<a><span aria-hidden="true">#</span></a></h2><p>本文</p></main>';
  const doc=extractSearchDocumentFromHtml(html,'/notes/test/')!;
  expect(doc.bodyText).toBe('節 本文');expect(doc.headingText).toBe('節');
});

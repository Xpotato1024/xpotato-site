import {expect,it} from 'vitest';
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

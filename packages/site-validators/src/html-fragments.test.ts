import {describe,expect,it} from 'vitest';
import {validateHtmlFragments,collectPublicExternalLinks} from './html-fragments.js';
describe('final HTML fragments',()=>{
  const origin='https://xpotato.net/';
  const pages=[{path:'index.html',html:'<main id="main"><a href="#main">same</a><a href="notes/a/#%E6%97%A5%E6%9C%AC">encoded</a><a href="/notes/a/#日本-1">duplicate heading suffix</a></main>'},{path:'notes/a/index.html',html:'<h2 id="日本">日本</h2><h2 id="日本-1">日本</h2><a name="legacy"></a><a href="./#legacy">legacy</a><a href="#:~:text=日本">text fragment</a>'}];
  it('resolves same page, relative, encoded and duplicate heading IDs',()=>expect(validateHtmlFragments(pages,origin)).toEqual([]));
  it('detects missing targets, duplicate IDs and malformed encoding',()=>{
    const broken={path:'index.html',html:'<p id="x"></p><p id="x"></p><a href="#missing">bad</a><a href="#%ZZ">encoding</a><pre><code><a href="#literal">literal</a></code></pre>'};
    expect(validateHtmlFragments([broken],origin)).toHaveLength(3);
  });
  it('limits external inventory to public, query-free semantic links',()=>{
    expect(collectPublicExternalLinks([{path:'index.html',html:'<a href="https://example.com/page#x">ok</a><a href="https://example.com/?token=secret">omit</a><a href="http://127.0.0.1:4322/">private</a>'},{path:'private/index.html',html:'<meta name="robots" content="noindex"><a href="https://example.com/private">private</a>'}],origin)).toEqual({urls:['https://example.com/page'],omittedQueryCount:1});
  });
});

import { describe, expect, it } from 'vitest';
import { selectTableOfContents, groupTableOfContents } from './table-of-contents.js';
describe('long-form static table of contents', () => {
  const headings = [{depth:2,slug:'日本語',text:'日本語'},{depth:3,slug:'式',text:'式'},{depth:2,slug:'日本語-1',text:'日本語'},{depth:2,slug:'最後',text:'最後'}];
  it('uses rendered Japanese and duplicate IDs unchanged', () => expect(selectTableOfContents(headings, 'あ'.repeat(1200))).toEqual(headings));
  it('hides short text, a long code sample and a single long section', () => {
    expect(selectTableOfContents(headings, '短文')).toEqual([]);
    expect(selectTableOfContents(headings, '```text\n'+'x'.repeat(2000)+'\n```')).toEqual([]);
    expect(selectTableOfContents(headings.slice(0,2), 'あ'.repeat(2000))).toEqual([]);
  });
});

describe('TOC hierarchy', () => {
  it('nests H3 under its preceding H2 without reordering links', () => {
    const headings=[{depth:2,slug:'a',text:'章A'},{depth:3,slug:'a-1',text:'小節'},{depth:3,slug:'a-2',text:'小節'},{depth:2,slug:'b',text:'章B'}];
    const tree=groupTableOfContents(headings);
    expect(tree.map(s=>s.slug)).toEqual(['a','b']);
    expect(tree[0]!.children.map(s=>s.slug)).toEqual(['a-1','a-2']);
    expect(tree.flatMap(s=>[s.slug,...s.children.map(c=>c.slug)])).toEqual(headings.map(h=>h.slug));
    expect(headings[0]).not.toHaveProperty('children');
  });
  it('keeps an orphan H3 rather than inventing a parent',()=>{
    const tree=groupTableOfContents([{depth:3,slug:'intro',text:'補足'},{depth:2,slug:'body',text:'本文'}]);
    expect(tree.map(s=>s.slug)).toEqual(['intro','body']);
  });
});

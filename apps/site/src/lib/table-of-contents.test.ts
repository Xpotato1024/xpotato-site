import { describe, expect, it } from 'vitest';
import { selectTableOfContents } from './table-of-contents.js';
describe('long-form static table of contents', () => {
  const headings = [{depth:2,slug:'日本語',text:'日本語'},{depth:3,slug:'式',text:'式'},{depth:2,slug:'日本語-1',text:'日本語'},{depth:2,slug:'最後',text:'最後'}];
  it('uses rendered Japanese and duplicate IDs unchanged', () => expect(selectTableOfContents(headings, 'あ'.repeat(1200))).toEqual(headings));
  it('hides short text, a long code sample and a single long section', () => {
    expect(selectTableOfContents(headings, '短文')).toEqual([]);
    expect(selectTableOfContents(headings, '```text\n'+'x'.repeat(2000)+'\n```')).toEqual([]);
    expect(selectTableOfContents(headings.slice(0,2), 'あ'.repeat(2000))).toEqual([]);
  });
});

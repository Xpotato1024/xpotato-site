import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {createMarkdownProcessor} from '@astrojs/markdown-remark';
import {fromHtml} from 'hast-util-from-html';
import type {Element, Root} from 'hast';
import {rehypeFootnoteBacklinks} from './footnote-backlinks.mjs';
import {candidateAstroConfiguration} from '../../../../../packages/article-pipeline/src/candidate/candidate-astro.js';

function elements(tree: Root | Element, tagName: string): Element[] {
  return tree.children.flatMap(child => child.type === 'element'
    ? [...(child.tagName === tagName ? [child] : []), ...elements(child, tagName)] : []);
}

describe('static SVG footnote backlinks', () => {
  it('keeps every repeated-reference target and accessible label while replacing the glyph', async () => {
    const source = 'First[^source], repeated[^source], again[^source], other[^other].\n\n[^source]: Source link.\n[^other]: Other source.';
    const plain = await createMarkdownProcessor({syntaxHighlight: false});
    const styled = await createMarkdownProcessor({syntaxHighlight: false, rehypePlugins: [rehypeFootnoteBacklinks]});
    const before = fromHtml((await plain.render(source)).code, {fragment: true});
    const html = (await styled.render(source)).code;
    const after = fromHtml(html, {fragment: true});
    const backlinks = (tree: Root) => elements(tree, 'a').filter(node => Object.hasOwn(node.properties, 'dataFootnoteBackref'));
    expect(backlinks(after).map(node => node.properties)).toEqual(backlinks(before).map(node => node.properties));
    expect(backlinks(after)).toHaveLength(4);
    const repeatCounts = (tree: Root) => backlinks(tree).map(node => elements(node, 'sup').map(sup =>
      sup.children.map(child => child.type === 'text' ? child.value : '').join('')));
    expect(repeatCounts(after)).toEqual(repeatCounts(before));
    const ids = new Set(elements(after, 'a').map(node => node.properties.id));
    for (const link of backlinks(after)) {
      expect(ids.has(String(link.properties.href).slice(1))).toBe(true);
      const icons = elements(link, 'svg');
      expect(icons).toHaveLength(1);
      const icon = icons[0];
      if (!icon) throw new Error('Missing footnote return icon');
      expect(icon.properties).toMatchObject({ariaHidden: 'true', focusable: 'false', stroke: 'currentColor', viewBox: '0 0 24 24'});
      expect(elements(icon, 'path')).toHaveLength(1);
    }
    expect(html).not.toMatch(/[↩\uFE0E\uFE0F]|<script|<img/u);
  });

  it.each(['↩', '↩\uFE0E', '↩\uFE0F'])('handles return presentation %s without replacing the repeat count', glyph => {
    const repeat = {type: 'element', tagName: 'sup', properties: {}, children: [{type: 'text', value: '2'}]};
    const link = {type: 'element', tagName: 'a', properties: {dataFootnoteBackref: '', href: '#ref-2', ariaLabel: 'Back to reference 1-2'}, children: [{type: 'text', value: glyph}, repeat]};
    const tree = {type: 'root', children: [link]};
    rehypeFootnoteBacklinks()(tree);
    expect(link.children[0]).toMatchObject({type: 'element', tagName: 'svg'});
    expect(link.children[1]).toBe(repeat);
    const once = JSON.stringify(tree);
    rehypeFootnoteBacklinks()(tree);
    expect(JSON.stringify(tree)).toBe(once);
  });

  it('leaves ordinary links, body text and footnote references untouched', () => {
    const tree = {type: 'root', children: [
      {type: 'text', value: '↩️'},
      {type: 'element', tagName: 'a', properties: {href: '#example'}, children: [{type: 'text', value: '↩️'}]},
      {type: 'element', tagName: 'a', properties: {dataFootnoteRef: '', href: '#note'}, children: [{type: 'text', value: '1'}]},
    ]};
    const before = JSON.stringify(tree);
    rehypeFootnoteBacklinks()(tree);
    expect(JSON.stringify(tree)).toBe(before);
  });

  it('registers the same plugin for Markdown and MDX and keeps article-owned styling', async () => {
    const config = await readFile('apps/site/astro.config.mjs', 'utf8');
    expect(config.match(/rehypePlugins: \[rehypeFootnoteBacklinks\]/gu)).toHaveLength(2);
    const candidateConfig = candidateAstroConfiguration(process.cwd(), 'https://example.invalid/articles/fixture/');
    expect(candidateConfig).toContain('/apps/site/src/lib/content/footnote-backlinks.mjs');
    expect(candidateConfig.match(/rehypePlugins:\[rehypeFootnoteBacklinks\]/gu)).toHaveLength(2);
    const css = await readFile('apps/site/src/styles/content.css', 'utf8');
    expect(css).toContain('.prose a[data-footnote-backref]');
    expect(css).toContain('min-width: 1.5rem; min-height: 1.5rem');
    expect(css).toContain('.footnote-backref-icon { flex: none; width: 1em; height: 1em; }');
  });
});

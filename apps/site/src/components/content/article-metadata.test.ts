import { beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { transform } from '@astrojs/compiler-rs';
import ts from 'typescript';
import * as runtime from 'astro/runtime/server/index.js';
import { experimental_AstroContainer } from 'astro/container';

const renderers: Record<string, (props: Record<string, unknown>) => Promise<string>> = {};
beforeAll(async () => {
  for (const name of ['ArticlePublication', 'BlogTaxonomy']) {
    const source = await readFile(new URL(`./${name}.astro`, import.meta.url), 'utf8');
    const compiled = transform(source, { filename: `${name}.astro`, resultScopedSlot: true });
    const code = ts.transpileModule(compiled.code, { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.CommonJS } }).outputText;
    const module = { exports: {} as { default: Parameters<typeof runtime.renderToString>[1] } };
    new Function('require', 'exports', code)((id: string) => {
      if (id === 'astro/runtime/server/index.js') return { ...runtime, createMetadata: () => ({}) };
      if (id.endsWith('lang.css')) return {};
      throw new Error(`Unexpected dependency: ${id}`);
    }, module.exports);
    const container = await experimental_AstroContainer.create();
    renderers[name] = props => container.renderToString(module.exports.default, { props });
  }
});
describe('article metadata', () => {
  it('labels publication and a distinct update with separate machine-readable dates', async () => {
    const html = await renderers.ArticlePublication!({ pubDate: '2026-11-13', updatedDate: '2026-11-14', purposes: [{ label: '解説', href: '/tags/explanation/' }] });
    expect(html).toContain('公開 <time datetime="2026-11-13">2026-11-13</time>');
    expect(html).toContain('更新 <time datetime="2026-11-14">2026-11-14</time>');
    expect(html.indexOf('解説')).toBeLessThan(html.indexOf('公開'));
    expect(html).toContain('href="/tags/explanation/" rel="tag"');
  });
  it.each([undefined, '2026-11-13'])('omits absent or same-day updates (%s)', async updatedDate => {
    const html = await renderers.ArticlePublication!({ pubDate: '2026-11-13', updatedDate, purposes: [] });
    expect(html).not.toContain('更新');
    expect(html.match(/<time /g)).toHaveLength(1);
    expect(html).not.toContain('<ul');
  });
  it('preserves accessible taxonomy meaning and all supplied links without chips', async () => {
    const html = await renderers.BlogTaxonomy!({ category: { label: 'ロボティクス', href: '/articles/category/robotics/' }, tags: [{ id: 'python', kind: 'technology', label: 'Python', href: '/tags/python/' }, { id: 'simulation', kind: 'topic', label: 'シミュレーション', href: '/tags/simulation/' }] });
    expect(html).toContain('visually-hidden');
    expect(html).toContain('主分類:');
    expect(html).toContain('技術タグ:');
    expect(html).toContain('関連テーマ:');
    expect(html.match(/rel="tag"/g)).toHaveLength(2);
    expect(html).not.toContain('taxonomy-label');
  });
  it('keeps private preview values unlinked and visibly marked', async () => {
    const html = await renderers.ArticlePublication!({ pubDate: '2026-11-13', purposes: [{ label: '解説' }], preview: true });
    expect(html).not.toContain('<a ');
    expect(html).toContain('プレビュー・公開記事ではありません');
  });
});

import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';

const read = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');

it('keeps the current Home composition without retired workshop selectors or padding overrides', async () => {
  const css = await read('./home.css');
  expect(css).not.toMatch(/\.(?:workshop|featured-project|secondary-project|document-flow|document-sheet|build-box|flow-arrow|visual-caption|response-sketch|project-arrow|axis|guide|curve|tool-strip)(?![\w-])/u);
  // Semantic activity color tokens do not alter the retired layout/padding contract.
  expect([...css.matchAll(/(?<![\w-])\.home\s*\{([^}]+)\}/gu)]
    .map(match => match[1]!.replace(/--activity-[\w-]+:[^;]+;/gu, '').trim())).toEqual(['padding-top: 0;']);
  expect([...css.matchAll(/\.records\s*\{([^}]+)\}/gu)].map(match => match[1]!.trim())).toEqual(['margin-top: 2.5rem;']);
  // Astro can put its module script between the update section and the first article section.
  expect([...css.matchAll(/^\.home-updates ~ \.records\[aria-labelledby="records-heading"\]\s*\{([^}]+)\}/gmu)].map(match => match[1]!.trim())).toEqual(['margin-top: .5rem;']);
  expect(css).toContain('.section-heading');
  expect(css).toContain('.project-controls [data-rotation]');
  expect(css).toContain('prefers-reduced-motion');
});

it('uses only the shared two-line glyph for the native menu fallback', async () => {
  const [css, layout] = await Promise.all([read('./global.css'), read('../layouts/BaseLayout.astro')]);
  const fallback = layout.match(/<details class="mobile-menu mobile-menu-fallback">[\s\S]*?<\/details>/u)?.[0];
  expect(fallback).toContain('<span class="menu-icon" aria-hidden="true"><span></span><span></span></span>');
  expect(css).not.toMatch(/\.mobile-menu(?:\[open\])? summary::after/u);
  expect(css).toContain('.mobile-menu[open] .menu-icon');
});

it('keeps a single frame on enhanced code blocks without removing the plain prose pre frame', async () => {
  const [code, content] = await Promise.all([read('./code.css'), read('./content.css')]);
  const inner = code.match(/\.prose \.code-block pre:not\(:where\(\[data-bt\], \[data-bt\] \*\)\)\s*\{([^}]+)\}/u)?.[1];
  expect(inner).toMatch(/\bborder:\s*0;/u);
  expect(code).toMatch(/\.prose \.code-block:not\([^{}]+\{[^}]*border:\s*1px solid/u);
  expect(content).toMatch(/\.prose pre:not\([^{}]+\{[^}]*border:\s*1px solid/u);
});

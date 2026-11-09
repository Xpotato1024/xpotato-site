import { it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
const read = (path: string) => readFile(path, 'utf8');
const manifest = JSON.parse(await read('apps/site/src/styles/design-roles.json'));

it('keeps role values in CSS and requires existing ownership sources and exception reasons', async () => {
  const css = await read(manifest.tokenSource);
  const exceptions = new Set(manifest.exceptions.map((entry: { id: string }) => entry.id));
  expect(new Set(manifest.roles.map((role: { id: string }) => role.id)).size).toBe(manifest.roles.length);
  for (const role of manifest.roles) {
    const sources = await Promise.all(role.sources.map(read));
    for (const token of role.tokens ?? []) {
      expect(css).toMatch(new RegExp(`${token}:`));
      expect(sources.join('\n') + (role.id === 'disclosure-control' ? css : '')).toContain(`var(${token}`);
    }
    for (const exception of role.exceptions ?? []) expect(exceptions.has(exception)).toBe(true);
  }
  for (const exception of manifest.exceptions) {
    expect(exception.owner).toBeTruthy(); expect(exception.scope).toBeTruthy(); expect(exception.reason).toBeTruthy();
  }
  expect(JSON.stringify(manifest)).not.toMatch(/#[0-9a-f]{6}\b/i);
});

it('opts site disclosures into one explicit primitive and keeps navigation separate', async () => {
  const role = manifest.roles.find((entry: { id: string }) => entry.id === 'disclosure-control');
  for (const source of role.sources) {
    const text = await read(source);
    expect(text.match(/<summary\b[^>]*>/g)?.every((tag: string) => tag.includes('class="disclosure-summary"'))).toBe(true);
    expect(text).not.toMatch(/(?:\.prime-offline|\.tool-release|\.issue-picker) summary\s*\{/);
  }
  const content = await read('apps/site/src/styles/content.css');
  expect(content).not.toMatch(/\[data-search-collection="tools"\].*summary/);
  expect(await read('apps/site/src/layouts/BaseLayout.astro')).not.toContain('disclosure-summary');
});

it('gives offline steps a real heading level without changing pinned tool internals', async () => {
  const offline = await read('apps/site/src/components/content/PrimeOffline.astro');
  expect(offline.match(/<h2 data-font-family="body">/g)).toHaveLength(4);
  expect(offline).not.toContain('<h3>');
  expect(offline).not.toMatch(/<summary[^>]*>\s*<h[1-6]/);
  const bridge = await read('apps/site/src/components/content/Demo.astro');
  expect(bridge).toContain('--bt-border: var(--border-tool)');
  expect(bridge).not.toMatch(/\.bt-prime-factorizer\s+(?:summary|details|input)/);
});

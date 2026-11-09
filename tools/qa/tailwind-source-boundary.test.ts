import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Exercise the compiler/scanner used by the pinned Vite plugin, without a site build.
const require = createRequire(import.meta.url);
const tailwindRequire = createRequire(require.resolve('@tailwindcss/vite'));
const { compile } = tailwindRequire('@tailwindcss/node');
const { Scanner } = tailwindRequire('@tailwindcss/oxide');

describe('Tailwind source boundary', () => {
  it('generates UI utilities without shipping utilities mentioned only in tests or build scripts', async () => {
    const root = await mkdtemp(join(tmpdir(), 'xpotato-tailwind-sources-'));
    try {
      const styles = join(root, 'src/styles');
      await mkdir(styles, { recursive: true });
      await mkdir(join(root, 'scripts'));
      await writeFile(join(root, 'src/Example.astro'), '<div class="flex gap-4"></div>');
      await writeFile(join(root, 'src/Example.test.ts'), 'const assertion = "backdrop-filter transition";');
      await writeFile(join(root, 'scripts/build.mjs'), 'const fixture = "blur-3xl";');

      const actualStyles = resolve('apps/site/src/styles');
      const compiler = await compile(await readFile(join(actualStyles, 'global.css'), 'utf8'), {
        base: actualStyles,
        onDependency() {},
      });
      const rebase = (source: { base: string; pattern: string; negated: boolean }) => ({
        ...source,
        base: resolve(styles, relative(actualStyles, source.base)),
      });
      const sources = compiler.root === 'none' ? [] : compiler.root === null
        ? [{ base: root, pattern: '**/*', negated: false }]
        : [rebase({ ...compiler.root, negated: false })];
      const scanner = new Scanner({ sources: [...sources, ...compiler.sources.map(rebase)] });
      const css = compiler.build(scanner.scan());

      expect(css).toContain('.flex {');
      expect(css).toContain('.gap-4 {');
      expect(css).not.toContain('.backdrop-filter {');
      expect(css).not.toContain('.transition {');
      expect(css).not.toContain('.blur-3xl {');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

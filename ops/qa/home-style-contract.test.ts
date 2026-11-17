import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { homeStyleTokens, inspectHomeStyleContract } from './home-style-contract.mjs';

it('rejects the preview regression: new Home CSS with an older shared stylesheet', async () => {
  const dist = await mkdtemp(join(tmpdir(), 'home-css-closure-'));
  try {
    await writeFile(join(dist, 'shared.css'), ':root{--accent:#745399}');
    await writeFile(join(dist, 'home.css'), '.home{--activity-level-1:rgb(var(--accent-rgb)/.35)}');
    // An unlinked new bundle must not conceal the missing dependency.
    await writeFile(join(dist, 'unused.css'), ':root{--brand-rgb:116,83,153}');
    const html = '<link rel="stylesheet" href="/shared.css"><link href="/home.css" rel="stylesheet">';
    await expect(inspectHomeStyleContract(dist, html)).rejects.toThrow('Missing linked design token: --brand-rgb');
  } finally { await rm(dist, { recursive: true, force: true }); }
});

it('resolves shared aliases only through linked files and detects missing/cyclic foundations', async () => {
  const dist = await mkdtemp(join(tmpdir(), 'home-css-closure-'));
  try {
    const declarations = homeStyleTokens.map(name => name + ':var(--foundation)').join(';');
    await writeFile(join(dist, 'roles.css'), ':root{' + declarations + '}');
    await writeFile(join(dist, 'shared.css'), '@import "roles.css";:root{--foundation:116,83,153}');
    const html = '<link rel="stylesheet" href="/shared.css">';
    const report = await inspectHomeStyleContract(dist, html);
    expect(report.sources).toHaveLength(2);
    expect(report.tokens['--color-activity-1']).toBe('116,83,153');
    await writeFile(join(dist, 'shared.css'), '@import "roles.css";:root{--foundation:var(--color-accent)}');
    await expect(inspectHomeStyleContract(dist, html)).rejects.toThrow('Cyclic design token');
  } finally { await rm(dist, { recursive: true, force: true }); }
});

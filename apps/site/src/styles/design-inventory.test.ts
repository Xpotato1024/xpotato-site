import { it, expect } from 'vitest';
import { readFile, access, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkPresentation, collectPresentation, inspectPresentation } from '../../../../tools/design/inventory.mjs';
const manifest = JSON.parse(await readFile('apps/site/src/styles/design-roles.json', 'utf8'));

it('keeps design review records outside Tailwind utility discovery', async () => {
  const css = await readFile('apps/site/src/styles/global.css', 'utf8');
  expect(css).toContain('@import "tailwindcss" source("../")');
  expect(css).toContain('@source not "../content/**";');
  for (const file of ['design-inventory.json', 'design-roles.json']) {
    expect(css).toContain(`@source not "./${file}";`);
  }
});

it('discovers every presentation source and rejects unreviewed elements, selectors and local overrides', async () => {
  expect(await checkPresentation(process.cwd())).toBeGreaterThan(75);
  const actual = await collectPresentation(process.cwd());
  const owned = new Set(manifest.roles.flatMap((role: {sources: string[]}) => role.sources));
  expect(Object.keys(actual).filter(path => !owned.has(path))).toEqual([]);
  // Ownership itself cannot exempt a file from structural review.
  for (const path of owned) await access(path as string);
  const exceptions = new Set(manifest.exceptions.map((entry: {id:string}) => entry.id));
  const used = new Set(manifest.roles.flatMap((role: {exceptions?:string[]}) => role.exceptions ?? []));
  expect([...exceptions].filter(id => !used.has(id))).toEqual([]);
  for (const entry of manifest.exceptions) {
    expect(entry.properties.length).toBeGreaterThan(0);
    expect(entry.checks.length).toBeGreaterThan(0);
    for (const check of entry.checks) await access(check);
  }
});

it('detects new templates and runtime emitters rather than only known files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'design-discovery-'));
  try {
    for (const dir of ['apps/site/src/components', 'apps/site/public/scripts', 'packages/portable-content/src']) await mkdir(join(root, dir), {recursive:true});
    expect(await collectPresentation(root)).toEqual({});
    await writeFile(join(root,'apps/site/src/components/New.astro'), '<button class="new-action">Go</button>');
    await writeFile(join(root,'apps/site/public/scripts/new.js'), "const item = document.createElement('button'); item.className = 'new-action';");
    expect(Object.keys(await collectPresentation(root))).toEqual(['apps/site/public/scripts/new.js','apps/site/src/components/New.astro']);
  } finally { await rm(root,{recursive:true,force:true}); }
});

it('records repeated elements, dynamic variants, CSS context and token-to-literal drift', async () => {
  const before = await inspectPresentation('fixture.astro', '<summary class="disclosure-summary">Label</summary><style>.a{color:var(--accent)}</style>');
  for (const source of [
    '<summary class="disclosure-summary">Label</summary><summary class="disclosure-summary">More</summary><style>.a{color:var(--accent)}</style>',
    '<summary class:list={["disclosure-summary", {compact}]}>Label</summary><style>.a{color:var(--accent)}</style>',
    '<summary class="disclosure-summary">Label</summary><style>.a{color:#123456}</style>',
    '<summary class="disclosure-summary">Label</summary><style>@media(max-width:500px){.a{color:var(--accent)}}</style>',
  ]) expect(await inspectPresentation('fixture.astro',source)).not.toEqual(before);
  expect((await inspectPresentation('fixture.ts', `const html = '<picture class="new-picture" data-id="' + id + '">';`)).script).toContain('markup: picture class=new-picture data-id');
  expect((await inspectPresentation('fixture.tsx', 'const C=()=> <button className="new-button" />;')).elements).toEqual({'button className="new-button"':1});
});

it('retires the divider alias and duplicates only after preserving fixture consumers', async () => {
  const actual = await collectPresentation(process.cwd());
  for (const path of Object.keys(actual)) {
    const text = await readFile(path,'utf8');
    expect(text, path).not.toMatch(/var\(--border(?:\s*[,)]|\s*\))|--border\s*:/u);
  }
  const css = await readFile('apps/site/src/styles/home.css','utf8');
  expect(css).not.toMatch(/\.(?:intro-links|intro-description|home-kicker|home-intro-with-photo|intro-break)\b/u);
  const legacy = await readFile('packages/site-validators/fixtures/LegacyPrimeFactorizer.tsx','utf8');
  const content = await readFile('apps/site/src/styles/content.css','utf8');
  for (const name of ['prime-factorizer-title','tool-result-status']) { expect(legacy).toContain(name); expect(content).toContain(name); }
  expect(await readFile('apps/site/src/components/ProjectCarousel.astro','utf8')).toContain('carousel-status visually-hidden');
  expect(await readFile('apps/site/src/lib/content/code-block-transformer.mjs','utf8')).toContain('["code-copy-status", "visually-hidden"]');
});

it('detects reordered/duplicate rules, importance, token identity and runtime style paths', async () => {
  const before = await inspectPresentation('fixture.css','.a{color:var(--accent)}');
  for(const changed of ['.a{color:var(--accent)}.a{color:var(--text-muted)}','.a{color:var(--accent)!important}', '.a{color:var(--text-muted)}', '.a{color:red;color:var(--accent)}']) expect(await inspectPresentation('fixture.css',changed)).not.toEqual(before);
  const astro = await inspectPresentation('fixture.astro', '---\nconst html = \'<button class="new-action">Go</button>\';\n---\n<Fragment set:html={html} />');
  expect(astro.script).toContain('markup: button class=new-action');
  expect(Object.keys(astro.elements).join(' ')).toContain('set:html={html}');
  for(const source of ["n.style.transform = 'translateX(10px)'", "n.style.setProperty('--menu-height','20px')", "n.setAttribute('style','color:red')"]) expect((await inspectPresentation('fixture.js',source)).script.length).toBeGreaterThan(0);
  expect(await inspectPresentation('fixture.astro','<button {...props}>Go</button>')).not.toEqual(await inspectPresentation('fixture.astro','<button>Go</button>'));
});

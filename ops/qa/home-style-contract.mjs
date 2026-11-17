import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, sep } from 'node:path';

export const homeStyleTokens = [
  '--brand-rgb', '--color-accent', '--color-label-static', '--color-focus',
  ...[0, 1, 2, 3].map(n => '--color-activity-' + n),
  '--color-activity-marker', '--color-activity-prelaunch',
  '--font-content', '--font-body', '--text-content-item',
  '--text-content-item--line-height', '--text-content-item--font-weight',
];

// This bounded build/preview check follows only the stylesheets actually linked by
// the page. It is a dependency check, not a substitute for browser cascade tests.
export async function inspectHomeStyleContract(dist, html) {
  const root = resolve(dist), sources = [], css = [], visited = new Set();
  const visit = async (href, from = '/') => {
    const url = new URL(href, 'https://local.invalid' + from);
    assert.equal(url.origin, 'https://local.invalid', 'Home CSS must be locally packaged');
    const name = decodeURIComponent(url.pathname), file = resolve(root, '.' + name);
    assert.ok(file.startsWith(root + sep), 'CSS path stays inside dist');
    if (visited.has(name)) return;
    visited.add(name);
    const bytes = await readFile(file), text = bytes.toString('utf8');
    sources.push({ path: name, sha256: createHash('sha256').update(bytes).digest('hex') });
    for (const match of text.matchAll(/@import\s+(?:url\(\s*)?["']([^"']+)["']/gu)) await visit(match[1], name);
    css.push(text);
  };
  for (const [tag] of html.matchAll(/<link\b[^>]*>/gu)) {
    const attrs = Object.fromEntries([...tag.matchAll(/([\w-]+)\s*=\s*["']([^"']*)["']/gu)].map(m => [m[1], m[2]]));
    if (attrs.rel?.split(/\s+/u).includes('stylesheet')) await visit(attrs.href);
  }
  for (const [, text] of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gu)) css.push(text);
  assert.ok(sources.length, 'Home has packaged stylesheets');
  const definitions = new Map();
  for (const text of css) for (const [, name, value] of text.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+)/gu)) definitions.set(name, value.trim());
  const resolveToken = (name, stack = []) => {
    assert.ok(!stack.includes(name), 'Cyclic design token: ' + [...stack, name].join(' -> '));
    assert.ok(definitions.has(name), 'Missing linked design token: ' + name);
    return definitions.get(name).replace(/var\(\s*(--[\w-]+)\s*\)/gu, (_, next) => resolveToken(next, [...stack, name]));
  };
  const tokens = Object.fromEntries(homeStyleTokens.map(name => [name, resolveToken(name)]));
  return { sources, tokens, scope: 'Linked CSS dependency closure; browser computed-style checks remain required.' };
}

import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import postcss from 'postcss';

export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const repository = new URL('../../../', import.meta.url);

/** Values belong to global.css. This adapter owns only renderer role mappings. */
export async function visualTheme() {
  const css = await readFile(new URL('apps/site/src/styles/global.css', repository), 'utf8');
  const roles = JSON.parse(await readFile(new URL('apps/site/src/styles/design-roles.json', repository), 'utf8'));
  if (roles.tokenSource !== 'apps/site/src/styles/global.css') throw Error('Unexpected design token owner');
  const values = new Map();
  postcss.parse(css).walkRules(rule => {
    if (rule.selector === ':root') rule.walkDecls(d => values.set(d.prop, d.value));
  });
  postcss.parse(css).walkAtRules('theme', rule => rule.walkDecls(d => values.set(d.prop, d.value)));
  const resolve = (name, depth = 0) => {
    if (depth > 8 || !values.has(name)) throw Error('Unresolved visual token: ' + name);
    return values.get(name).replace(/var\((--[\w-]+)\)/gu, (_, key) => resolve(key, depth + 1));
  };
  const theme = {id:'site-technical-visual-v1', background:resolve('--surface'), foreground:resolve('--text-primary'),
    muted:resolve('--text-muted'), grid:resolve('--border-divider'), accent:resolve('--accent'), font:resolve('--font-body'), fontSize:18};
  return {...theme, sha256:hash(JSON.stringify(theme)), tokenSourceSha256:hash(css)};
}

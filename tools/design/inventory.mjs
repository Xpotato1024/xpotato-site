import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { parse as parseAstro } from '@astrojs/compiler';
import postcss from 'postcss';
import ts from 'typescript';

const normalize = value => value.replace(/\s+/gu, ' ').trim();
const sorted = values => [...new Set(values)].sort();
const relevantAttributes = /^(?:class(?::list|Name)?|set:html|role|type|style|data-[\w-]+)$/u;

// Structural inventory, not a second CSS-value source. Attribute expressions
// and selector contexts are retained so a new variant cannot hide behind a file entry.
export async function inspectPresentation(path, source) {
  const elements = [], conditions = [], rules = [], script = [], markup = [];
  const css = text => {
    const tree = postcss.parse(text, { from: path });
    const context = node => {
      const parts = [];
      for (let parent = node.parent; parent; parent = parent.parent) {
        if (parent.type === 'atrule') parts.unshift('@' + parent.name + ' ' + normalize(parent.params));
        if (parent.type === 'rule') parts.unshift(normalize(parent.selector));
      }
      return parts.join(' / ');
    };
    const declarations = node => (node.nodes ?? []).filter(n => n.type === 'decl').map(n => {
      const tokens = [...n.value.matchAll(/var\(\s*(--[\w-]+)/gu)].map(match => match[1]);
      return n.prop + (tokens.length ? ' [token:' + sorted(tokens).join('|') + ']' : ' [local]') + (n.important ? ' !important' : '');
    }).join(', ');
    tree.walk(node => {
      if (node.type === 'rule' || node.type === 'atrule' && (node.nodes ?? []).some(n => n.type === 'decl')) {
        const own = node.type === 'rule' ? normalize(node.selector) : '@' + node.name + ' ' + normalize(node.params);
        rules.push([context(node),own].filter(Boolean).join(' / ') + ' -> ' + declarations(node));
      }
      if (node.type === 'atrule' && ['media','supports','container','keyframes','starting-style'].includes(node.name)) conditions.push('@' + node.name + ' ' + normalize(node.params));
    });
  };
  const code = text => {
    const tree = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const walk = node => {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const attrs = node.attributes.properties.filter(n => ts.isJsxSpreadAttribute(n) || ts.isJsxAttribute(n) && relevantAttributes.test(n.name.getText(tree))).map(n => normalize(n.getText(tree)));
        elements.push(node.tagName.getText(tree) + (attrs.length ? ' ' + attrs.join(' ') : ''));
      }
      if (ts.isCallExpression(node) && /(?:\bcreateElement(?:NS)?|\belement|\.(?:setProperty|removeProperty)|\.insertAdjacentHTML|\.classList\.(?:add|remove|toggle|replace)|\.setAttribute)$/u.test(node.expression.getText(tree))) {
        const name = node.expression.getText(tree);
        const args = node.arguments;
        if (!name.endsWith('.setAttribute') || args[0]?.getText(tree).match(/^['"](?:class|style|role|type|data-[\w-]+)['"]$/u)) {
          script.push(normalize(name + '(' + args.map(n => n.getText(tree)).slice(0, name.endsWith('element') ? 1 : 2).join(', ') + ')'));
        }
      }
      if (ts.isBinaryExpression(node) && /(?:\.(?:className|innerHTML|outerHTML)|(?:^|\.)style\.[\w]+|\.dataset\.[\w]+)$/u.test(node.left.getText(tree))) script.push(normalize(node.getText(tree)));
      if (ts.isPropertyAssignment(node) && /^(?:className|tagName)$/u.test(node.name.getText(tree))) script.push(normalize(node.getText(tree)));
      if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && /<[a-z][\w-]*[\s>]/u.test(node.text)) markup.push(node.text);
      if (ts.isTemplateExpression(node)) { const value = node.head.text + node.templateSpans.map(span => '__expression__' + span.literal.text).join(''); if (/<[a-z][\w-]*[\s>]/u.test(value)) markup.push(value); }
      ts.forEachChild(node, walk);
    };
    walk(tree);
  };
  if (path.endsWith('.css')) css(source);
  else if (path.endsWith('.astro')) {
    const { ast, diagnostics } = await parseAstro(source);
    const failures = diagnostics.filter(item => item.severity === 1);
    if (failures.length) throw new Error(`Astro inventory parse failed: ${path}: ${JSON.stringify(failures)}`);
    const walk = node => {
      if (node.type === 'element' || node.type === 'component' || node.type === 'custom-element' || node.type === 'fragment') {
        if (node.name === 'style') { css(node.children.map(n => n.value ?? '').join('')); return; }
        if (node.name === 'script') { code(node.children.map(n => n.value ?? '').join('')); return; }
        const attrs = node.attributes.filter(a => a.kind === 'spread' || relevantAttributes.test(a.name)).map(a => a.name + (a.kind === 'empty' ? '' : '=' + (a.kind === 'expression' ? '{' + normalize(a.value) + '}' : JSON.stringify(a.value))));
        elements.push(node.name + (attrs.length ? ' ' + attrs.join(' ') : ''));
      }
      if (node.type === 'frontmatter') code(node.value);
      for (const child of node.children ?? []) walk(child);
    };
    walk(ast);
  } else code(source);
  const count = values => Object.fromEntries(sorted(values).map(value => [value, values.filter(v => v === value).length]));
  // Concatenated HTML often leaves individual string literals unclosed. Record
  // tag/class fragments instead of pretending those fragments form a full DOM.
  for (const text of markup) {
    for (const match of text.matchAll(/<([a-z][\w-]*)([^<>]*)/gu)) {
      const classes = /\bclass=["']([^"']*)["']/u.exec(match[2]);
      const attributes = [...match[2].matchAll(/\b(data-[\w-]+|role|type)\s*=/gu)].map(m => m[1]);
      script.push('markup: ' + match[1] + (classes ? ' class=' + classes[1] : '') + (attributes.length ? ' ' + attributes.join(' ') : ''));
    }
  }
  return { elements: count(elements), rules, conditions: sorted(conditions), script: script.sort() };
}

export async function collectPresentation(root) {
  const result = {};
  const walk = async directory => {
    for (const entry of (await readdir(join(root, directory), {withFileTypes:true})).sort((a,b) => a.name.localeCompare(b.name))) {
      const path = directory + '/' + entry.name;
      if (entry.isDirectory()) { if (!['apps/site/src/content','apps/site/src/content-registry'].includes(path)) await walk(path); continue; }
      if (!/\.(?:astro|css|tsx|ts|mjs|js)$/u.test(path) || /(?:\.test\.|\.d\.(?:ts|mts)$)/u.test(path)) continue;
      const source = await readFile(join(root, path), 'utf8');
      const surface = await inspectPresentation(path, source);
      // All templates and styles are owned, even if they currently have no elements.
      // Runtime emitters are discovered by parsed DOM/JSX operations, not a hand-picked list.
      if (/\.(?:astro|css|tsx)$/u.test(path) || surface.script.length) result[path] = surface;
    }
  };
  await walk('apps/site/src');
  await walk('apps/site/public/scripts');
  await walk('packages/portable-content/src');
  return Object.fromEntries(Object.entries(result).sort(([a],[b]) => a.localeCompare(b)));
}

export async function checkPresentation(root, {write=false}={}) {
  const path = join(root, 'apps/site/src/styles/design-inventory.json');
  const actual = await collectPresentation(root);
  if (write) await writeFile(path, JSON.stringify(actual, null, 2) + '\n');
  else {
    const expected = JSON.parse(await readFile(path, 'utf8'));
    const changed = sorted([...Object.keys(actual), ...Object.keys(expected)]).filter(key => JSON.stringify(actual[key]) !== JSON.stringify(expected[key]));
    if (changed.length) throw new Error('Presentation inventory changed. Review roles, exceptions and browser coverage, then run design:inventory:write:\n' + changed.join('\n'));
  }
  return Object.keys(actual).length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = fileURLToPath(new URL('../..', import.meta.url));
  const count = await checkPresentation(root, {write: process.argv.includes('--write')});
  console.log(`Design inventory ${process.argv.includes('--write') ? 'written' : 'PASS'}: ${count} presentation sources`);
}

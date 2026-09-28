import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { matchesGlob } from 'node:path';
import { pathToFileURL } from 'node:url';
export function commandChanged(before, after, command) {
  const closure = (pkg, name, seen = new Set()) => {
    if (seen.has(name)) throw new Error('Script cycle');
    seen.add(name);
    const value = pkg.scripts[name];
    if (typeof value !== 'string') throw new Error('Missing script');
    return [value, ...[...value.matchAll(/npm run ([\w:-]+)/g)].flatMap(m => closure(pkg, m[1], new Set(seen)))];
  };
  return JSON.stringify(closure(before, command)) !== JSON.stringify(closure(after, command))
    || ['engines', 'packageManager', 'dependencies', 'devDependencies', 'overrides', 'workspaces'].some(k => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
const [workflow, command] = process.argv.slice(2);
let required = true;
const base = process.env.DIFF_BASE;
if (process.env.EVENT_NAME !== 'workflow_dispatch' && /^[a-f0-9]{40}$/.test(base ?? '') && !/^0+$/.test(base)) {
  try {
    const paths = execFileSync('git', ['diff', '--name-only', '-z', base, 'HEAD'], { encoding: 'utf8' }).split('\0').filter(Boolean);
    const patterns = [...readFileSync(workflow, 'utf8').matchAll(/^      - "([^"]+)"$/gm)].map(m => m[1]).filter(p => p !== 'package.json');
    const before = JSON.parse(execFileSync('git', ['show', `${base}:package.json`], { encoding: 'utf8' }));
    const after = JSON.parse(readFileSync('package.json', 'utf8'));
    required = paths.some(p => patterns.some(pattern => matchesGlob(p, pattern)))
      || commandChanged(before, after, command);
  } catch { /* Unknown inputs fail open to validation, never skip. */ }
}
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `required=${required}\n`);
console.log(required ? 'PASS: affected validation required' : 'NOT_APPLICABLE: conditional command and its inputs unchanged');

}

import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Only prose is exempt. Machine-readable migration evidence and all unknown paths run core.
export function classify(paths) {
  const docsOnly = paths.length > 0 && paths.every(p => /^(?:docs\/.*\.md|README\.md|AGENTS\.md|\.agents\/README\.md)$/.test(p)
    && !p.startsWith('docs/migration/') && p !== 'docs/architecture/infrastructure-handoff.md');
  return { core: !docsOnly, reason: docsOnly ? 'NOT_APPLICABLE: prose-only change; site build count=0' : 'Core validation required: runtime/shared/unknown input' };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let paths = [];
  let resolvedBase = false;
  const base = process.env.DIFF_BASE;
  if (base && /^[a-f0-9]{40}$/.test(base) && !/^0+$/.test(base)) {
    try { paths = execFileSync('git', ['diff', '--name-only', '-z', base, 'HEAD'], { encoding: 'utf8' }).split('\0').filter(Boolean); resolvedBase = true; } catch { /* Unknown => core. */ }
  }
  const result = classify(paths);
  execFileSync('git', resolvedBase ? ['diff', '--check', base, 'HEAD'] : ['show', '--format=', '--check', 'HEAD'], { stdio: 'inherit' });
  for (const path of paths.filter(p => p.endsWith('.md') && existsSync(p))) {
    const prose = readFileSync(path, 'utf8').replace(/^```[^\n]*\n[\s\S]*?^```/gm, '');
    for (const match of prose.matchAll(/\[[^\]]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) {
      const target = match[1].split('#')[0];
      if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
      if (!existsSync(resolve(dirname(path), target))) throw new Error(`Broken local document link: ${path} -> ${target}`);
    }
  }
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `core=${result.core}\nreason=${result.reason}\n`);
  console.log(JSON.stringify(result));
}

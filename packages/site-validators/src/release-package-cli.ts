import { assertReleaseDist } from "./release-dist.js";
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateVnextWranglerConfig } from './deployment-config.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const output = process.env.XPOTATO_RELEASE_PACKAGE;
if (!output || !isAbsolute(output)) throw new Error('XPOTATO_RELEASE_PACKAGE must be a fresh absolute directory');
if (process.platform !== 'linux' || process.env.GITHUB_ACTIONS !== 'true') throw new Error('Release producer requires Hosted Linux Actions');
const env = (name: string) => { const value = process.env[name]; if (!value) throw new Error(`Missing ${name}`); return value; };
const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
if (sourceSha !== env('RELEASE_SOURCE_SHA')) throw new Error('Checkout/source mismatch');
if (env('GITHUB_REPOSITORY') !== 'Xpotato1024/xpotato-site' || env('GITHUB_WORKFLOW') !== 'vNext CI') throw new Error('Unexpected producer');
const config = await readFile(join(root, 'apps/site/wrangler.jsonc'), 'utf8');
const errors = validateVnextWranglerConfig(config, join(root, 'apps/site'));
if (errors.length) throw new Error(errors.join('\n'));
const handoff = await readFile(join(root, 'docs/architecture/infrastructure-handoff.md'), 'utf8');
const serverAuthoritySha = /^revision: ([a-f0-9]{40})$/m.exec(handoff)?.[1];
if (!serverAuthoritySha) throw new Error('Missing Server authority pin');
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8'));
if (pkg.devDependencies.wrangler !== lock.packages['node_modules/wrangler'].version) throw new Error('Wrangler pin mismatch');
await assertReleaseDist(join(root, 'apps/site/dist'));
await mkdir(output); // No overlays, including accidental repeat package assembly.
await mkdir(join(output, 'apps/site'), { recursive: true });
await cp(join(root, 'apps/site/dist'), join(output, 'apps/site/dist'), { recursive: true, dereference: false });
await writeFile(join(output, 'apps/site/wrangler.jsonc'), config, 'utf8');
const run = env('GITHUB_RUN_ID');
const release = {
  schemaVersion: 1, releaseContract: 'xpotato-site-release-v1', repository: env('GITHUB_REPOSITORY'), sourceSha, serverAuthoritySha,
  workflowName: env('GITHUB_WORKFLOW'), workflowPath: '.github/workflows/ci.yml', workflowRunId: run,
  workflowRunAttempt: Number(env('GITHUB_RUN_ATTEMPT')), gitRef: env('GITHUB_REF'), event: env('GITHUB_EVENT_NAME'),
  producerOs: 'Linux', nodeVersion: process.versions.node, npmVersion: /npm\/(\S+)/.exec(env('npm_config_user_agent'))?.[1],
  wranglerVersion: pkg.devDependencies.wrangler, wranglerConfigPath: 'apps/site/wrangler.jsonc',
  productionEligible: env('GITHUB_EVENT_NAME') === 'push' && env('GITHUB_REF') === 'refs/heads/main',
  validation: { source: 'PASS', final: 'PASS', reference: `https://github.com/Xpotato1024/xpotato-site/actions/runs/${run}/attempts/${env('GITHUB_RUN_ATTEMPT')}` },
};
await writeFile(join(output, 'release.json'), JSON.stringify(release, null, 2) + '\n');
console.log(`Release package assembled from the validated build (build count=1): ${output}`);

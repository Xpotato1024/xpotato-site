import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const approval=readFileSync(new URL('../../.github/workflows/environment-approval-check.yml',import.meta.url),'utf8');
const production=readFileSync(new URL('../../.github/workflows/deploy-site.yml',import.meta.url),'utf8');
const policy=readFileSync(new URL('../../.github/workflows/production-path-review.yml',import.meta.url),'utf8');
function verifyApproval(text){
 assert.match(text,/^on:\r?\n  workflow_dispatch:\r?\npermissions:\r?\n  contents: read\r?\njobs:/m);
 assert.ok(!/secrets\.|uses:|CLOUDFLARE|wrangler|npm |curl |fetch\(|pull_request|workflow_run|self-hosted|id-token:|: write/.test(text));
 assert.deepEqual([...text.matchAll(/^  ([a-z][a-z-]+):\s*$/gm)].map(m=>m[1]).filter(n=>!['workflow_dispatch'].includes(n)),['context','approval']);
 assert.match(text,/test "\$ACTOR" = Xpotato1024/);assert.match(text,/test "\$REF" = refs\/heads\/main/);assert.match(text,/test "\$REPOSITORY" = Xpotato1024\/xpotato-site/);
 assert.match(text,/^  approval:\r?\n    needs: context\r?\n    runs-on: ubuntu-latest\r?\n    timeout-minutes: 5\r?\n    environment: site-production\r?\n/m);
 assert.equal((text.match(/\$\{\{/g)||[]).length,3);
 assert.match(text,/run: echo 'PASS - Environment owner approval only; no checkout, secret, artifact, build or deployment\.'/);
}
function verifyProduction(text){
 const jobs=text.split(/^jobs:\s*$/m)[1];assert.ok(jobs);
 const blocks=jobs.split(/^  [a-z][a-z0-9-]*:\s*$/m).slice(1);assert.ok(blocks.length>0);
 for(const block of blocks)assert.match(block,/^    if: \$\{\{ false \}\}$/m);
 assert.ok(!/secrets\.|CLOUDFLARE_API_TOKEN|wrangler deploy|id-token:|pull_request_target/.test(text));
}
test('actual approval workflow is owner/main-only and performs no deployment or credential access',()=>verifyApproval(approval));
test('secret access, checkout, extra work or missing context guard cannot masquerade as approval test',()=>{
 for(const changed of [approval.replace('test "$REF" = refs/heads/main','echo no-main-guard'),approval+'\n      - uses: actions/checkout@v4\n',approval+'\n      - run: echo ${{ secrets.FAKE }}\n',approval.replace('workflow_dispatch:','pull_request:'),approval.replace('needs: context','needs: nonexistent')])assert.throws(()=>verifyApproval(changed));
});
test('every actual production job stays hard blocked without credential access',()=>verifyProduction(production));
test('production activation or privileged credential step fails boundary verification',()=>{
 for(const changed of [production.replace('if: ${{ false }}','if: ${{ true }}'),production+'\n  unexpected:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo unblocked\n',production+'\n      - run: echo ${{ secrets.FAKE }}\n'])assert.throws(()=>verifyProduction(changed));
});
test('required offline-policy performs actual source checks on every PR with read-only hosted permissions',()=>{
 assert.match(policy,/^  pull_request:\s*$/m);assert.ok(!/paths:|environment:|secrets\.|pull_request_target|self-hosted|id-token:|: write/.test(policy));assert.match(policy,/^  offline-policy:\s*$/m);assert.match(policy,/runs-on: ubuntu-latest/);assert.match(policy,/persist-credentials: false/);assert.match(policy,/run: node --test scripts\/release\/environment-approval.test.mjs/);
 for(const [,sha] of policy.matchAll(/uses: actions\/[a-z-]+@([^\s]+)/g))assert.match(sha,/^[a-f0-9]{40}$/);
});

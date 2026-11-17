import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assertManualWorkflow} from './manual-deployment-workflow-policy.mjs';
const production=readFileSync(new URL('../../.github/workflows/deploy-site.yml',import.meta.url),'utf8');
const ci=readFileSync(new URL('../../.github/workflows/ci.yml',import.meta.url),'utf8');
test('actual production path requires owner, main, manual dispatch and protected Environment',()=>assertManualWorkflow(production));
test('missing guards and additional credential jobs cannot bypass production authorization',()=>{for(const changed of [production.replace("github.ref == 'refs/heads/main'",'true'),production+'\n  unexpected:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo unblocked\n',production+'\n      - run: echo ${{ secrets.FAKE }}\n'])assert.throws(()=>assertManualWorkflow(changed));});
test('normal CI owns the real deployment-policy check without synthetic wait jobs',()=>{const policy=ci.split('  offline-policy:')[1].split('  scope:')[0];assert.match(ci,/^  pull_request:/m);assert.match(policy,/runs-on: ubuntu-latest/);assert.match(policy,/persist-credentials: false/);assert.match(policy,/run: node --test ops\/deployment\/environment-approval.test.mjs/);assert.doesNotMatch(policy,/environment:|secrets\.|self-hosted|: write|SYNTHETIC_RECEIPT_TRANSPORT|setTimeout/);for(const [,sha]of policy.matchAll(/uses: actions\/[a-z-]+@([^\s]+)/g))assert.match(sha,/^[a-f0-9]{40}$/);assert.match(ci,/POLICY_RESULT:.*needs.offline-policy.result/);});

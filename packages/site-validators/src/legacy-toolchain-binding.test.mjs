import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLegacyToolchainBinding } from './legacy-toolchain-binding.mjs';
const expected = { frozenBaselineSha256: 'a'.repeat(64), nodeVersion: 'v24.22.1', npmVersion: '11.19.0' };
const observation = { schemaVersion: 1, ...expected, sourceRevision: 'b'.repeat(40), workflowRunId: 39643616911, artifactId: 12367180289, reproductionEvidenceSha256: 'c'.repeat(64) };
test('reviewed patched runtime remains bound to exact frozen baseline and current policy', () => {
  assert.deepEqual(resolveLegacyToolchainBinding(observation, expected), { nodeVersion: 'v24.22.1', npmVersion: '11.19.0' });
});
test('missing, extra or malformed observation cannot bypass the frozen gate', () => {
  for (const binding of [null, [], {}, { ...observation, approved: true }, { ...observation, sourceRevision: 'main' }, { ...observation, workflowRunId: 0 }]) assert.throws(() => resolveLegacyToolchainBinding(binding, expected));
});
test('changed frozen source/output baseline requires a new observation', () => {
  assert.throws(() => resolveLegacyToolchainBinding(observation, { ...expected, frozenBaselineSha256: 'd'.repeat(64) }), /baseline binding mismatch/);
});
test('old or unobserved future runtime is rejected', () => {
  for (const nodeVersion of ['v24.19.0', 'v24.22.2']) assert.throws(() => resolveLegacyToolchainBinding(observation, { ...expected, nodeVersion }), /policy mismatch/);
  assert.throws(() => resolveLegacyToolchainBinding(observation, { ...expected, npmVersion: '11.19.1' }), /policy mismatch/);
});

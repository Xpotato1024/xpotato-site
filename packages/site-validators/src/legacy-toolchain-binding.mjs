// A reviewed security-toolchain observation supplements, and never rewrites, the frozen baseline.
export function resolveLegacyToolchainBinding(binding, expected) {
  if (!binding || typeof binding !== 'object' || Array.isArray(binding)) throw Error('Legacy toolchain binding missing');
  const keys = ['schemaVersion', 'frozenBaselineSha256', 'nodeVersion', 'npmVersion', 'sourceRevision', 'workflowRunId', 'artifactId', 'reproductionEvidenceSha256'];
  if (Object.keys(binding).length !== keys.length || keys.some(k => !Object.hasOwn(binding, k))) throw Error('Invalid legacy toolchain binding fields');
  if (binding.schemaVersion !== 1 || typeof binding.sourceRevision !== 'string' || !/^[a-f0-9]{40}$/.test(binding.sourceRevision)
    || typeof binding.reproductionEvidenceSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(binding.reproductionEvidenceSha256)
    || !Number.isSafeInteger(binding.workflowRunId) || binding.workflowRunId <= 0 || !Number.isSafeInteger(binding.artifactId) || binding.artifactId <= 0) throw Error('Invalid legacy toolchain observation identity');
  if (binding.frozenBaselineSha256 !== expected.frozenBaselineSha256) throw Error('Legacy frozen baseline binding mismatch');
  if (binding.nodeVersion !== expected.nodeVersion || binding.npmVersion !== expected.npmVersion) throw Error('Legacy security toolchain policy mismatch');
  return { nodeVersion: binding.nodeVersion, npmVersion: binding.npmVersion };
}

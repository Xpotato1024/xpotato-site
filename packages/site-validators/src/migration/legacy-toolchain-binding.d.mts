export function resolveLegacyToolchainBinding(binding: unknown, expected: {
  frozenBaselineSha256: string;
  nodeVersion: string;
  npmVersion: string;
}): { nodeVersion: string; npmVersion: string };

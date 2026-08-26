import { exampleSandboxProfileSchema } from "@xpotato/content-contracts";

export const exampleSandboxProfileV1 = exampleSandboxProfileSchema.parse({
  schemaVersion: 1,
  id: "example-sandbox-v1",
  network: "none",
  user: "non-root",
  rootFilesystem: "read-only",
  linuxCapabilities: "none",
  hostDevices: "none",
  hostSockets: "none",
  hostSecretMounts: "none",
  workspace: "tmpfs",
  workspaceMaxBytes: 67_108_864,
  memoryMaxBytes: 268_435_456,
  pidsMax: 32,
  cpuCoresMax: 1,
  wallTimeoutSeconds: 15,
  combinedOutputMaxBytes: 1_048_576,
  environmentAllowlist: ["PATH", "LANG=C.UTF-8", "LC_ALL=C.UTF-8", "TZ=UTC", "HOME=/tmp/home", "TMPDIR=/tmp"],
});

export const verificationProfiles = Object.freeze({
  python: { id: "python-stdlib-v1", mode: "execute", selfContained: true },
  node: { id: "node-self-contained-v1", mode: "execute", selfContained: true },
  sqlite: { id: "sqlite-disposable-v1", mode: "execute", selfContained: true },
  bash: { id: "bash-parse-v1", mode: "parse" },
  powershell: { id: "powershell-parse-v1", mode: "parse" },
  typescript: { id: "typescript-check-v1", mode: "typecheck" },
  json: { id: "json-parse-v1", mode: "parse" },
  yaml: { id: "yaml-parse-v1", mode: "parse" },
  dockerCompose: { id: "docker-compose-config-v1", mode: "parse" },
} as const);

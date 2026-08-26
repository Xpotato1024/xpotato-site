import { describe, expect, it } from "vitest";
import type { ExternalAiDisclosureManifest, SemanticRequestEnvelope, SemanticResponseEnvelope } from "@xpotato/content-contracts";
import { fingerprint } from "./canonical.js";
import { currentExternalAiPolicyBinding } from "./disclosure.js";
import { assertExternalSemanticResponseLineage } from "./semantic-provider.js";

const hash = (character: string): string => character.repeat(64);

const unsignedManifest = {
  schemaVersion: 1 as const,
  jobId: "job-1",
  jobFingerprint: hash("a"),
  requestId: "request-1",
  stage: "author" as const,
  policyId: currentExternalAiPolicyBinding.policyId,
  policySha256: currentExternalAiPolicyBinding.policySha256,
  entries: [],
  secretScanResultSha256: hash("b"),
};
const manifest: ExternalAiDisclosureManifest = {
  ...unsignedManifest,
  manifestSha256: fingerprint(unsignedManifest),
};
const request = {
  schemaVersion: 1,
  requestId: "request-1",
  jobId: "job-1",
  jobFingerprint: hash("a"),
  stage: "author",
  inputArtifacts: [],
  skill: { skillId: "author-v1", skillSha256: hash("c"), referenceBundleSha256: hash("d") },
  responseSchema: { schemaId: "article-v1", schemaSha256: hash("e") },
  constraints: { maxOutputBytes: 1024, publicSafetyRequired: true, externalFactPolicy: "fixed_sources_only" },
  executionMode: "external",
  externalAiDisclosureManifestSha256: manifest.manifestSha256,
  requestSha256: hash("f"),
} satisfies SemanticRequestEnvelope;

const response = {
  schemaVersion: 1,
  requestSha256: request.requestSha256,
  stage: "author",
  response: {},
  runner: {
    provider: "fixture-provider",
    model: "fixture-model",
    executionProfileId: "semantic-v1",
    providerProfileId: "fixture-v1",
    externalAiDisclosureManifestSha256: manifest.manifestSha256,
    startedAt: "2026-08-26T00:00:00Z",
    finishedAt: "2026-08-26T00:00:01Z",
    externalApiUsed: true,
    warnings: [],
  },
} satisfies SemanticResponseEnvelope;

describe("external semantic response lineage", () => {
  it("preserves the request and disclosure manifest binding", () => {
    expect(() => assertExternalSemanticResponseLineage(request, manifest, response)).not.toThrow();
  });

  it("rejects a response/run with a different disclosure manifest", () => {
    const forged = {
      ...response,
      runner: { ...response.runner, externalAiDisclosureManifestSha256: hash("0") },
    };
    expect(() => assertExternalSemanticResponseLineage(request, manifest, forged)).toThrow(/manifest binding mismatch/);
  });
});

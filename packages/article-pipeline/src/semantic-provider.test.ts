import { describe, expect, it } from "vitest";
import type { ExternalAiDisclosureManifest, SemanticRequestEnvelope, SemanticResponseEnvelope } from "@xpotato/content-contracts";
import { fingerprint } from "./canonical.js";
import { currentExternalAiPolicyBinding } from "./disclosure.js";
import {
  assertExternalSemanticResponseLineage,
  fingerprintSemanticRequest,
  importExternalSemanticResponse,
  type UnsignedSemanticRequestEnvelope,
} from "./semantic-provider.js";

const hash = (character: string): string => character.repeat(64);

const makeManifest = (
  overrides: Partial<Omit<ExternalAiDisclosureManifest, "manifestSha256">> = {},
): ExternalAiDisclosureManifest => {
  const unsigned = {
    schemaVersion: 1 as const,
    jobId: "job-1",
    jobFingerprint: hash("a"),
    requestId: "request-1",
    stage: "author" as const,
    policyId: currentExternalAiPolicyBinding.policyId,
    policySha256: currentExternalAiPolicyBinding.policySha256,
    entries: [],
    secretScanResultSha256: hash("b"),
    ...overrides,
  };
  return { ...unsigned, manifestSha256: fingerprint(unsigned) };
};

const makeRequest = (
  manifest: ExternalAiDisclosureManifest,
  overrides: Partial<UnsignedSemanticRequestEnvelope> = {},
): SemanticRequestEnvelope => {
  const unsigned = {
    schemaVersion: 1 as const,
    requestId: "request-1",
    jobId: "job-1",
    jobFingerprint: hash("a"),
    stage: "author" as const,
    inputArtifacts: [],
    skill: { skillId: "author-v1", skillSha256: hash("c"), referenceBundleSha256: hash("d") },
    responseSchema: { schemaId: "article-v1", schemaSha256: hash("e") },
    constraints: { maxOutputBytes: 1024, publicSafetyRequired: true, externalFactPolicy: "fixed_sources_only" as const },
    executionMode: "external" as const,
    externalAiDisclosureManifestSha256: manifest.manifestSha256,
    ...overrides,
  } satisfies UnsignedSemanticRequestEnvelope;
  return { ...unsigned, requestSha256: fingerprintSemanticRequest(unsigned) };
};

const makeResponse = (
  request: SemanticRequestEnvelope,
  manifest: ExternalAiDisclosureManifest,
  overrides: Partial<SemanticResponseEnvelope> = {},
): SemanticResponseEnvelope => ({
  schemaVersion: 1,
  requestSha256: request.requestSha256,
  stage: request.stage,
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
  ...overrides,
});

describe("external semantic request/response lineage", () => {
  it("accepts valid exact request, job, stage, and disclosure lineage", () => {
    const manifest = makeManifest();
    const request = makeRequest(manifest);
    const response = makeResponse(request, manifest);
    expect(assertExternalSemanticResponseLineage(request, manifest, response)).toEqual(response);
  });

  it("rejects a forged requestSha256", () => {
    const manifest = makeManifest();
    const request = { ...makeRequest(manifest), requestSha256: hash("f") };
    expect(() => assertExternalSemanticResponseLineage(request, manifest, makeResponse(request, manifest))).toThrow(/request fingerprint mismatch/);
  });

  it("rejects a response stage mismatch", () => {
    const manifest = makeManifest();
    const request = makeRequest(manifest);
    expect(() => assertExternalSemanticResponseLineage(request, manifest, makeResponse(request, manifest, { stage: "revision" }))).toThrow(/response stage mismatch/);
  });

  it("rejects a disclosure manifest stage mismatch", () => {
    const manifest = makeManifest({ stage: "revision" });
    const request = makeRequest(manifest);
    expect(() => assertExternalSemanticResponseLineage(request, manifest, makeResponse(request, manifest))).toThrow(/manifest stage mismatch/);
  });

  it("rejects a request/manifest job binding mismatch", () => {
    const manifest = makeManifest({ jobId: "job-2" });
    const request = makeRequest(manifest);
    expect(() => assertExternalSemanticResponseLineage(request, manifest, makeResponse(request, manifest))).toThrow(/manifest job binding mismatch/);
  });

  it("rejects a response request hash mismatch", () => {
    const manifest = makeManifest();
    const request = makeRequest(manifest);
    expect(() => assertExternalSemanticResponseLineage(request, manifest, makeResponse(request, manifest, { requestSha256: hash("0") }))).toThrow(/response request binding mismatch/);
  });

  it("rejects a response disclosure manifest mismatch", () => {
    const manifest = makeManifest();
    const request = makeRequest(manifest);
    const response = makeResponse(request, manifest);
    const forged = { ...response, runner: { ...response.runner, externalAiDisclosureManifestSha256: hash("0") } };
    expect(() => assertExternalSemanticResponseLineage(request, manifest, forged)).toThrow(/response disclosure manifest binding mismatch/);
  });

  it("strictly rejects unknown response envelope fields", () => {
    const manifest = makeManifest();
    const request = makeRequest(manifest);
    expect(() => assertExternalSemanticResponseLineage(request, manifest, { ...makeResponse(request, manifest), unexpected: true })).toThrow();
  });

  it("imports only bounded valid UTF-8 JSON response bytes", () => {
    const manifest = makeManifest();
    const request = makeRequest(manifest);
    const response = makeResponse(request, manifest);
    expect(importExternalSemanticResponse(request, manifest, new TextEncoder().encode(JSON.stringify(response)))).toEqual(response);
    expect(() => importExternalSemanticResponse(request, manifest, new Uint8Array([0xff]))).toThrow(/valid UTF-8/);
    const boundedRequest = makeRequest(manifest, {
      constraints: { ...request.constraints, maxOutputBytes: 1 },
    });
    expect(() => importExternalSemanticResponse(boundedRequest, manifest, new TextEncoder().encode(JSON.stringify(response)))).toThrow(/maxOutputBytes/);
  });
});

import type {
  ExternalAiDisclosureManifest,
  SemanticRequestEnvelope,
  SemanticResponseEnvelope,
} from "@xpotato/content-contracts";
import { assertProviderPayloadIntegrity, verifyDisclosureManifest, type ProviderPayload } from "./disclosure.js";

export interface ProviderNeutralSemanticResponse {
  readonly responseBytes: Uint8Array;
  readonly requestSha256: string;
  readonly externalAiDisclosureManifestSha256: string;
  readonly providerRunId?: string;
  readonly modelIdentity: Readonly<{ providerProfileId: string; modelProfileId: string; snapshot?: string }>;
}

export interface ProviderNeutralSemanticAdapter {
  execute(
    request: SemanticRequestEnvelope,
    manifest: ExternalAiDisclosureManifest,
    payload: ProviderPayload,
  ): Promise<ProviderNeutralSemanticResponse>;
}

export const assertAdmittedSemanticInvocation = (
  request: SemanticRequestEnvelope,
  manifest: ExternalAiDisclosureManifest,
  payload: ProviderPayload,
): void => {
  verifyDisclosureManifest(manifest);
  if (request.executionMode !== "external") throw new Error("External adapter requires an external request envelope");
  if (request.externalAiDisclosureManifestSha256 !== manifest.manifestSha256) throw new Error("Request disclosure manifest binding mismatch");
  if (payload.manifestSha256 !== manifest.manifestSha256) throw new Error("Transport disclosure manifest binding mismatch");
  if (request.jobId !== manifest.jobId || request.jobFingerprint !== manifest.jobFingerprint) throw new Error("Disclosure manifest job binding mismatch");
  if (request.stage !== manifest.stage) throw new Error("Disclosure manifest stage mismatch");
  assertProviderPayloadIntegrity(manifest, payload);
};

export const assertExternalSemanticResponseLineage = (
  request: SemanticRequestEnvelope,
  manifest: ExternalAiDisclosureManifest,
  response: SemanticResponseEnvelope | ProviderNeutralSemanticResponse,
): void => {
  if (response.requestSha256 !== request.requestSha256) throw new Error("Semantic response request binding mismatch");
  const responseManifestSha256 =
    "runner" in response
      ? response.runner.externalAiDisclosureManifestSha256
      : response.externalAiDisclosureManifestSha256;
  if (responseManifestSha256 !== manifest.manifestSha256) {
    throw new Error("Semantic response disclosure manifest binding mismatch");
  }
};

// Provider/model selection remains in versioned profiles; this package enables no live provider by default.
export const liveSemanticProviderEnabled = false as const;

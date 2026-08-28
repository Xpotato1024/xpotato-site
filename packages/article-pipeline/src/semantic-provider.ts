import {
  semanticRequestEnvelopeSchema,
  semanticResponseEnvelopeSchema,
  type ExternalAiDisclosureManifest,
  type SemanticRequestEnvelope,
  type SemanticResponseEnvelope,
} from "@xpotato/content-contracts";
import { fingerprint } from "./canonical.js";
import { assertProviderPayloadIntegrity, verifyDisclosureManifest, type ProviderPayload } from "./disclosure.js";

export type UnsignedSemanticRequestEnvelope = Omit<SemanticRequestEnvelope, "requestSha256">;

export const fingerprintSemanticRequest = (
  request: SemanticRequestEnvelope | UnsignedSemanticRequestEnvelope,
): string => {
  const { requestSha256: _requestSha256, ...unsignedRequest } = request as SemanticRequestEnvelope;
  return fingerprint(unsignedRequest);
};

export const verifySemanticRequest = (request: unknown): SemanticRequestEnvelope => {
  const parsed = semanticRequestEnvelopeSchema.parse(request);
  if (parsed.requestSha256 !== fingerprintSemanticRequest(parsed)) {
    throw new Error("Semantic request fingerprint mismatch");
  }
  return parsed;
};

const assertRequestManifestLineage = (
  request: SemanticRequestEnvelope,
  manifest: ExternalAiDisclosureManifest,
): void => {
  verifyDisclosureManifest(manifest);
  if (request.executionMode !== "external") throw new Error("External adapter requires an external request envelope");
  if (request.externalAiDisclosureManifestSha256 !== manifest.manifestSha256) throw new Error("Request disclosure manifest binding mismatch");
  if (request.jobId !== manifest.jobId || request.jobFingerprint !== manifest.jobFingerprint) throw new Error("Disclosure manifest job binding mismatch");
  if (request.requestId !== manifest.requestId) throw new Error("Disclosure manifest request binding mismatch");
  if (request.stage !== manifest.stage) throw new Error("Disclosure manifest stage mismatch");
};

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
  request: unknown,
  manifest: ExternalAiDisclosureManifest,
  payload: ProviderPayload,
): void => {
  const parsedRequest = verifySemanticRequest(request);
  assertRequestManifestLineage(parsedRequest, manifest);
  if (payload.manifestSha256 !== manifest.manifestSha256) throw new Error("Transport disclosure manifest binding mismatch");
  assertProviderPayloadIntegrity(manifest, payload);
};

export const assertExternalSemanticResponseLineage = (
  request: unknown,
  manifest: ExternalAiDisclosureManifest,
  response: unknown,
): SemanticResponseEnvelope => {
  const parsedRequest = verifySemanticRequest(request);
  assertRequestManifestLineage(parsedRequest, manifest);
  const parsedResponse = semanticResponseEnvelopeSchema.parse(response);
  if (parsedResponse.requestSha256 !== parsedRequest.requestSha256) throw new Error("Semantic response request binding mismatch");
  if (parsedResponse.stage !== parsedRequest.stage) throw new Error("Semantic response stage mismatch");
  if (!parsedResponse.runner.externalApiUsed) throw new Error("External semantic response must record external API use");
  if (parsedResponse.runner.externalAiDisclosureManifestSha256 !== manifest.manifestSha256) {
    throw new Error("Semantic response disclosure manifest binding mismatch");
  }
  return parsedResponse;
};

export const importExternalSemanticResponse = (
  request: unknown,
  manifest: ExternalAiDisclosureManifest,
  responseBytes: Uint8Array,
): SemanticResponseEnvelope => {
  const parsedRequest = verifySemanticRequest(request);
  if (responseBytes.byteLength > parsedRequest.constraints.maxOutputBytes) {
    throw new Error("Semantic response exceeds maxOutputBytes");
  }
  let decoded: string;
  try {
    decoded = new TextDecoder("utf-8", { fatal: true }).decode(responseBytes);
  } catch {
    throw new Error("Semantic response must be valid UTF-8");
  }
  let response: unknown;
  try {
    response = JSON.parse(decoded) as unknown;
  } catch {
    throw new Error("Semantic response must be valid JSON");
  }
  return assertExternalSemanticResponseLineage(parsedRequest, manifest, response);
};

// Provider/model selection remains in versioned profiles; this package enables no live provider by default.
export const liveSemanticProviderEnabled = false as const;

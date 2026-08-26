import type {
  ExternalAiDisclosureManifest,
  SemanticRequestEnvelope,
} from "@xpotato/content-contracts";
import type { ProviderPayload } from "./disclosure.js";

export interface ProviderNeutralSemanticResponse {
  readonly responseBytes: Uint8Array;
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
  if (request.executionMode !== "external") throw new Error("External adapter requires an external request envelope");
  if (request.externalAiDisclosureManifestSha256 !== manifest.manifestSha256) throw new Error("Request disclosure manifest binding mismatch");
  if (payload.manifestSha256 !== manifest.manifestSha256) throw new Error("Transport disclosure manifest binding mismatch");
  if (request.stage !== manifest.stage) throw new Error("Disclosure manifest stage mismatch");
};

// Provider/model selection remains in versioned profiles; this package enables no live provider by default.
export const liveSemanticProviderEnabled = false as const;

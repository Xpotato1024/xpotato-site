import {
  externalAiDisclosureManifestSchema,
  externalAiDisclosureProfileV1,
  type ExternalAiAdmissionClass,
  type ExternalAiDisclosureManifest,
  type ExternalAiDisclosureRecord,
} from "@xpotato/content-contracts";
import { fingerprint, sha256 } from "./canonical.js";

export interface OutboundArtifact {
  readonly artifactId: string;
  readonly sha256: string;
  readonly bytes: Uint8Array;
  readonly required: boolean;
  readonly admissionClass: ExternalAiAdmissionClass;
  readonly disclosureRecord: ExternalAiDisclosureRecord;
  readonly disclosureRecordSha256: string;
  readonly anonymousHttpsVerified?: boolean;
  readonly pinnedPublicRevisionVerified?: boolean;
  readonly isDerived?: boolean;
  readonly rawSourceBytes?: boolean;
  readonly sourceSubjectSha256?: string;
}

export interface DisclosureCompilationInput {
  readonly jobId: string;
  readonly jobFingerprint: string;
  readonly requestId: string;
  readonly stage: ExternalAiDisclosureManifest["stage"];
  readonly providerPermission: Readonly<{ externalTextAI: boolean; externalImageAI: boolean }>;
  readonly artifacts: readonly OutboundArtifact[];
}

const decoder = new TextDecoder("utf-8", { fatal: false });
const hardDenyPatterns: readonly RegExp[] = [
  /authorization\s*:/iu,
  /(?:^|\r?\n)\s*(?:cookie|set-cookie)\s*:/iu,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u,
  /(?:api[_-]?token|password|session[_-]?cookie|mfa[_-]?code|recovery[_-]?code)\s*[:=]/iu,
  /(?:X-Amz-Signature|X-Goog-Signature|CloudFront-Signature|[?&](?:signature|sig|token))=/iu,
];

export const containsHardDenyMaterial = (bytes: Uint8Array): boolean => {
  const text = decoder.decode(bytes);
  return hardDenyPatterns.some((pattern) => pattern.test(text));
};

const isConditionallyVerified = (artifact: OutboundArtifact): boolean =>
  artifact.admissionClass === "public_anonymous_web_v1"
    ? artifact.anonymousHttpsVerified === true
    : artifact.admissionClass === "public_github_revision_v1"
      ? artifact.pinnedPublicRevisionVerified === true
      : true;

const resolveMode = (artifact: OutboundArtifact): "exact" | "derived" => {
  const policy = externalAiDisclosureProfileV1.classes[artifact.admissionClass];
  if (policy.hardDeny || artifact.disclosureRecord.mode === "deny") {
    throw new Error(`Disclosure denied for ${artifact.artifactId}`);
  }
  if (
    policy.requiresExplicitAuthorization &&
    (artifact.disclosureRecord.basis !== "user_authorized" || artifact.disclosureRecord.authorizedBy !== "user")
  ) {
    throw new Error(`Exact explicit authorization missing for ${artifact.artifactId}`);
  }
  if (!isConditionallyVerified(artifact)) throw new Error(`Conditional admission not verified for ${artifact.artifactId}`);
  if (artifact.disclosureRecord.subject.sha256 !== artifact.sha256) {
    throw new Error(`Stale disclosure record for ${artifact.artifactId}`);
  }
  if (artifact.disclosureRecord.policyId !== externalAiDisclosureProfileV1.id) {
    throw new Error(`Disclosure policy mismatch for ${artifact.artifactId}`);
  }
  if (sha256(artifact.bytes) !== artifact.sha256) throw new Error(`Artifact hash mismatch for ${artifact.artifactId}`);
  if (containsHardDenyMaterial(artifact.bytes)) throw new Error(`Hard-deny material in ${artifact.artifactId}`);
  if (artifact.disclosureRecord.mode === "allow_derived_only") {
    if (!artifact.isDerived || artifact.rawSourceBytes || !artifact.sourceSubjectSha256) {
      throw new Error(`Derived-only admission excludes raw bytes for ${artifact.artifactId}`);
    }
    return "derived";
  }
  return "exact";
};

export class DisclosureAdmissionError extends Error {
  readonly outcome = "BLOCKED" as const;
}

export const compileDisclosureManifest = (input: DisclosureCompilationInput): ExternalAiDisclosureManifest => {
  const permitted = input.stage === "image_generation" ? input.providerPermission.externalImageAI : input.providerPermission.externalTextAI;
  if (!permitted) throw new DisclosureAdmissionError(`Provider use is disabled for ${input.stage}`);

  try {
    const entries = input.artifacts.map((artifact) => ({
      requestArtifactId: artifact.artifactId,
      requestArtifactSha256: artifact.sha256,
      disclosureRecordSha256: artifact.disclosureRecordSha256,
      ...(artifact.sourceSubjectSha256 ? { sourceSubjectSha256: artifact.sourceSubjectSha256 } : {}),
      modeUsed: resolveMode(artifact),
    }));
    const unsigned = {
      schemaVersion: 1 as const,
      jobId: input.jobId,
      jobFingerprint: input.jobFingerprint,
      requestId: input.requestId,
      stage: input.stage,
      policyId: externalAiDisclosureProfileV1.id,
      policySha256: input.artifacts[0]?.disclosureRecord.policySha256 ?? fingerprint(externalAiDisclosureProfileV1),
      entries,
      secretScanResultSha256: fingerprint(entries.map((entry) => ({ id: entry.requestArtifactId, pass: true }))),
    };
    return externalAiDisclosureManifestSchema.parse({ ...unsigned, manifestSha256: fingerprint(unsigned) });
  } catch (error) {
    const required = input.artifacts.some((artifact) => artifact.required);
    throw new DisclosureAdmissionError(`${required ? "Required evidence unavailable" : "Input denied"}: ${(error as Error).message}`);
  }
};

export interface ProviderPayload {
  readonly manifestSha256: string;
  readonly artifacts: readonly Readonly<{ artifactId: string; sha256: string; bytes: Uint8Array }>[];
}

export const createProviderPayload = (
  manifest: ExternalAiDisclosureManifest,
  artifacts: readonly Readonly<{ artifactId: string; sha256: string; bytes: Uint8Array }>[],
): ProviderPayload => {
  const manifestSet = [...manifest.entries].map((item) => `${item.requestArtifactId}:${item.requestArtifactSha256}`).sort();
  const actualSet = artifacts.map((item) => `${item.artifactId}:${item.sha256}`).sort();
  if (manifestSet.length !== actualSet.length || manifestSet.some((item, index) => item !== actualSet[index])) {
    throw new DisclosureAdmissionError("Manifest entry set does not equal outbound artifact set");
  }
  for (const artifact of artifacts) {
    if (sha256(artifact.bytes) !== artifact.sha256) throw new DisclosureAdmissionError(`Outbound bytes changed for ${artifact.artifactId}`);
  }
  return Object.freeze({ manifestSha256: manifest.manifestSha256, artifacts: Object.freeze([...artifacts]) });
};

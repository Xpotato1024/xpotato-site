import {
  articleJobSpecSchema,
  externalAiAdmissionProvenanceSchema,
  externalAiDisclosureManifestSchema,
  externalAiDisclosureProfileV1,
  externalAiDisclosureRecordSchema,
  type ArticleJobSpec,
  type ExternalAiAdmissionClass,
  type ExternalAiAdmissionProvenance,
  type ExternalAiDisclosureManifest,
  type ExternalAiDisclosureRecord,
} from "@xpotato/content-contracts";
import { compareCanonicalKeys, fingerprint, sha256 } from "./canonical.js";

export const currentExternalAiPolicyBinding = Object.freeze({
  policyId: externalAiDisclosureProfileV1.id,
  policySha256: fingerprint(externalAiDisclosureProfileV1),
});

export interface OutboundArtifact {
  readonly artifactId: string;
  readonly sha256: string;
  readonly bytes: Uint8Array;
  readonly required: boolean;
  readonly admissionProvenance: ExternalAiAdmissionProvenance;
  readonly admissionProvenanceSha256: string;
  readonly disclosureRecord: ExternalAiDisclosureRecord;
  readonly disclosureRecordSha256: string;
}

export interface DisclosureCompilationInput {
  readonly jobSpec: ArticleJobSpec;
  readonly requestId: string;
  readonly stage: ExternalAiDisclosureManifest["stage"];
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

const containsCapabilityUrl = (value: string): boolean =>
  /(?:X-Amz-Signature|X-Goog-Signature|CloudFront-Signature|[?&](?:signature|sig|token))=/iu.test(value);

const admissionClassFor = (provenance: ExternalAiAdmissionProvenance): ExternalAiAdmissionClass => {
  switch (provenance.kind) {
    case "public_anonymous_https_acquisition_v1":
      return "public_anonymous_web_v1";
    case "public_github_revision_acquisition_v1":
      return "public_github_revision_v1";
    case "article_job_input_v1":
      return provenance.inputClass;
    case "approved_publication_derivative_lineage_v1":
      return "approved_publication_derivative_v1";
    case "secret_or_capability_detection_v1":
      return "secret_or_capability_material_v1";
    case "unknown_v1":
      return "unknown_v1";
  }
};

const provenanceArtifactSha256 = (provenance: ExternalAiAdmissionProvenance): string =>
  provenance.kind === "approved_publication_derivative_lineage_v1"
    ? provenance.derivativeSha256
    : provenance.artifactSha256;

const assertCurrentPolicy = (spec: ArticleJobSpec): void => {
  const binding = spec.externalAiDisclosure.policy;
  if (binding.policyId !== currentExternalAiPolicyBinding.policyId) {
    throw new Error("ArticleJobSpec disclosure policy ID is not current");
  }
  if (binding.policySha256 !== currentExternalAiPolicyBinding.policySha256) {
    throw new Error("ArticleJobSpec disclosure policy SHA-256 is not current");
  }
};

const assertAdmissionProvenance = (
  artifact: OutboundArtifact,
  provenance: ExternalAiAdmissionProvenance,
  stage: ExternalAiDisclosureManifest["stage"],
): void => {
  if (artifact.admissionProvenanceSha256 !== fingerprint(provenance)) {
    throw new Error(`Admission provenance hash mismatch for ${artifact.artifactId}`);
  }
  if (provenanceArtifactSha256(provenance) !== artifact.sha256) {
    throw new Error(`Admission provenance artifact mismatch for ${artifact.artifactId}`);
  }
  if (provenance.kind === "public_anonymous_https_acquisition_v1" && containsCapabilityUrl(provenance.finalUrl)) {
    throw new Error(`Capability-bearing public locator denied for ${artifact.artifactId}`);
  }
  if (provenance.kind === "approved_publication_derivative_lineage_v1") {
    if (!provenance.approvedStages.includes(stage)) {
      throw new Error(`Publication derivative purpose is incompatible with ${stage}`);
    }
    if (provenance.sourceSubjectSha256 === provenance.derivativeSha256) {
      throw new Error(`Publication derivative must retain distinct source lineage for ${artifact.artifactId}`);
    }
  }
};

const assertExplicitAuthorization = (
  spec: ArticleJobSpec,
  provenance: Extract<ExternalAiAdmissionProvenance, { kind: "article_job_input_v1" }>,
  record: ExternalAiDisclosureRecord,
): void => {
  if (record.basis !== "user_authorized" || record.authorizedBy !== "user") {
    throw new Error(`Exact explicit authorization missing for ${provenance.inputRef}`);
  }
  const authorization = spec.externalAiDisclosure.explicitAuthorizations.find(
    (item) => item.inputRef === provenance.inputRef && item.requestedMode === record.mode,
  );
  if (!authorization) throw new Error(`ArticleJobSpec authorization missing for ${provenance.inputRef}`);
};

const resolveMode = (
  spec: ArticleJobSpec,
  artifact: OutboundArtifact,
  stage: ExternalAiDisclosureManifest["stage"],
): Readonly<{ modeUsed: "exact" | "derived"; sourceSubjectSha256?: string }> => {
  const provenance = externalAiAdmissionProvenanceSchema.parse(artifact.admissionProvenance);
  assertAdmissionProvenance(artifact, provenance, stage);
  const admissionClass = admissionClassFor(provenance);
  const policy = externalAiDisclosureProfileV1.classes[admissionClass];
  const record = externalAiDisclosureRecordSchema.parse(artifact.disclosureRecord);

  if (artifact.disclosureRecordSha256 !== fingerprint(record)) {
    throw new Error(`Disclosure record hash mismatch for ${artifact.artifactId}`);
  }
  if (record.subject.id !== artifact.artifactId || record.subject.sha256 !== artifact.sha256) {
    throw new Error(`Stale disclosure record for ${artifact.artifactId}`);
  }
  if (
    record.policyId !== currentExternalAiPolicyBinding.policyId ||
    record.policySha256 !== currentExternalAiPolicyBinding.policySha256
  ) {
    throw new Error(`Disclosure policy mismatch for ${artifact.artifactId}`);
  }
  if (policy.hardDeny || admissionClass === "unknown_v1" || admissionClass === "secret_or_capability_material_v1") {
    throw new Error(`Disclosure denied for ${artifact.artifactId}`);
  }
  if (record.mode === "deny") throw new Error(`Disclosure denied for ${artifact.artifactId}`);
  if (sha256(artifact.bytes) !== artifact.sha256) throw new Error(`Artifact hash mismatch for ${artifact.artifactId}`);
  if (containsHardDenyMaterial(artifact.bytes)) throw new Error(`Hard-deny material in ${artifact.artifactId}`);

  if (provenance.kind === "article_job_input_v1") {
    assertExplicitAuthorization(spec, provenance, record);
    if (record.mode === "allow_derived_only") {
      if (provenance.representation !== "derived" || !provenance.sourceSubjectSha256) {
        throw new Error(`Derived-only admission excludes raw bytes for ${artifact.artifactId}`);
      }
      return { modeUsed: "derived", sourceSubjectSha256: provenance.sourceSubjectSha256 };
    }
    if (provenance.representation !== "raw") {
      throw new Error(`allow_exact job input must bind the exact authorized subject for ${artifact.artifactId}`);
    }
    return { modeUsed: "exact" };
  }

  if (record.mode !== "allow_exact" || record.basis !== policy.basis) {
    throw new Error(`Admission mode/basis does not match frozen policy for ${artifact.artifactId}`);
  }
  return { modeUsed: "exact" };
};

export class DisclosureAdmissionError extends Error {
  readonly outcome = "BLOCKED" as const;
}

const unsignedManifest = (manifest: ExternalAiDisclosureManifest): Omit<ExternalAiDisclosureManifest, "manifestSha256"> => {
  const { manifestSha256: _manifestSha256, ...unsigned } = manifest;
  return unsigned;
};

export const verifyDisclosureManifest = (manifestInput: ExternalAiDisclosureManifest): ExternalAiDisclosureManifest => {
  const manifest = externalAiDisclosureManifestSchema.parse(manifestInput);
  if (
    manifest.policyId !== currentExternalAiPolicyBinding.policyId ||
    manifest.policySha256 !== currentExternalAiPolicyBinding.policySha256
  ) {
    throw new DisclosureAdmissionError("Disclosure manifest policy is not current");
  }
  if (manifest.manifestSha256 !== fingerprint(unsignedManifest(manifest))) {
    throw new DisclosureAdmissionError("Disclosure manifest hash mismatch");
  }
  return manifest;
};

export const compileDisclosureManifest = (input: DisclosureCompilationInput): ExternalAiDisclosureManifest => {
  const spec = articleJobSpecSchema.parse(input.jobSpec);
  const permitted = input.stage === "image_generation" ? spec.permissions.externalImageAI : spec.permissions.externalTextAI;
  if (!permitted) throw new DisclosureAdmissionError(`Provider use is disabled for ${input.stage}`);

  try {
    assertCurrentPolicy(spec);
    const entries = input.artifacts
      .map((artifact) => {
        const admission = resolveMode(spec, artifact, input.stage);
        return {
          requestArtifactId: artifact.artifactId,
          requestArtifactSha256: artifact.sha256,
          disclosureRecordSha256: artifact.disclosureRecordSha256,
          ...(admission.sourceSubjectSha256 ? { sourceSubjectSha256: admission.sourceSubjectSha256 } : {}),
          modeUsed: admission.modeUsed,
        };
      })
      .sort((left, right) =>
        compareCanonicalKeys(
          `${left.requestArtifactId}:${left.requestArtifactSha256}`,
          `${right.requestArtifactId}:${right.requestArtifactSha256}`,
        ),
      );
    const unsigned = {
      schemaVersion: 1 as const,
      jobId: spec.jobId,
      jobFingerprint: fingerprint(spec),
      requestId: input.requestId,
      stage: input.stage,
      policyId: currentExternalAiPolicyBinding.policyId,
      policySha256: currentExternalAiPolicyBinding.policySha256,
      entries,
      secretScanResultSha256: fingerprint(entries.map((entry) => ({ id: entry.requestArtifactId, pass: true }))),
    };
    return verifyDisclosureManifest(
      externalAiDisclosureManifestSchema.parse({ ...unsigned, manifestSha256: fingerprint(unsigned) }),
    );
  } catch (error) {
    const required = input.artifacts.some((artifact) => artifact.required);
    throw new DisclosureAdmissionError(
      `${required ? "Required evidence unavailable" : "Input denied"}: ${(error as Error).message}`,
    );
  }
};

export interface ProviderPayload {
  readonly manifestSha256: string;
  readonly artifacts: readonly Readonly<{ artifactId: string; sha256: string; bytes: Uint8Array }>[];
}

export const assertProviderPayloadIntegrity = (
  manifestInput: ExternalAiDisclosureManifest,
  payload: ProviderPayload,
): void => {
  const manifest = verifyDisclosureManifest(manifestInput);
  if (payload.manifestSha256 !== manifest.manifestSha256) {
    throw new DisclosureAdmissionError("Transport disclosure manifest binding mismatch");
  }
  const manifestSet = manifest.entries
    .map((item) => `${item.requestArtifactId}:${item.requestArtifactSha256}`)
    .sort(compareCanonicalKeys);
  const actualSet = payload.artifacts.map((item) => `${item.artifactId}:${item.sha256}`).sort(compareCanonicalKeys);
  if (manifestSet.length !== actualSet.length || manifestSet.some((item, index) => item !== actualSet[index])) {
    throw new DisclosureAdmissionError("Manifest entry set does not equal outbound artifact set");
  }
  for (const artifact of payload.artifacts) {
    if (sha256(artifact.bytes) !== artifact.sha256) {
      throw new DisclosureAdmissionError(`Outbound bytes changed for ${artifact.artifactId}`);
    }
  }
};

export const createProviderPayload = (
  manifest: ExternalAiDisclosureManifest,
  artifacts: readonly Readonly<{ artifactId: string; sha256: string; bytes: Uint8Array }>[],
): ProviderPayload => {
  const payload = Object.freeze({
    manifestSha256: manifest.manifestSha256,
    artifacts: Object.freeze(
      artifacts.map((artifact) => Object.freeze({ ...artifact, bytes: new Uint8Array(artifact.bytes) })),
    ),
  });
  assertProviderPayloadIntegrity(manifest, payload);
  return payload;
};

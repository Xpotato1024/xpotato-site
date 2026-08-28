import { describe, expect, it } from "vitest";
import type {
  ArticleJobSpec,
  ExternalAiAdmissionClass,
  ExternalAiAdmissionProvenance,
  ExternalAiDisclosureRecord,
} from "@xpotato/content-contracts";
import { fingerprint, sha256 } from "./canonical.js";
import {
  compileDisclosureManifest,
  createProviderPayload,
  currentExternalAiPolicyBinding,
  type OutboundArtifact,
} from "./disclosure.js";

const encoder = new TextEncoder();
const hash = (character: string): string => character.repeat(64);

const provenanceFor = (
  admissionClass: ExternalAiAdmissionClass,
  artifactSha256: string,
  mode: ExternalAiDisclosureRecord["mode"],
): ExternalAiAdmissionProvenance => {
  switch (admissionClass) {
    case "public_anonymous_web_v1":
      return {
        kind: "public_anonymous_https_acquisition_v1",
        artifactSha256,
        finalUrl: "https://example.test/public",
        anonymousReadable: true,
        credentialsUsed: false,
        secretScanResultSha256: hash("1"),
        acquisitionReceiptSha256: hash("2"),
      };
    case "public_github_revision_v1":
      return {
        kind: "public_github_revision_acquisition_v1",
        artifactSha256,
        repository: "Xpotato1024/public-fixture",
        commitSha: "3".repeat(40),
        blobSha256: hash("4"),
        anonymousReadable: true,
        credentialsUsed: false,
        secretScanResultSha256: hash("5"),
        acquisitionReceiptSha256: hash("6"),
      };
    case "approved_publication_derivative_v1":
      return {
        kind: "approved_publication_derivative_lineage_v1",
        sourceSubjectSha256: hash("7"),
        derivativeSha256: artifactSha256,
        privacyBoundaryRecordSha256: hash("8"),
        approvedStages: ["author", "visual_audit"],
        secretScanResultSha256: hash("9"),
      };
    case "secret_or_capability_material_v1":
      return {
        kind: "secret_or_capability_detection_v1",
        artifactSha256,
        detectedKind: "api_token",
        detectionRecordSha256: hash("a"),
      };
    case "unknown_v1":
      return { kind: "unknown_v1", artifactSha256, reason: "unclassified fixture" };
    default:
      return {
        kind: "article_job_input_v1",
        inputRef: "artifact-1",
        inputClass: admissionClass,
        artifactSha256,
        representation: mode === "allow_derived_only" ? "derived" : "raw",
        ...(mode === "allow_derived_only"
          ? { sourceSubjectSha256: hash("b"), derivationRecordSha256: hash("c") }
          : {}),
      };
  }
};

const makeArtifact = (
  admissionClass: ExternalAiAdmissionClass,
  text = "public fixture",
  mode: ExternalAiDisclosureRecord["mode"] = "allow_exact",
  overrides: Partial<OutboundArtifact> = {},
): OutboundArtifact => {
  const bytes = encoder.encode(text);
  const artifactSha256 = sha256(bytes);
  const provenance = overrides.admissionProvenance ?? provenanceFor(admissionClass, artifactSha256, mode);
  const privateInput = provenance.kind === "article_job_input_v1";
  const record: ExternalAiDisclosureRecord = overrides.disclosureRecord ?? {
    schemaVersion: 1,
    subject: { kind: "artifact", id: "artifact-1", sha256: artifactSha256 },
    mode,
    basis:
      privateInput && mode !== "deny"
        ? "user_authorized"
        : mode === "deny" || admissionClass === "unknown_v1" || admissionClass === "secret_or_capability_material_v1"
          ? "system_policy"
          : "repository_policy",
    policyId: currentExternalAiPolicyBinding.policyId,
    policySha256: currentExternalAiPolicyBinding.policySha256,
    ...(mode !== "deny" && privateInput
      ? { authorizedBy: "user" as const, authorizedAt: "2026-08-26T00:00:00Z" }
      : {}),
    ...(mode === "allow_derived_only" ? { derivedArtifactPolicyId: "safe-derivative-v1" } : {}),
    notes: [],
  };
  return {
    artifactId: "artifact-1",
    sha256: artifactSha256,
    bytes,
    required: true,
    admissionProvenance: provenance,
    admissionProvenanceSha256: overrides.admissionProvenanceSha256 ?? fingerprint(provenance),
    disclosureRecord: record,
    disclosureRecordSha256: overrides.disclosureRecordSha256 ?? fingerprint(record),
    ...overrides,
  };
};

const jobSpecFor = (
  artifacts: readonly OutboundArtifact[],
  options: Readonly<{
    authorizePrivate?: boolean;
    policyId?: string;
    policySha256?: string;
    externalTextAI?: boolean;
    externalImageAI?: boolean;
  }> = {},
): ArticleJobSpec => ({
  schemaVersion: 1,
  jobId: "job-1",
  operation: "create",
  target: {
    collection: "blog",
    contentId: "f8a847d4-8f5d-4bb0-a387-750f096479f2",
    workingTitle: "fixture",
    articleMode: "explanation",
  },
  reader: { outcome: "understand", assumedKnowledge: [], language: "ja" },
  inputs: { userNotes: [], repositoryRefs: [], localSourceRefs: [], seedUrls: [], sourceDiscoveryQueries: [] },
  externalAiDisclosure: {
    policy: {
      policyId: options.policyId ?? currentExternalAiPolicyBinding.policyId,
      policySha256: options.policySha256 ?? currentExternalAiPolicyBinding.policySha256,
    },
    explicitAuthorizations:
      options.authorizePrivate === false
        ? []
        : artifacts.flatMap((artifact) =>
            artifact.admissionProvenance.kind === "article_job_input_v1" && artifact.disclosureRecord.mode !== "deny"
              ? [{ inputRef: artifact.admissionProvenance.inputRef, requestedMode: artifact.disclosureRecord.mode, authorizedBy: "user" as const }]
              : [],
          ),
  },
  constraints: { requiredClaims: [], forbiddenClaims: [], requiredSections: [], forbiddenPublicationPatterns: [] },
  taxonomyHints: { tagIds: [] },
  media: { suppliedMediaRefs: [], heroPreference: "auto", requiredInlineVisuals: [] },
  permissions: {
    networkAccess: false,
    externalTextAI: options.externalTextAI ?? true,
    externalImageAI: options.externalImageAI ?? true,
    localMediaProcessing: true,
    privateCanonicalMediaStorage: false,
    publicMediaUpload: false,
    protectedMediaOperation: false,
    repositoryExport: false,
  },
});

const compile = (
  artifacts: readonly OutboundArtifact[],
  options: Parameters<typeof jobSpecFor>[1] = {},
  image = false,
) =>
  compileDisclosureManifest({
    jobSpec: jobSpecFor(artifacts, options),
    requestId: "request-1",
    stage: image ? "image_generation" : "author",
    artifacts,
  });

describe("article-external-ai-disclosure-v1", () => {
  it("pins the exact current machine policy identity", () => {
    expect(currentExternalAiPolicyBinding).toEqual({
      policyId: "article-external-ai-disclosure-v1",
      policySha256: "2030471f1f9de6bd226ddbdffdc0270edb07849b9ba93fbf180fe470e0a0f660",
    });
  });

  it.each([
    "article_job_brief_v1",
    "user_note_or_log_v1",
    "private_repository_or_document_v1",
    "raw_user_image_v1",
    "unknown_v1",
  ] as const)("defaults %s to deny even when provider use is enabled", (admissionClass) => {
    expect(() => compile([makeArtifact(admissionClass, "private fixture", "deny")], {}, admissionClass === "raw_user_image_v1")).toThrow(/Required evidence unavailable/);
  });

  it("binds provider permission to ArticleJobSpec without broadening input disclosure", () => {
    const publicArtifact = makeArtifact("public_anonymous_web_v1");
    expect(() => compile([publicArtifact], { externalTextAI: false })).toThrow(/Provider use is disabled/);
    expect(() => compile([makeArtifact("article_job_brief_v1", "brief", "deny")])).toThrow(/Disclosure denied/);
  });

  it("requires the exact current policy ID and SHA in ArticleJobSpec and every record", () => {
    const artifact = makeArtifact("public_anonymous_web_v1");
    expect(() => compile([artifact], { policyId: "obsolete-policy-v1" })).toThrow(/policy ID is not current/);
    expect(() => compile([artifact], { policySha256: hash("d") })).toThrow(/policy SHA-256 is not current/);
    const wrongRecord = { ...artifact.disclosureRecord, policySha256: hash("e") };
    expect(() =>
      compile([
        makeArtifact("public_anonymous_web_v1", "public fixture", "allow_exact", {
          disclosureRecord: wrongRecord,
          disclosureRecordSha256: fingerprint(wrongRecord),
        }),
      ]),
    ).toThrow(/Disclosure policy mismatch/);
  });

  it("recomputes and verifies the disclosure record SHA", () => {
    expect(() =>
      compile([makeArtifact("public_anonymous_web_v1", "public", "allow_exact", { disclosureRecordSha256: hash("f") })]),
    ).toThrow(/record hash mismatch/);
  });

  it("unconditionally denies unknown provenance and ignores a forged caller admission class", () => {
    const unknown = makeArtifact("unknown_v1", "unknown", "allow_exact");
    const forged = { ...unknown, admissionClass: "public_anonymous_web_v1" } as OutboundArtifact;
    expect(() => compile([forged])).toThrow(/Disclosure denied/);
  });

  it("rejects forged admission provenance identity", () => {
    expect(() =>
      compile([makeArtifact("public_anonymous_web_v1", "public", "allow_exact", { admissionProvenanceSha256: hash("0") })]),
    ).toThrow(/provenance hash mismatch/);
  });

  it("requires ArticleJobSpec exact authorization for private inputs", () => {
    const artifact = makeArtifact("private_repository_or_document_v1", "private", "allow_exact");
    expect(() => compile([artifact], { authorizePrivate: false })).toThrow(/ArticleJobSpec authorization missing/);
    expect(compile([artifact]).entries).toHaveLength(1);
  });

  it("conditionally admits verified anonymous HTTPS and pinned public GitHub artifacts", () => {
    expect(compile([makeArtifact("public_anonymous_web_v1")]).entries).toHaveLength(1);
    expect(compile([makeArtifact("public_github_revision_v1", "pinned")]).entries).toHaveLength(1);
  });

  it("proves approved publication derivative source and purpose lineage", () => {
    const artifact = makeArtifact("approved_publication_derivative_v1", "normalized image");
    expect(compile([artifact]).entries[0]?.modeUsed).toBe("exact");
    const incompatible = {
      ...artifact.admissionProvenance,
      approvedStages: ["visual_audit" as const],
    } as ExternalAiAdmissionProvenance;
    expect(() =>
      compile([
        makeArtifact("approved_publication_derivative_v1", "normalized image", "allow_exact", {
          admissionProvenance: incompatible,
          admissionProvenanceSha256: fingerprint(incompatible),
        }),
      ]),
    ).toThrow(/purpose is incompatible/);
  });

  it("never sends raw source bytes under allow_derived_only", () => {
    const raw = makeArtifact("user_note_or_log_v1", "raw", "allow_derived_only");
    const rawProvenance = {
      kind: "article_job_input_v1" as const,
      inputRef: "artifact-1",
      inputClass: "user_note_or_log_v1" as const,
      artifactSha256: raw.sha256,
      representation: "raw" as const,
    };
    expect(() =>
      compile([
        makeArtifact("user_note_or_log_v1", "raw", "allow_derived_only", {
          admissionProvenance: rawProvenance,
          admissionProvenanceSha256: fingerprint(rawProvenance),
        }),
      ]),
    ).toThrow(/Derived-only/);
    expect(compile([raw]).entries[0]?.modeUsed).toBe("derived");
  });

  it.each([
    "api_token=fixture",
    "password: fixture",
    "-----BEGIN PRIVATE KEY-----",
    "session_cookie=fixture",
    "Cookie: session=fixture",
    "Authorization: Bearer fixture",
    "mfa_code=123456",
    "recovery_code=fixture",
    "https://example.test/?X-Amz-Signature=fixture",
  ])("hard-denies secret or capability material: %s", (text) => {
    expect(() => compile([makeArtifact("public_anonymous_web_v1", text)])).toThrow(/Hard-deny/);
  });

  it("makes a previous admission stale when the artifact SHA changes", () => {
    const artifact = makeArtifact("public_anonymous_web_v1", "old");
    const changed = { ...artifact, sha256: sha256(encoder.encode("new")), bytes: encoder.encode("new") };
    expect(() => compile([changed])).toThrow(/provenance artifact mismatch|Stale/);
  });

  it("requires the manifest set to equal the transport set and prevents hidden context", () => {
    const artifact = makeArtifact("public_anonymous_web_v1", "public");
    const manifest = compile([artifact]);
    expect(createProviderPayload(manifest, [artifact]).artifacts).toHaveLength(1);
    expect(() =>
      createProviderPayload(manifest, [artifact, { artifactId: "hidden", sha256: sha256(encoder.encode("hidden")), bytes: encoder.encode("hidden") }]),
    ).toThrow(/does not equal/);
  });
});

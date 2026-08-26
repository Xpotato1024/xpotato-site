import { describe, expect, it } from "vitest";
import type { ExternalAiAdmissionClass, ExternalAiDisclosureRecord } from "@xpotato/content-contracts";
import { fingerprint, sha256 } from "./canonical.js";
import { compileDisclosureManifest, createProviderPayload, type OutboundArtifact } from "./disclosure.js";

const encoder = new TextEncoder();
const policySha256 = "b".repeat(64);
const makeArtifact = (
  admissionClass: ExternalAiAdmissionClass,
  text = "public fixture",
  mode: ExternalAiDisclosureRecord["mode"] = "allow_exact",
  extra: Partial<OutboundArtifact> = {},
): OutboundArtifact => {
  const bytes = encoder.encode(text);
  const artifactSha256 = sha256(bytes);
  const record: ExternalAiDisclosureRecord = {
    schemaVersion: 1,
    subject: { kind: "artifact", id: "artifact-1", sha256: artifactSha256 },
    mode,
    basis: mode === "deny" ? "system_policy" : "repository_policy",
    policyId: "article-external-ai-disclosure-v1",
    policySha256,
    ...(mode === "allow_derived_only" ? { derivedArtifactPolicyId: "safe-derivative-v1" } : {}),
    notes: [],
  };
  return {
    artifactId: "artifact-1",
    sha256: artifactSha256,
    bytes,
    required: true,
    admissionClass,
    disclosureRecord: record,
    disclosureRecordSha256: fingerprint(record),
    ...extra,
  };
};

const compile = (artifacts: readonly OutboundArtifact[], image = false) =>
  compileDisclosureManifest({
    jobId: "job-1",
    jobFingerprint: "a".repeat(64),
    requestId: "request-1",
    stage: image ? "image_generation" : "author",
    providerPermission: { externalTextAI: true, externalImageAI: true },
    artifacts,
  });

describe("article-external-ai-disclosure-v1", () => {
  it.each([
    "article_job_brief_v1",
    "user_note_or_log_v1",
    "private_repository_or_document_v1",
    "raw_user_image_v1",
    "unknown_v1",
  ] as const)("defaults %s to deny even when provider use is enabled", (admissionClass) => {
    expect(() => compile([makeArtifact(admissionClass, "private fixture", "deny")], admissionClass === "raw_user_image_v1")).toThrow(/Required evidence unavailable/);
  });

  it("separates text and image provider permission from input disclosure", () => {
    const denied = makeArtifact("article_job_brief_v1", "brief", "deny");
    expect(() => compile([denied])).toThrow();
    expect(() => compile([makeArtifact("raw_user_image_v1", "image", "deny")], true)).toThrow();
  });

  it("conditionally admits anonymous HTTPS and pinned public GitHub exact artifacts", () => {
    expect(() => compile([makeArtifact("public_anonymous_web_v1")])).toThrow(/Conditional/);
    expect(compile([makeArtifact("public_anonymous_web_v1", "public", "allow_exact", { anonymousHttpsVerified: true })]).entries).toHaveLength(1);
    expect(compile([makeArtifact("public_github_revision_v1", "pinned", "allow_exact", { pinnedPublicRevisionVerified: true })]).entries).toHaveLength(1);
  });

  it("never sends raw source bytes under allow_derived_only", () => {
    expect(() => compile([makeArtifact("user_note_or_log_v1", "raw", "allow_derived_only", { rawSourceBytes: true })])).toThrow(/Derived-only/);
    expect(
      compile([
        makeArtifact("user_note_or_log_v1", "redacted", "allow_derived_only", {
          isDerived: true,
          rawSourceBytes: false,
          sourceSubjectSha256: "c".repeat(64),
        }),
      ]).entries[0]?.modeUsed,
    ).toBe("derived");
  });

  it.each([
    "api_token=fixture",
    "password: fixture",
    "-----BEGIN PRIVATE KEY-----",
    "session_cookie=fixture",
    "Authorization: Bearer fixture",
    "mfa_code=123456",
    "recovery_code=fixture",
    "https://example.test/?X-Amz-Signature=fixture",
  ])("hard-denies secret or capability material: %s", (text) => {
    expect(() => compile([makeArtifact("public_anonymous_web_v1", text, "allow_exact", { anonymousHttpsVerified: true })])).toThrow(/Hard-deny/);
  });

  it("makes a previous admission stale when the artifact SHA changes", () => {
    const artifact = makeArtifact("public_anonymous_web_v1", "old", "allow_exact", { anonymousHttpsVerified: true });
    const changed = { ...artifact, sha256: sha256(encoder.encode("new")), bytes: encoder.encode("new") };
    expect(() => compile([changed])).toThrow(/Stale/);
  });

  it("requires the manifest set to equal the transport set and prevents hidden context", () => {
    const artifact = makeArtifact("public_anonymous_web_v1", "public", "allow_exact", { anonymousHttpsVerified: true });
    const manifest = compile([artifact]);
    expect(createProviderPayload(manifest, [artifact]).artifacts).toHaveLength(1);
    expect(() =>
      createProviderPayload(manifest, [artifact, { artifactId: "hidden", sha256: sha256(encoder.encode("hidden")), bytes: encoder.encode("hidden") }]),
    ).toThrow(/does not equal/);
  });
});

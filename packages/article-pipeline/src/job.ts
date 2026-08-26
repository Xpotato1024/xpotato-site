import { articleJobSpecSchema, type ArticleJobSpec } from "@xpotato/content-contracts";
import { canonicalJson, fingerprint } from "./canonical.js";

export interface NormalizedArticleJobSpec {
  readonly spec: ArticleJobSpec;
  readonly canonicalJson: string;
  readonly jobFingerprint: string;
}

export const normalizeArticleJobSpec = (input: unknown): NormalizedArticleJobSpec => {
  const spec = articleJobSpecSchema.parse(input);
  const normalized = canonicalJson(spec);
  return Object.freeze({ spec, canonicalJson: normalized, jobFingerprint: fingerprint(spec) });
};

export interface ImmutableArtifactIdentity {
  readonly artifactId: string;
  readonly sha256: string;
  readonly mediaType: string;
}

export interface SourcePinningPort {
  pin(input: Readonly<{ locator: unknown; expectedSha256?: string }>): Promise<ImmutableArtifactIdentity>;
}

export interface ArtifactStore {
  put(identity: ImmutableArtifactIdentity, bytes: Uint8Array): Promise<void>;
  get(identity: ImmutableArtifactIdentity): Promise<Uint8Array>;
}

export interface RepositoryExportPort {
  materialize(input: Readonly<{ candidateSha256: string; provenanceSha256: string }>): Promise<Readonly<{ patchSha256: string }>>;
}

export interface CleanupEligibility {
  readonly durableGitRefVerified: boolean;
  readonly claimLineageVerified: boolean;
  readonly mediaRecoveryVerified: boolean;
  readonly externalAiLineageVerified: boolean;
  readonly unresolvedIncident: boolean;
  readonly operatorConfirmed: boolean;
}

export const isCleanupEligible = (input: CleanupEligibility): boolean =>
  input.durableGitRefVerified &&
  input.claimLineageVerified &&
  input.mediaRecoveryVerified &&
  input.externalAiLineageVerified &&
  !input.unresolvedIncident &&
  input.operatorConfirmed;

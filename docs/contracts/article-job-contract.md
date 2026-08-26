---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - Article Job specification contract
  - Article Job immutable identity
  - Article Job permission upper bounds
---

# Article Job Contract

## Purpose

Article Job is one content revision work unit for research/authoring/audit/visual/candidate/human approval/persistence/export orchestration。

AI session/Git branch is not identity。Normalized job spec + immutable artifact lineage are authoritative within job lifecycle。

## Logical schema

```ts
interface ArticleJobSpec {
  schemaVersion: 1;
  jobId: string;

  operation: "create" | "update";

  target: {
    collection: "blog" | "notes" | "projects" | "tools" | "pages";
    contentId: ContentId;
    existingContentId?: ContentId;
    workingTitle: string;
    slugHint?: string;

    articleMode:
      | "explanation"
      | "tutorial"
      | "investigation"
      | "build_log"
      | "incident"
      | "comparative_review";

    updateKind?:
      | "refresh"
      | "correction"
      | "expansion"
      | "restructure"
      | "metadata_only"
      | "media_only";

    allowRouteChange?: boolean;
  };

  reader: {
    outcome: string;
    assumedKnowledge: string[];
    language: "ja";
  };

  inputs: {
    userNotes: UserNoteInput[];
    repositoryRefs: RepositoryRef[];
    localSourceRefs: LocalSourceRef[];
    seedUrls: string[];
    sourceDiscoveryQueries: string[];
  };

  externalAiDisclosure: {
    policy: ExternalAiInputPolicyBinding;
    explicitAuthorizations: ExternalAiInputAuthorization[];
  };

  constraints: {
    requiredClaims: string[];
    forbiddenClaims: string[];
    requiredSections: string[];
    forbiddenPublicationPatterns: string[];
  };

  taxonomyHints: {
    categoryId?: string;
    tagIds: string[];
  };

  media: {
    suppliedMediaRefs: string[];
    heroPreference: "auto" | "source_media" | "ai_generated" | "deterministic_cover";
    requiredInlineVisuals: string[];
  };

  permissions: {
    networkAccess: boolean;
    externalTextAI: boolean;
    externalImageAI: boolean;
    localMediaProcessing: boolean;

    privateCanonicalMediaStorage: boolean;
    publicMediaUpload: boolean;
    protectedMediaOperation: boolean;
    repositoryExport: boolean;
  };
}
```

`ExternalAiInputPolicyBinding` / `ExternalAiInputAuthorization` semantics are defined by `external-ai-disclosure-contract.md`。

## Input identity and explicit disclosure authorization

User/local input must have an identity that can be normalized to exact job artifacts before provider disclosure is considered。

Conceptually:

```ts
interface UserNoteInput {
  inputId: string;
  text: string;
}

interface ExternalAiInputPolicyBinding {
  policyId: string;
  policySha256: string;
}

interface ExternalAiInputAuthorization {
  inputRef: string;
  requestedMode: "allow_exact" | "allow_derived_only";
  authorizedBy: "user";
}
```

The authorization is a user intent input, **not** the final provider admission record. Executor first materializes/hashes the actual source/artifact, applies hard-deny/secret rules, then creates an `ExternalAiDisclosureRecord` bound to exact bytes。

Repository/public-source default behavior is resolved by the versioned disclosure policy, not AI guesswork。

## Operation rules

### create

- executor allocates new ContentId
- no `existingContentId`
- no updateKind
- slugHint is route proposal, not identity

### update

- `existingContentId` required
- `target.contentId === existingContentId`
- updateKind required
- resolves exactly one current content at fixed base revision
- follows `article-update-contract.md`

## Identity

ContentId semantics=`content-identity-contract.md` / ADR-0023。

JobId and ContentId are separate; many Article Jobs can revise one ContentId。

JobId is opaque unique ID and not derived from slug/title/branch。Exact job ID encoding is implementation machine SoT。

## Job fingerprint

SHA-256 of canonical serialization of normalized ArticleJobSpec。

Rules:

- UTF-8
- canonical object key order
- arrays preserve semantic order
- insignificant whitespace excluded
- enums/booleans schema-fixed
- only genuinely non-semantic runtime timestamps/UI comments may be excluded
- external-AI disclosure policy/explicit authorization changes are semantic and change the fingerprint

## Existing update prior-state

Update init fixes current:

- MDX/frontmatter
- route/ContentId
- Media Registry/canonical source identity
- current Publication Provenance/material claim bindings

into prior-state bundle。Human review receives before/after diff。

## Permission semantics

Permissions are **job upper bounds**, not proof of human approval/provider authorization/input disclosure/execution success。

### Network / AI provider use

- `networkAccess=false` -> no network source acquisition
- `externalTextAI=false` -> no external text/vision semantic provider
- `externalImageAI=false` -> no external image generator
- `localMediaProcessing=false` -> no ingest/variant processing requiring local media toolchain

### External AI input disclosure

Even when `externalTextAI=true` or `externalImageAI=true`, each exact request input must pass `external-ai-disclosure-contract.md`。

Provider-use permission **does not** imply:

- user/local log disclosure
- private repository disclosure
- raw image disclosure
- `publicSafe`/citation-eligible source disclosure
- secret-bearing artifact disclosure

Before each external call, deterministic request compiler requires a current `ExternalAiDisclosureManifest` whose entries exactly match actual serialized/provider input artifacts。

Hard-deny secrets cannot be authorized through ArticleJobSpec broad permission or input authorization。

Required evidence that is disclosure-denied must use an admitted derivative/local backend, narrow the claim, request authorization, or BLOCK; it must not be silently omitted while claiming completeness。

### Persistent media

- `privateCanonicalMediaStorage=false` -> cannot transition HUMAN_APPROVED -> MEDIA_SOURCE_STORED when source persistence is required
- `publicMediaUpload=false` -> cannot transition MEDIA_SOURCE_STORED -> MEDIA_PUBLISHED when public media is required
- `protectedMediaOperation=false` -> cannot transition MEDIA_PUBLISHED -> MEDIA_PROTECTED when protection is required

Permission true never allows these operations before human approval/current state/lifecycle/credential gates。

### Repository export

- `repositoryExport=false` -> Article Job may reach review/approval/persistence as allowed but cannot transition to EXPORTED

Repository export is still not merge/push/deploy authorization。

### Not-required media cases

A candidate with no source/public/protected media requirement may use validated deterministic `not_required`/empty results and does not need permission for a nonexistent external operation。Implementation schema/state transition must distinguish `required` from `not_required`, not bypass a required operation merely because permission=false。

## Permission versus lifecycle

Even if job permission=true:

- site Design/implementation/provider gate must permit operation
- exact accepted infra handoff must permit provider mutation where applicable
- runtime scoped credential/capability must exist
- human approval must bind exact candidate for persistence/export
- exact external provider request inputs must pass disclosure admission

Job permission cannot override `architecture/design-status.md`, `architecture/infrastructure-handoff.md`, or disclosure hard-deny policy。

## Resource budgets

Versioned execution profiles bind finite limits for source discovery, semantic calls/revisions, image attempts, artifact/workspace bytes, verifier time/resources etc。

Budget exhaustion -> BLOCKED; never lower evidence/audit/security/recovery/disclosure requirements。

## Provider neutrality

ArticleJobSpec contains no provider/model/resource IDs。Execution profiles/backends/infra handoff own implementation identity。

Disclosure policy identity is provider-neutral; a provider-specific policy change must be versioned rather than encoded in article content schema。

## Mutability

Material spec/permission/disclosure/input change stales affected downstream artifacts according to state machine。Do not overwrite historical job artifacts as if same request; preserve attempt/lineage identity。

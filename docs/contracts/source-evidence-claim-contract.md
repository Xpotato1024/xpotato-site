---
status: proposed
owner: content
last_verified: 2026-08-26
canonical_for:
  - source record contract
  - evidence record contract
  - article claim contract
---

# Source, Evidence, and Claim Contract

## Principle

Article Job separates:

```text
SourceRecord
 -> EvidenceRecord
 -> ArticleClaimRecord
 -> published MDX
```

Source discovery != source truth。AI claim != evidence support。Citation != evidence itself。

Detailed Source/Evidence/Claim records are job artifacts; published material claims additionally require a cleanup-safe compact support mapping in Publication Provenance。

## SourceLocator

```ts
type SourceLocator =
  | { kind: "web"; canonicalUrl: string }
  | { kind: "github"; repository: string; commitSha: string; path?: string; blobSha256?: string }
  | { kind: "doi"; doi: string }
  | { kind: "repository"; path: string; commitSha: string; blobSha256: string }
  | { kind: "artifact"; artifactSha256: string; publicDescription?: string };
```

No absolute local path, credential-bearing URL, signed URL in canonical locator。

## CitationMetadata

```ts
interface CitationMetadata {
  eligible: boolean;
  title?: string;
  publisher?: string;
  canonicalUrl?: string;
  publishedAt?: string;
  retrievedAt?: string;
}
```

Citation eligible means public-exportable representation, not “trusted/correct” and not external-AI disclosure permission。Private user logs may support evidence while citation.eligible=false。

## SourceRecord

```ts
interface SourceRecord {
  sourceId: string;
  kind:
    | "official_doc"
    | "standard"
    | "paper"
    | "web_page"
    | "github_file"
    | "github_commit"
    | "github_release"
    | "repository_doc"
    | "user_note"
    | "user_log"
    | "local_image"
    | "local_file";

  locator: SourceLocator;
  title?: string;
  publisher?: string;
  publishedAt?: string;
  retrievedAt?: string;
  snapshotSha256?: string;
  revision?: string;

  trustClass: "primary" | "authoritative_secondary" | "secondary" | "user_supplied";
  freshness: "stable" | "time_sensitive";

  publicSafe: boolean;
  citation: CitationMetadata;

  externalAiDisclosureRef: string;
}
```

`externalAiDisclosureRef` resolves an `ExternalAiDisclosureRecord` from `external-ai-disclosure-contract.md` bound to the exact SourceRecord/input artifact identity。

## Independent safety dimensions

These dimensions are independent:

- source authority (`trustClass`)
- public provenance safety (`publicSafe`)
- citation/public-link eligibility (`citation`)
- external AI input disclosure (`externalAiDisclosureRef`)

Do not derive one automatically from another。

Examples:

- public official doc: publicSafe/citable and usually disclosure-allow by explicit system policy
- private user log: non-citable; may be disclosure-deny, user-authorized exact, or derived-only
- secret-bearing local file: disclosure hard-deny regardless of publicSafe/citation flags

## Source pinning

- GitHub: commit SHA required
- paper/standard: durable identifier where possible
- web docs: canonical URL + retrieval time + optional snapshot hash
- user/local artifact: bytes hash
- repository doc: exact path + commit + blob hash

Floating branch URL alone is not source identity。

Source acquisition/pinning must also establish the disclosure record before the source/artifact can enter any external provider request。

## SourceRef

```ts
interface SourceRef {
  sourceId: string;
  sourceRecordSha256: string;
}
```

Evidence binds exact SourceRecord revision, not ID label only。

## EvidenceRecord

```ts
interface EvidenceRecord {
  evidenceId: string;
  proposition: string;
  sourceRefs: SourceRef[];
  interpretation:
    | "explicit"
    | "direct_observation"
    | "reasonable_inference"
    | "user_experience"
    | "recommendation_basis"
    | "unknown";
  confidence: "high" | "medium" | "low" | "not_available";
  freshnessChecked: boolean;
  ambiguityIds: string[];
}
```

1 record = 1 atomic proposition。Multiple sources must support same proposition; do not synthesize unstated causal/numeric relationships as source fact。

An EvidenceRecord may depend on a disclosure-denied SourceRecord if the evidence was constructed by an admissible local path。That does not make the source or evidence artifact externally disclosable automatically。

## AmbiguityRecord

```ts
interface AmbiguityRecord {
  ambiguityId: string;
  subject: string;
  reason: string;
  candidateInterpretations: string[];
  resolution: "unresolved" | "resolved" | "not_required";
  resolvedByEvidenceId?: string;
}
```

AI does not silently choose a likely value to close ambiguity。

## ArticleClaimRecord

```ts
interface ArticleClaimRecord {
  claimId: string;
  draftSpan: {
    start: number;
    end: number;
    text: string;
  };
  text: string;
  claimType:
    | "source_fact"
    | "user_experience"
    | "inference"
    | "recommendation"
    | "transition"
    | "limitation";
  evidenceIds: string[];
  confidence: "high" | "medium" | "low";
}
```

Binding rules:

- source_fact: supporting evidence >=1
- user_experience: user observation/note evidence
- inference: evidence required and must be expressed as inference
- recommendation: basis/judgment explicit; material factual rationale has evidence
- transition: evidence not required
- limitation: unknown/ambiguity may support it

## Material claim

“Material” means a reader could make a technical/factual/operational decision differently if the proposition is false or unsupported。

Typical material:

- external/current fact
- version/API behavior
- benchmark/measurement
- incident cause
- security/compatibility claim
- factual comparison
- operational recommendation with factual rationale

Pure transition/style text is normally non-material。

Material classification is validated by independent content audit, not author self-label alone。

## Freshness gate

Normally time-sensitive:

- software/API/provider current behavior/version
- plan/pricing/limits
- current law/standard status
- active service capability/support

If freshness cannot be checked, do not state as current confirmed fact。

## External AI disclosure gate

Before any SourceRecord, snapshot, EvidenceRecord, claim artifact, image, or derived context is sent to an external semantic/vision/image provider:

- use `external-ai-disclosure-contract.md`
- resolve exact artifact disclosure admission
- bind request-level exact disclosure manifest
- hard-deny secret-bearing material
- do not interpret `publicSafe`, citation eligibility, or `externalTextAI=true` as artifact admission

If required evidence is not externally admissible, use a permitted local/derived path or retain an explicit limitation/BLOCKED state rather than silently omitting the support。

## Citation export

Public citation uses `citation-export-contract.md` and only eligible public representation。

Claim -> evidence -> exact SourceRef validity comes first。AI-generated citation text cannot bypass this chain。

## Durable export before workspace cleanup

Detailed `EvidenceRecord`/`ArticleClaimRecord` may be deleted with full Article Job workspace after durable export eligibility。

Before that, deterministic exporter must derive `CompactMaterialClaimBinding[]` from **every published material claim**, using `publication-provenance-contract.md`。

Durable mapping retains:

- claim ID + published statement hash/locator
- claim type
- evidence ID + public-safe proposition summary/hash
- interpretation/freshness status
- durable source IDs -> CompactSourceRefs
- limitations

It does **not** retain raw private source bodies, private logs, prompt/reasoning, or full detailed evidence text when unsafe/unnecessary。

### Equivalence requirement

Compact durable binding must preserve support semantics of approved detailed artifacts:

- no new source may be added after approval without candidate invalidation
- no evidence interpretation may be strengthened during compacting
- no material claim may be omitted
- private-only source may use public-safe description/hash, not fabricated public URL

Candidate approval binds a compact durable ledger proposal before persistent media operations。Final export may add post-approval operational media lineage but material claim support semantics must equal approved proposal。

## Validation

Detailed job artifacts:

- SourceId/EvidenceId/ClaimId unique
- locator matches source kind
- GitHub source commit-pinned
- artifact locator no private absolute path
- citation eligible implies publicSafe
- SourceRef hash resolves exact SourceRecord
- externalAiDisclosureRef resolves exact current disclosure record
- publicSafe/citation/disclosure remain independent dimensions
- evidence references valid sources
- current material fact freshnessChecked
- claim type evidence policy

Durable export:

- all published material claims represented exactly once
- statement SHA/locator matches final MDX
- compact evidence source IDs resolve durable CompactSourceRefs
- compact interpretation not stronger than detailed evidence
- no private raw body/path/credential
- transition/non-material omission allowed
- cleanup blocked on mismatch/missing material binding

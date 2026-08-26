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

Article Jobではsource、evidence、article claimを別artifactとして扱う。

source発見 != claim correctness。AI claim != source support。

## Typed SourceLocator

```ts
type SourceLocator =
  | {
      kind: "web";
      canonicalUrl: string;
    }
  | {
      kind: "github";
      repository: string;
      commitSha: string;
      path?: string;
      blobSha256?: string;
    }
  | {
      kind: "doi";
      doi: string;
    }
  | {
      kind: "repository";
      path: string;
      commitSha: string;
      blobSha256: string;
    }
  | {
      kind: "artifact";
      artifactSha256: string;
      publicDescription?: string;
    };
```

absolute local path、credential-bearing URL、signed URLをcanonical locatorへ保存しない。

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

`eligible=true`はpublic citationへexport可能という意味で、source trustを意味しない。

private user log等はevidence sourceになれてもcitation eligible=false。

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

  trustClass:
    | "primary"
    | "authoritative_secondary"
    | "secondary"
    | "user_supplied";

  freshness: "stable" | "time_sensitive";
  publicSafe: boolean;
  citation: CitationMetadata;
}
```

## Source pinning

- GitHub: commit SHA required。release sourceならrelease/tag identityもrecord可能
- standard/paper: DOI/permanent identifier優先
- web docs: canonical URL + retrieval time + optional snapshot hash
- user/local artifact: bytes hash
- repository doc: path + commit SHA + blob hash

floating branch URLだけをsource identityとしない。

## Public-safe versus citation-eligible

`publicSafe=true`でもcitationとして有用とは限らない。

citation export prerequisite:

- `publicSafe=true`
- `citation.eligible=true`
- public representationに必要なmetadata valid

private locatorをcitation exporterが推測してURL化しない。

## SourceRef

```ts
interface SourceRef {
  sourceId: string;
  sourceRecordSha256: string;
}
```

EvidenceRecordはSource IDだけでなくexact SourceRecord revisionへbindする。

source metadataがmaterialに変更された場合はnew record hashとなる。

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

1 record = 1 atomic proposition。

複数SourceRefは同じpropositionをsupportする必要がある。

離れたsourceからsource自体が述べない因果/比較/数値relationを作らない。

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

AIがmost-likely値で埋めない。

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

binding:

- source_fact: supporting evidence >=1
- user_experience: user evidence/noteへbind
- inference: evidence required; source factとして表現しない
- recommendation: rationale/comparison evidence、またはauthor judgment明示
- transition: evidence不要
- limitation: unknown/ambiguityへbind可能

## Freshness gate

原則time-sensitive:

- software current version
- API behavior
- provider plan/pricing/limits
- framework support status
- current product/service capability
- law/standard current status

current sourceを再確認できなければcurrent factとして断定しない。

## Citation export

public citationは`citation-export-contract.md`に従う。

claim -> evidence -> exact SourceRefがvalidであることが先。

AIがcitation stringを自由生成してこのbindingを迂回しない。

## Validation

- SourceId unique
- locator shape matches source kind
- GitHub source has commit SHA
- artifact locator has no absolute private path
- citation eligible implies publicSafe
- citation canonical URL is HTTPS where URL-based
- Evidence SourceRef hash matches catalog
- freshnessChecked required for time-sensitive evidence used as current fact

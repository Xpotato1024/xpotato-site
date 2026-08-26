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

Article Jobでは、**source、evidence、article claimを別artifactとして扱う**。

sourceを見つけたことはclaimが正しいことを意味せず、AIがclaimを書いたことはsourceがそれを支持することを意味しない。

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

  locator: string;
  title?: string;
  publisher?: string;
  retrievedAt?: string;
  contentSha256?: string;
  revision?: string;
  trustClass: "primary" | "authoritative_secondary" | "secondary" | "user_supplied";
  freshness: "stable" | "time_sensitive";
  publicSafe: boolean;
}
```

### Source pinning

- GitHub: possibleならcommit SHA / release tagを固定
- standards / paper: DOI / permanent identifier優先
- web docs: canonical URL + retrieval time
- user file: bytes hash
- repository doc: repository ref + path + commit SHA

URLだけをartifact identityとしない。

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

1 record = 1 atomic propositionを基本とする。

複数source refを持つ場合、それらは同じpropositionを支持しなければならない。

離れたsourceを組み合わせて、どのsourceも述べていない因果関係・比較優位・数値関係を作らない。

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

AIが「最もありそうなもの」で埋めない。記事公開にmaterialならhuman reviewまで残す。

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

### Binding rules

- `source_fact`: 1件以上のsupporting evidence必須
- `user_experience`: user-provided evidenceまたはexplicit user noteへbind
- `inference`: evidence必須。source factとして表現しない
- `recommendation`: comparison / rationale evidenceを持つか、author judgmentであることが明確
- `transition`: evidence不要
- `limitation`: unknown / ambiguity artifactへbindできる

## Freshness gate

次は原則 `freshness = time_sensitive` とする。

- software current version
- API behavior
- provider plan / pricing / limits
- framework support status
- current product / service capability
- current law / standard status

記事作成時にcurrent sourceを再確認できなければ、current factとして断定しない。

## Citation and publication

canonical source ledger全体を公開記事へ表示する必要はない。

ただし public articleが引用 / source linkを必要とする場合、article claimからsource referenceへ追跡できる状態を保つ。

private user log、local path、internal repositoryはpublic source linkへ自動変換しない。

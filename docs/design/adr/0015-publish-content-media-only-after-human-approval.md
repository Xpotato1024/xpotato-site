---
status: proposed
date: 2026-08-26
owner: architecture
---

# ADR-0015: content mediaはhuman approval後にpublic R2へpublishする

## Context

R2-first media architectureでは、Article Jobが生成・ingestしたhero、photo、social card等をpublic object storageへuploadする必要がある。

一方、Article Jobのdraft / visual candidateは人間承認前にはまだpublication candidateであり、reject / revisionされ得る。

previewのためだけに先にpublic R2へuploadすると:

- rejectされたcandidateのpublic objectが増える
- AI stageが実質的なpublic mutationを引き起こしやすい
- approval targetとpublic objectの対応が分かりにくい
- cleanup / orphan lifecycleが複雑になる

## Decision

public content media uploadは`HUMAN_APPROVED`後に限定する。

normal flow:

```text
CANDIDATE_READY
 -> PREVIEW_VALIDATED
 -> HUMAN_REVIEW_READY
 -> HUMAN_APPROVED
 -> MEDIA_PUBLISHED
 -> EXPORTED
```

previewはprivate candidate media adapterを使用し、R2 uploadを必要としない。

R2 object keyはnormalized bytesのcontent hashからapproval前に計算可能とする。

## Publication contract

approval後:

- exact candidate bytesだけをupload
- immutable content-addressed key
- existing identical objectはreuse可
- key collision / identity mismatchはfail closed
- post-upload verification後にMediaPublicationManifestを作成
- repository Media Registry exportはmanifest成功後のみ

## Alternatives

### Candidate生成直後にR2へupload

不採用。previewは簡単になるがpublic side effectがhuman gateより前へ出る。

### Gitへcandidate mediaを一旦commit

不採用。Git binary肥大化とpublic/canonical content tree汚染の両方を招く。

### Human approval後にGit exportしてからR2 upload

不採用。Git revisionがまだ存在しないR2 objectを参照するwindowが生じる。

## Consequences

- human review previewはlocal candidate mediaを解決するadapterが必要
- approval後のmedia publicationはidempotentにretryできる必要がある
- upload成功後Git export失敗時にはunreferenced objectが発生し得るが、content-addressed objectとして安全に保持し、grace-period GC候補にできる
- public Git revisionは原則として既に存在確認済みのR2 objectだけを参照する

## Related

- `architecture/article-state-machine.md`
- `contracts/public-media-publication-contract.md`
- `contracts/media-asset-registry-contract.md`
- ADR-0014 R2-first content media

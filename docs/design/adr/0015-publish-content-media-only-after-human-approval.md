---
status: proposed
date: 2026-08-26
owner: architecture
---

# ADR-0015: persistent media mutationはexact human approval後に限定する

## Context

Article Jobはraw/source media、AI hero、delivery variants、social card等をprivate candidateとして生成する。Candidateはhuman review前にreject/revisionされ得る。

Candidate previewのためにprivate/public R2へ先行uploadすると:

- rejected candidate objectがpersistent storageへ増える
- AI stageが実質的なexternal mutationを起こす
- approval targetとpersistent bytesの対応が曖昧になる
- cleanup/orphan/recovery contractが複雑になる

## Decision

Article Jobのpersistent media mutationは`HUMAN_APPROVED`後に限定する。

Normal path:

```text
CANDIDATE_READY
 -> PREVIEW_VALIDATED
 -> HUMAN_REVIEW_READY
 -> HUMAN_APPROVED
 -> MEDIA_SOURCE_STORED
 -> MEDIA_PUBLISHED
 -> MEDIA_PROTECTED
 -> EXPORTED
```

### Before approval

- canonical source / delivery variants are private job artifacts
- preview uses local candidate media adapter
- private source-media R2へ永続化しない
- public R2へuploadしない
- protected-mediaへcopyしない

### After approval

1. exact approved privacy-normalized canonical sourceをprivate source-mediaへstore/reuseしてverify
2. exact approved delivery objectsをpublic content-addressed keysへpublish/reuseしてverify
3. exact public object setをprotected recovery planeへcopy/reuseしてverify
4. receipt chain成立後だけrepository export

Each step binds same candidate/approval identity and is idempotent for same exact bytes。

## Failure semantics

- source storage failure -> remain `HUMAN_APPROVED`
- public publication failure -> remain `MEDIA_SOURCE_STORED`
- protection failure -> remain `MEDIA_PUBLISHED`
- candidate/approvalをretry目的でmutateしない
- later stage失敗を理由にearlier gateを迂回しない

## Alternatives

### Candidate生成直後にremote persistence

previewは簡単になるがhuman gateより前にpersistent side effectが出るため不採用。

### Approval後にGit exportを先行

Git revisionが未persist/unprotected mediaを参照するwindowを作るため不採用。

### Raw originalをsource storageへ先にbackup

website publicationとpersonal source archivalを混同するため不採用。private canonical mediaだけがapproved後source planeへ入る。

## Consequences

- private candidate preview adapterが必要。
- approval後のsource/public/protection operationsをtyped/idempotentにする必要がある。
- remote storage outageでpublicationがblockするが、approval targetは変わらない。
- rejected visual/source bytesをnormal persistent planeへ残さない。

## Related

- `architecture/article-state-machine.md`
- `contracts/private-canonical-media-storage-contract.md`
- `contracts/public-media-publication-contract.md`
- `contracts/published-media-protection-contract.md`

---
status: proposed
date: 2026-08-26
owner: architecture
---

# ADR-0017: AI生成technical exampleの実行をisolated verifierへ限定する

## Context

AI-first technical articleではcode / CLI / configuration例が生成される。

これらをhost上で自動実行すると、誤ったcommandや意図しないsystem/external mutationがauthoring workflowから直接発生し得る。

一方、全exampleを未検証のまま公開するとtutorial品質が下がる。

## Decision

`packages/example-verifier`を独立workspaceとして設ける。

- Article pipelineはtyped verification request/resultだけを扱う
- arbitrary AI-generated commandをhost normal pathで実行しない
- sandbox profileはversion-controlled
- network default deny
- credentials mount禁止
- disposable workspace
- timeout / output / resource bound
- system / external mutation commandはautomatic execution default deny
- actual observed outputはsandbox/evidence artifactからのみ取得

## Alternatives

### Article pipelineから直接child_process実行

不採用。semantic authoring orchestrationとcode execution trust boundaryが混ざる。

### 一切実行しない

安全だが、tutorial / code-heavy articleでAI生成exampleの明白なfailureを機械的に検出できない。

### Host Docker commandをAI Skillが都度組み立てる

不採用。command policy / mount / network / timeoutがnatural-language instructionへ分散する。

## Consequences

- sandbox profile / runnerの実装・testが必要
- environment-specific commandは`not_verifiable` / evidence-boundとして残せる
- passの意味を限定する必要がある。sandbox passはproduction suitabilityを証明しない
- changed code blockはverificationをstaleにする
- independent content auditorはverification manifestを入力にできる

## Related

- `contracts/technical-example-verification-contract.md`
- `architecture/article-state-machine.md`
- `architecture/repository-layout-vnext.md`

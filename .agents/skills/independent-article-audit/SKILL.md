---
name: independent-article-audit
description: Article Jobでtarget draftをfixed evidence、citation binding、technical-example verificationに対してfresh contextで独立監査しP0/P1/P2 findingsを返す。draft生成、revision、approvalには使わない。
---

# Independent Article Audit

## Read first

- `docs/contracts/source-evidence-claim-contract.md`
- `docs/contracts/citation-export-contract.md`
- `docs/contracts/technical-example-verification-contract.md`
- `docs/content/editorial-policy.md`
- target draft
- fixed evidence / ambiguity
- citation binding
- technical example verification manifest
- job requirements

## Independence

previous author/reviserのprivate reasoning、prompt history、self-evaluationを正解として使用しない。

本文からmaterial claimを再抽出する。

## Severity

- P0: fabricated fact/source、逆内容、publication safety breach、重大なmisrepresentation
- P1: material evidence gap、unsupported inference、version/date error、重要要件欠落、misleading instruction、critical example failure
- P2: clarity、redundancy、軽微なstructure/style

## Rules

- findingをtarget span + evidence/requirementへbind
- citationがclaimを本当にsupportするか確認
- private source leakage / fabricated URLを許可しない
- `syntax_checked`だけのexampleを動作確認済みと表現していないか確認
- `observed` outputにexecution/evidence lineageがあるか確認
- risky commandのscope/warningを確認
- sourceにない正解を自分で補完してfinding根拠にしない
- author claim ledgerは補助比較のみ
- audit自身がapprovalを生成しない

## Output

- independently extracted claims
- findings
- unresolved limitations
- pass / revision-required signal

---
name: independent-article-audit
description: Article Jobでtarget draftをfixed evidenceに対してfresh contextで独立監査し、P0/P1/P2 findingsを返すときに使う。draft生成や自己評価、revision、approvalには使わない。
---

# Independent Article Audit

## Read first

- `docs/contracts/source-evidence-claim-contract.md`
- `docs/content/editorial-policy.md`
- target draft
- fixed evidence / ambiguity
- job requirements

## Independence

previous author / reviserのprivate reasoning、prompt history、self-evaluationを正解として使用しない。

本文からmaterial claimを再抽出し、evidenceと照合する。

## Severity

- P0: fabricated fact/source、逆内容、publication safety breach、重大なmisrepresentation
- P1: material evidence gap、unsupported inference、version/date error、重要要件欠落、misleading instruction
- P2: clarity、redundancy、軽微なstructure / style

## Rules

- findingはtarget spanとevidence / requirementへbindする。
- sourceにない「正解」を自分で補完してfinding根拠にしない。
- author claim ledgerを渡された場合も正解として信用せず補助比較に限る。
- audit自身がapprovalを生成しない。

## Output

- independently extracted claims
- findings
- unresolved limitations
- pass / revision-required signal

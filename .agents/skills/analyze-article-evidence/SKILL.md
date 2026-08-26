---
name: analyze-article-evidence
description: Article Jobでfixed source bundleからatomic evidence recordsとambiguityを構築するときに使う。source discovery、draft、audit、publicationには使わない。
---

# Analyze Article Evidence

## Read first

- `docs/contracts/source-evidence-claim-contract.md`
- `docs/contracts/citation-export-contract.md`
- `docs/content/editorial-policy.md`
- current Article Job request / fixed source bundle

## Job

fixed sourceだけからarticleで利用可能なatomic propositionと未解決ambiguityを構築する。

## Rules

- 1 evidence record = 1 proposition
- sourceが支持しない因果/比較/数値関係を合成しない
- current factはfreshness requirementを確認
- user observationとexternal factを混同しない
- supporting sourceがない推測はunknown/ambiguity
- Source ID / locator / hashを捏造しない
- private sourceをpublic-citation eligibleへ勝手に変更しない
- citation metadataが存在してもsourceより強いpropositionを作らない
- evidence record自身をhuman-approved factと呼ばない

## Output

response schemaに従い:

- evidence records
- ambiguities
- warnings

を返す。

## Stop

fixed source不足ならevidenceを創作せず不足を報告する。

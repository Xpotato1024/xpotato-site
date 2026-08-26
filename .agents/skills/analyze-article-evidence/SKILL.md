---
name: analyze-article-evidence
description: Article Jobでfixed source bundleからatomic evidence recordsとambiguityを構築するときに使う。source discoveryや記事本文draft、監査、repository exportには使わない。
---

# Analyze Article Evidence

## Read first

- `docs/contracts/source-evidence-claim-contract.md`
- `docs/content/editorial-policy.md`
- current Article Job request / fixed source bundle

## Job

fixed sourceだけから、記事で利用可能なatomic propositionと未解決ambiguityを構築する。

## Rules

- 1 evidence record = 1 propositionを基本とする。
- sourceが支持しない因果・比較・数値関係を作らない。
- current factはfreshness requirementを確認する。
- user experienceとexternal factを混同しない。
- supporting sourceがない推測は`unknown` / ambiguityとして残す。
- source locatorやhashを捏造しない。
- evidence record自身をapproved factと呼ばない。

## Output

response schemaに従い:

- evidence records
- ambiguities
- warnings

を返す。

## Stop

fixed sourceが不足してmaterial propositionを支持できない場合、evidenceを創作せず不足を報告する。

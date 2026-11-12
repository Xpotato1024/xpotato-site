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

## 既出フィードバックを初稿で防ぐ

[初稿品質ゲート](../japanese-technical-blog/references/first-draft-quality-gate.md)と、更新紹介/比較なら[読者起点の更新紹介](../japanese-technical-blog/references/reader-first-visual-updates.md)を使う。
担当範囲はF09の測定根拠。指標の定義、比較の固定/変更条件、成功条件、分子/分母、計測範囲、失敗した基準条件の有無を固定sourceから区別する。不足はambiguityへ記録し、自分で追加計測・新しい推奨値を作らない。
これは既存response schema・独立性・権限・stage順序を変える規則ではない。自動testのPASSを読者理解やFB削減の実証にしない。

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

---
name: plan-article-visual
description: content-audit済みArticle Jobについてcollection visual policyに従いheroやinline visualのstrategy/concept/factualityを計画する。画像bytes生成、画像監査、本文修正には使わない。
---

# Plan Article Visual

## Read first

- `docs/architecture/synthetic-media-policy.md`
- `docs/contracts/visual-artifact-contract.md`
- `docs/architecture/media-pipeline.md`
- audit-clean draft / fixed evidence / supplied media catalog

## Job

collection policyとactual article needからVisualPlanSetを作る。

Blogではhero required。他collectionでvisual不要なら`plans=[]`を提案できる。

## Strategy

visualが必要な場合:

1. source media
2. deterministic diagram/cover where factual/reproducible
3. AI-generated conceptual visual when appropriate

## Rules

- AI visualはconceptual/decorative
- fake UI/terminal/code/graph/benchmarkをtechnical factとして描かせない
- inline factual visualはsource data/screenshot/deterministic diagramとして分離
- title文字をAI image promptへ描画要求しない
- safe area / crop / style profileを必要なvisualだけに設定
- semantic asset IDを提案し、R2 path/domainは生成しない
- image APIを直接呼ばない

## Output

VisualPlanSet schemaに従うproposalだけを返す。

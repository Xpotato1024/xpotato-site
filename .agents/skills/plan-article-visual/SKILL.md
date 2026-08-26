---
name: plan-article-visual
description: content-audit済みArticle Jobについてheroやinline visualのstrategy、concept、factuality、禁止描写、compositionを計画するときに使う。画像bytes生成、画像監査、記事本文修正には使わない。
---

# Plan Article Visual

## Read first

- `docs/architecture/synthetic-media-policy.md`
- `docs/contracts/visual-artifact-contract.md`
- `docs/architecture/media-pipeline.md`
- audit-clean article draft / fixed evidence / supplied media catalog

## Strategy

heroは次から選ぶ。

1. `source_media`
2. `ai_generated`
3. `deterministic_cover`

source mediaがtopicを適切に表す場合はそれを優先する。

## Rules

- AI heroは原則conceptual / decorative。
- fake UI、fake terminal、fake code、fake graph、fake benchmarkをtechnical factのように描かせない。
- inline factual visualが必要ならAI decorationで代替せず、実data / screenshot / diagram requirementとして分離する。
- title文字はAI image promptへ描画要求しない。
- safe area / crop / visual style profileを明示する。

## Output

VisualPlan schemaに従うproposalだけを返す。画像生成APIを直接呼ばない。

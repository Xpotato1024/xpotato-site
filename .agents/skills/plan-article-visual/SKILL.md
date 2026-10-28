---
name: plan-article-visual
description: content-audit済みArticle Jobについてcollection visual policyに従いheroやinline visualのstrategy/concept/factualityを計画する。画像bytes生成、画像監査、本文修正には使わない。
---

# Plan Article Visual

## Read first

- `docs/architecture/synthetic-media-policy.md`
- `docs/contracts/visual-artifact-contract.md`
- `.agents/skills/japanese-technical-blog/references/visual-structure.md`
- `docs/architecture/media-pipeline.md`
- audit-clean draft / fixed evidence / supplied media catalog

## Job

collection policyとactual article needからVisualPlanSetを作る。

Blogではhero required。他collectionでvisual不要なら`plans=[]`を提案できる。
本文の「読者が脳内で補完する必要のある関係」を節ごとに調べ、heroとは独立にinline visualが役立つかを判断する。最低枚数は強制しない。

## Strategy

visualが必要な場合:

目的別に選ぶ。ヒーロー/導入は有用な実写真か許可済みImageGen、関係の説明はSVG/CAD/注釈、操作は実画面、数値は根拠データ。生成に向くヒーローまで簡素な線画で代用しない。

適した手段を細分化する: 構造/方向/フローはSVG等の決定的作図、実物の観察は既存の提供写真か具体的撮影依頼、数値はsource datasetからのグラフ、抽象的な印象はAI概念画像。
写真が足りないときは最小限の撮影要件（対象・角度・枚数・目的・代替案）を記録し、架空の実写は生成しない。

`.agents/skills/japanese-technical-blog/references/concrete-visual-editorial.md`の図の受入基準と公式素材の合成規則を使う。

## Rules

- AI visualはconceptual/decorative
- fake UI/terminal/code/graph/benchmarkをtechnical factとして描かせない
- inline factual visualはsource data/screenshot/deterministic diagramとして分離
- title文字をAI image promptへ描画要求しない
- safe area / crop / style profileを必要なvisualだけに設定
- semantic asset IDを提案し、R2 path/domainは生成しない
- inline図の配置先となる本文節、図が省く脳内補完、caption/altの要件、表示幅を計画する。素材がないときは未準備と記録する
- 表示言語と図中ラベルを対象読者に合わせる。媒体だけで意味を伝えず、本文と対になる説明を残す
- image APIを直接呼ばない

## Output

VisualPlanSet schemaに従うproposalだけを返す。

## 説明の欠落を防ぐ

各主要論点について、読者が補完する関係、対応する本文節、必要な図、完成・未準備・不要の判断を既存proposalの欄へ記録する。新しい承認権限や独自schemaを作らない。構造アイコンは説明図と区別する。横長SVGを一律縮小して文字が読めなくなる案は、分割・縦並び・本文ラベルへ組み替える。

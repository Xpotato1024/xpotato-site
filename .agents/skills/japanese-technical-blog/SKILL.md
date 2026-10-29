---
name: japanese-technical-blog
description: 日本語の技術ブログ記事を作成・改稿するときに使う。読者と記事型を定義し、一次情報や実測を優先して claim/evidence を整理し、構成、技術例、本文、引用、推敲まで行う。architecture document、ADR、README、単なる repository への MDX 組み込みには使わない。
---

# Japanese Technical Blog

## Purpose

公開する日本語技術記事を、根拠の追跡可能性、読者の理解、再現可能性を重視して作成する。

SEO 定型文や一律の文体テンプレートへ最適化せず、記事の reader goal と evidence に応じて構成を変える。

## Read first

1. `docs/content/editorial-policy.md`
2. 記事 topic に関係する repository evidence / canonical docs
3. 必要に応じて `references/research-basis.md`
4. 記事型に応じて `references/article-structures.md`
5. 文章の構造・図版・写真・アイコンを扱うなら `references/visual-structure.md`
6. `references/natural-japanese.md` と `references/concrete-visual-editorial.md`
7. tutorial / explanation で code example が重要なら `references/technical-examples.md`

## Scope

Use this Skill for:

- technical blog article の新規 draft
- 既存記事の技術的・編集的な改稿
- investigation / incident / build log の article 化
- technical comparison の構成と執筆
- fact / source / citation review を伴う記事編集

Do not use this Skill for:

- architecture SoT / ADR / runbook / README
- approved article の frontmatter / file placement だけを行う作業
- production deploy
- R2 upload
- article topic と無関係な code implementation

## Required inputs

最低限、次のうち task から取得できるものを整理する。

- topic / reader problem
- target reader、読む状況、と前提知識
- 使用可能な提供写真・スクリーンショット・実測データと掲載権限
- article mode
- repository / log / experiment 等の available evidence
- current source が必要な version / date-sensitive claim
- publish してはいけない情報の境界

不足していても task を進められる場合は、推測で fact を作らず scope / limitation を明示して best effort で進める。

## Workflow

### 1. Define reader outcome

「記事を書き終える」ではなく、読者が読み終えたとき何を理解・判断・実行できるかを1文で定義する。
読者がどこで読むか（作業中の検索、印刷直前の確認、比較、学習、検証）を特定し、読み飛ばし時の判断を優先する。

記事型を1つ選ぶ。

- explanation
- tutorial
- investigation
- build log
- incident / troubleshooting
- comparative review

複数型を混ぜる場合も primary mode を決める。

### 2. Build an evidence ledger

本文より先に主要 claim を列挙する。

各 claim について少なくとも次を確認する。

- `claim`: 記事で述べたいこと
- `class`: fact / inference / experience / recommendation / unknown
- `source`: official docs / paper / repository evidence / measurement / secondary source
- `freshness`: current verification が必要か
- `confidence`: confirmed / bounded / unverified

source がない fact をもっともらしい文章で埋めない。

software version、current API、provider behavior、benchmark、法律・標準等の変動 claim は current source を再確認する。

### 3. Prefer evidence by hierarchy

原則として次の順で選ぶ。

1. official specification / upstream official docs / release note
2. primary paper / standard / authoritative dataset
3. repository code / commit / log / actual measurement
4. high-quality secondary source
5. community report

community experience を一般事実へ昇格させない。

### 4. Choose article structure

`references/article-structures.md` を使い、reader goal に必要な section だけを選ぶ。

repository directory 順や source code file 順を、そのまま article outline にしない。問題、mechanism、decision、data flow、trade-off など読者が追う意味構造を優先する。

### 4a. Select concrete examples

主要説明の実物・製品・設定名・変更前後・観察箇所を先に選ぶ。数値例と実測を区別し、一般論だけで構成を埋めない。各見出しへの最低例数は設けない。

### 5. Draft problem-first

冒頭で、reader problem、observed situation、question、unexpected result のいずれかを早く提示する。

定型の「この記事では〜について解説します」だけで導入を消費しない。

本文では:

- 1文に独立した主要命題を詰め込みすぎない。
- 条件、原因、結果、例外の連結が長くなったら分割する。
- 1段落は1つの小論点を中心にする。
- sequence / comparison / branch は prose に押し込まず list / table / diagram を検討する。
- 専門語は target reader に必要な粒度で初出定義する。
- 不要な英語・カタカナ語を増やさない。

固定の文字数制限や readability score へ機械的に最適化しない。

### 6. Make structure visible and plan visuals

references/visual-structure.mdに従い、見出しだけを追った流し読み、表やリストの使い方を確認する。
本文だけでは読者が断面・力の方向・作業順・比較を脳内で組み立てる必要がある場合は、説明図・写真・データ図表の候補を明示する。
SVG、実写真・スクリーンショット、測定値に基づくグラフ、ImageGenの概念画像を正確さ/証拠性で選び分ける。固定の図数は設けない。
写真が必要なら既存の提供物から確認する。不足するときだけ、対象・撮影方向・枚数・目的・代案を具体的に依頼する。
サイトの共通MDX構造（Callout、Steps/Step、DiagnosticList/DiagnosticItem）を意味に応じて選び、アイコンや記事独自のCSSを手書きしない。
記事全体の完成が依頼され、利用可能な根拠・権利・ツールがある場合、決定的SVG/根拠データの図を実際に作成して本文の該当箇所へ挿入する。ImageGenの使用は該当する許可を満たす場合に限る。
画像を作れるのに「挿入予定」だけで完成扱いしない。制作不能・撮影待ちの素材は本文に偽の画像リンクを置かず、記事外で理由と必要条件を明示する。
記事中の図版の配置・キャプション・代替テキストを本文とともに推敲する。

### 7. Explain technical examples

instructional article では `references/technical-examples.md` に従う。

原則:

1. example の目的を先に示す。
2. reader が理解できる最小 complete context を示す。
3. solution / code の後で、重要な mechanism と判断を説明する。
4. novice 向けでは複雑な example を意味単位に分割する。
5. output / observation を示せる場合は、期待値と観測値を区別する。

実行していない code を「動作確認済み」と書かない。

### 8. Separate fact from interpretation

fact と recommendation を同じ断定文へ押し込まない。

- measured / observed fact
- evidence からの inference
- author environment での experience
- trade-off を踏まえた recommendation
- remaining unknown

が読者に区別できるようにする。

### 9. Review citations and links

source は claim と対応する位置で示す。末尾の URL 集だけで根拠関係を曖昧にしない。

OSS / documentation の長文を転記しない。必要な claim を自分の文脈で要約し、source を示す。

### 10. Editorial revision

少なくとも次を見直す。

- 冒頭で reader problem が見えるか
- 見出しだけで論理の流れを追えるか
- 同じ説明を別 section で重複していないか
- source が claim を本当に支えているか
- experience を一般化していないか
- code と本文が version / behavior 上一致しているか
- conclusion が単なる本文再掲になっていないか
- limitation / applicability が必要なら残っているか

問い見出しの常体と本文の敬体は両立する。補足は判断に必要なもの、資料欄へ移すもの、削るものを分ける。ヒーローと説明図を分け、原本ロゴと生成背景を混同しない。詳細は `references/concrete-visual-editorial.md`。

### 11. Publication safety check

公開前提の draft では次を検査する。

- secret / token / credential
- private hostname / private IP / internal URL
- third-party private information
- 個人情報
- unpublished repository detail

公開可否が不明な具体値は伏せるか、明示確認対象として残す。

## Outputs

Task に応じて次の1つ以上を返す。

- evidence ledger
- article outline
- 図版と構造化ブロックの配置案、必要なら撮影依頼/未準備素材
- article draft / revision
- fact/source review
- unresolved claims / publication-risk list

repository への file placement / frontmatter / build integration は `$site-content-publish` の責務とする。

## Definition of Done

- reader outcome と article mode が一貫している。
- material fact に traceable source / evidence がある。
- unverified claim を fact として断定していない。
- article structure が source structure ではなく reader logic に沿っている。
- 見出しだけで論理の流れを追え、意味を持つ比較・手順・診断が適切に構造化されている。
- 図版が読者の脳内補完を減らす位置にあり、媒体の選択が正確さと権利条件に合う。
- technical example は目的、context、説明を持つ。
- public-safety review が済んでいる。
- unresolved limitation が必要なら明示されている。

## Stop / escalation

次の場合は断定を避け、未確認として扱う。

- primary evidence が矛盾する
- current version / provider behavior を確認できない
- benchmark / experiment の raw evidence がない
- private / public の境界が不明
- article の結論が source より強い

## 日本語と説明の完成度

`.agents/skills/japanese-technical-blog/references/natural-japanese.md`を参照する。語尾や禁止語の数ではなく、読者の疑問への答え、必要な条件、図の説明、文章のつながりを確認する。
『先に結論』や一般的なまとめは必須にしない。著者の経験・感情・数値を追加して自然さを演出しない。応力と力のような専門概念を、平易化で取り違えない。
診断のcheckは観察できる確認内容、actionは見直す候補、reasonは理由として区別する。理由がない場合に理由ラベルだけを生成しない。
説明図が必要な論点はvisual needsで追跡し、重要な関係が未説明なら完成判定を止める。短い節や図数だけで合否を決めない。

## 読者範囲と図の実表示

`.agents/skills/japanese-technical-blog/references/audience-and-visual-scale.md`を併用する。一般向けの入口を特定製品の手順へすり替えず、症状別の判断順序を記事全体でそろえる。図中ラベルは本文との比率をPC・スマホの実表示で確認する。
